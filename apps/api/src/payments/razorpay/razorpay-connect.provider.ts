import { createHash } from 'node:crypto';
import type { IncomingHttpHeaders } from 'node:http';
import type {
  ConnectedAccountState,
  ConnectProvider,
  ConnectWebhookOutcome,
  CreateAccountInput,
  CreatedAccount,
  ProviderPayout,
} from '../connect-provider.js';
import { InvalidWebhookError } from '../payment-provider.js';
import {
  headerValue,
  str,
  type RazorpayClient,
  type RazorpayEvent,
  verifyRazorpaySignature,
} from './razorpay-client.js';

interface LinkedAccount {
  id: string;
}

interface ProductConfiguration {
  id: string;
  activation_status:
    'requested' | 'needs_clarification' | 'under_review' | 'activated' | 'suspended';
  requirements?: { field_reference?: string; reason_code?: string; status?: string }[];
}

/**
 * Razorpay Route: one linked account per store, receiving each sale (minus the platform fee) as
 * a transfer from the Payment Link's order. Razorpay has no hosted onboarding for linked
 * accounts, so the admin collects the business and bank details and they pass straight through
 * to Razorpay (never stored). Activation comes from `product.route.*` webhooks.
 */
export class RazorpayConnectProvider implements ConnectProvider {
  readonly name = 'razorpay';
  readonly label = 'Razorpay';
  readonly onboarding = 'form' as const;
  readonly countries = ['IN'] as const;
  readonly currencies = ['INR'] as const;
  readonly hasDashboard = false;

  constructor(
    private readonly client: RazorpayClient,
    private readonly webhookSecret: string,
  ) {}

  async createAccount(input: CreateAccountInput): Promise<CreatedAccount> {
    const business = input.business;
    if (!business) throw new Error('Razorpay onboarding needs business details');
    const account = await this.client.request<LinkedAccount>('POST', '/v2/accounts', {
      email: input.email,
      phone: business.phone,
      type: 'route',
      // Unique per platform account on Razorpay's side; one linked account per attempt.
      reference_id: input.idempotencyKey.slice(-20),
      legal_business_name: business.legalBusinessName,
      business_type: business.businessType,
      contact_name: business.contactName,
      profile: {
        category: 'ecommerce',
        subcategory: 'ecommerce_marketplace',
        addresses: {
          registered: {
            street1: business.street1,
            street2: business.street2 || business.street1,
            city: business.city,
            state: business.state,
            postal_code: business.postalCode,
            country: 'IN',
          },
        },
      },
      legal_info: { pan: business.pan },
      notes: { storeId: input.storeId, storeName: input.storeName.slice(0, 200) },
    });
    await this.client.request('POST', `/v2/accounts/${account.id}/stakeholders`, {
      name: business.contactName,
      email: input.email,
    });
    const requested = await this.client.request<ProductConfiguration>(
      'POST',
      `/v2/accounts/${account.id}/products`,
      { product_name: 'route', tnc_accepted: true },
    );
    const product = await this.client.request<ProductConfiguration>(
      'PATCH',
      `/v2/accounts/${account.id}/products/${requested.id}`,
      {
        settlements: {
          account_number: business.accountNumber,
          ifsc_code: business.ifsc,
          beneficiary_name: business.beneficiaryName,
        },
        tnc_accepted: true,
      },
    );
    return {
      accountId: account.id,
      providerData: { productId: product.id },
      state: toState(account.id, product),
    };
  }

  createOnboardingLink(): Promise<string | null> {
    return Promise.resolve(null);
  }

  async retrieveAccount(
    accountId: string,
    providerData: Record<string, string>,
  ): Promise<ConnectedAccountState | null> {
    if (!providerData.productId) return null;
    const product = await this.client.request<ProductConfiguration>(
      'GET',
      `/v2/accounts/${accountId}/products/${providerData.productId}`,
    );
    return toState(accountId, product);
  }

  /** Linked accounts get settlement emails from Razorpay; there is no dashboard login to mint. */
  createDashboardLink(): Promise<string | null> {
    return Promise.resolve(null);
  }

  listPayouts(): Promise<ProviderPayout[] | null> {
    return Promise.resolve(null);
  }

  parseWebhook(rawBody: Buffer, headers: IncomingHttpHeaders): ConnectWebhookOutcome {
    if (
      !verifyRazorpaySignature(
        rawBody,
        headerValue(headers['x-razorpay-signature']),
        this.webhookSecret,
      )
    ) {
      throw new InvalidWebhookError('Invalid Razorpay signature');
    }
    const event = JSON.parse(rawBody.toString('utf8')) as RazorpayEvent;
    const eventId =
      headerValue(headers['x-razorpay-event-id']) ??
      `sha256:${createHash('sha256').update(rawBody).digest('hex')}`;
    const type = event.event;
    const accountId = event.account_id;
    if (!accountId?.startsWith('acc_')) return { kind: 'ignored', eventId, type };

    if (type.startsWith('product.route.')) {
      const product = (event.payload.merchant_product?.entity ??
        {}) as Partial<ProductConfiguration>;
      const status = (product.activation_status ??
        type.slice('product.route.'.length)) as ProductConfiguration['activation_status'];
      return {
        kind: 'account_updated',
        eventId,
        type,
        account: toState(accountId, {
          id: str(product.id),
          activation_status: status,
          requirements: product.requirements,
        }),
      };
    }
    if (type === 'account.suspended') {
      return {
        kind: 'account_updated',
        eventId,
        type,
        account: toState(accountId, { id: '', activation_status: 'suspended' }),
      };
    }
    return { kind: 'ignored', eventId, type };
  }
}

function toState(accountId: string, product: ProductConfiguration): ConnectedAccountState {
  const active = product.activation_status === 'activated';
  return {
    accountId,
    chargesEnabled: active,
    payoutsEnabled: active,
    // Everything is submitted at once; anything but "requested" means Razorpay has the details.
    detailsSubmitted: product.activation_status !== 'requested',
    requirementsDue: [
      ...new Set(
        (product.requirements ?? [])
          .map((r) => r.field_reference ?? r.reason_code)
          .filter((r): r is string => typeof r === 'string'),
      ),
    ].sort(),
    disabledReason:
      product.activation_status === 'suspended'
        ? 'suspended'
        : product.activation_status === 'needs_clarification'
          ? 'needs_clarification'
          : null,
    country: 'IN',
  };
}
