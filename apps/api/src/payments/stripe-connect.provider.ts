import type { IncomingHttpHeaders } from 'node:http';
import Stripe from 'stripe';
import type {
  ConnectedAccountState,
  ConnectProvider,
  ConnectWebhookOutcome,
  CreateAccountInput,
  ProviderPayout,
} from './connect-provider.js';
import { InvalidWebhookError } from './payment-provider.js';

/**
 * Stripe Connect adapter: one Express-dashboard account per store, created by the platform
 * (platform pays Stripe fees and covers losses), onboarded on Stripe's hosted pages. Sales are
 * destination charges settled to the account (see StripePaymentProvider) minus the plan fee.
 * Account status comes from the Connect webhook endpoint and is re-read when the merchant
 * returns from onboarding.
 */
export class StripeConnectProvider implements ConnectProvider {
  readonly name = 'stripe';

  constructor(
    private readonly stripe: Stripe,
    private readonly webhookSecret: string,
  ) {}

  static create(secretKey: string, webhookSecret: string): StripeConnectProvider {
    return new StripeConnectProvider(new Stripe(secretKey), webhookSecret);
  }

  async createAccount(input: CreateAccountInput): Promise<{ accountId: string }> {
    const account = await this.stripe.accounts.create(
      {
        country: input.country,
        email: input.email,
        business_profile: { name: input.storeName },
        controller: {
          stripe_dashboard: { type: 'express' },
          fees: { payer: 'application' },
          losses: { payments: 'application' },
        },
        capabilities: { card_payments: { requested: true }, transfers: { requested: true } },
        metadata: { storeId: input.storeId },
      },
      // One account per store even if the request is retried (or sent twice concurrently).
      { idempotencyKey: input.idempotencyKey },
    );
    return { accountId: account.id };
  }

  async createOnboardingLink(
    accountId: string,
    urls: { returnUrl: string; refreshUrl: string },
  ): Promise<string> {
    const link = await this.stripe.accountLinks.create({
      account: accountId,
      type: 'account_onboarding',
      return_url: urls.returnUrl,
      refresh_url: urls.refreshUrl,
      collection_options: { fields: 'eventually_due' },
    });
    return link.url;
  }

  async retrieveAccount(accountId: string): Promise<ConnectedAccountState> {
    return toAccountState(await this.stripe.accounts.retrieve(accountId));
  }

  async createDashboardLink(accountId: string): Promise<string> {
    return (await this.stripe.accounts.createLoginLink(accountId)).url;
  }

  async listPayouts(accountId: string, limit: number): Promise<ProviderPayout[]> {
    const payouts = await this.stripe.payouts.list({ limit }, { stripeAccount: accountId });
    return payouts.data.map((p) => ({
      id: p.id,
      amount: p.amount,
      currency: p.currency.toUpperCase(),
      status: p.status,
      arrivalDate: new Date(p.arrival_date * 1000),
    }));
  }

  parseWebhook(rawBody: Buffer, headers: IncomingHttpHeaders): ConnectWebhookOutcome {
    const signature = headers['stripe-signature'];
    let event: Stripe.Event;
    try {
      event = this.stripe.webhooks.constructEvent(
        rawBody,
        Array.isArray(signature) ? (signature[0] ?? '') : (signature ?? ''),
        this.webhookSecret,
      );
    } catch (error) {
      throw new InvalidWebhookError(`Invalid Stripe signature: ${String(error)}`);
    }

    switch (event.type) {
      case 'account.updated':
        return {
          kind: 'account_updated',
          eventId: event.id,
          type: event.type,
          account: toAccountState(event.data.object),
        };
      case 'account.application.deauthorized':
        // Connect events carry the connected account id on the event itself.
        if (!event.account) return { kind: 'ignored', eventId: event.id, type: event.type };
        return {
          kind: 'account_deauthorized',
          eventId: event.id,
          type: event.type,
          accountId: event.account,
        };
      default:
        return { kind: 'ignored', eventId: event.id, type: event.type };
    }
  }
}

export function toAccountState(account: Stripe.Account): ConnectedAccountState {
  const due = new Set([
    ...(account.requirements?.past_due ?? []),
    ...(account.requirements?.currently_due ?? []),
  ]);
  return {
    accountId: account.id,
    chargesEnabled: account.charges_enabled ?? false,
    payoutsEnabled: account.payouts_enabled ?? false,
    detailsSubmitted: account.details_submitted ?? false,
    requirementsDue: [...due].sort(),
    disabledReason: account.requirements?.disabled_reason ?? null,
    country: account.country ?? null,
  };
}
