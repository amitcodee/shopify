import type { IncomingHttpHeaders } from 'node:http';
import type Stripe from 'stripe';

export interface StartSubscriptionInput {
  storeId: string;
  planId: string;
  planName: string;
  priceMonthly: number;
  email: string;
  successUrl: string;
  cancelUrl: string;
}

export interface StartSubscriptionResult {
  /** Mock: activate immediately. Stripe: the merchant pays on a hosted page first. */
  activateNow: boolean;
  checkoutUrl: string | null;
  providerRef: string | null;
}

export type BillingWebhookOutcome =
  | { kind: 'activated'; eventId: string; storeId: string; planId: string; providerRef: string }
  | { kind: 'invoice_paid'; eventId: string; providerRef: string; amount: number; currency: string }
  | { kind: 'cancelled'; eventId: string; providerRef: string }
  | { kind: 'ignored'; eventId: string };

/** Port for charging merchants for their platform subscription. */
export interface BillingProvider {
  readonly name: string;
  startSubscription(input: StartSubscriptionInput): Promise<StartSubscriptionResult>;
  parseWebhook(rawBody: Buffer, headers: IncomingHttpHeaders): BillingWebhookOutcome;
}

export const BILLING_PROVIDER = Symbol('BILLING_PROVIDER');

/** Development/test billing: plan changes take effect immediately with a paid invoice. */
export class MockBillingProvider implements BillingProvider {
  readonly name = 'mock';

  startSubscription(): Promise<StartSubscriptionResult> {
    return Promise.resolve({ activateNow: true, checkoutUrl: null, providerRef: null });
  }

  parseWebhook(): BillingWebhookOutcome {
    throw new Error('The mock billing provider does not receive webhooks');
  }
}

/** Stripe Billing via Checkout in subscription mode (test keys in development). */
export class StripeBillingProvider implements BillingProvider {
  readonly name = 'stripe';

  constructor(
    private readonly stripe: Stripe,
    private readonly webhookSecret: string,
  ) {}

  async startSubscription(input: StartSubscriptionInput): Promise<StartSubscriptionResult> {
    const metadata = { storeId: input.storeId, planId: input.planId };
    const session = await this.stripe.checkout.sessions.create({
      mode: 'subscription',
      customer_email: input.email,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'usd',
            unit_amount: input.priceMonthly,
            recurring: { interval: 'month' },
            product_data: { name: `${input.planName} plan` },
          },
        },
      ],
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
      metadata,
      subscription_data: { metadata },
    });
    return { activateNow: false, checkoutUrl: session.url, providerRef: null };
  }

  parseWebhook(rawBody: Buffer, headers: IncomingHttpHeaders): BillingWebhookOutcome {
    const signature = headers['stripe-signature'];
    const event = this.stripe.webhooks.constructEvent(
      rawBody,
      Array.isArray(signature) ? (signature[0] ?? '') : (signature ?? ''),
      this.webhookSecret,
    );
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const subscription =
          typeof session.subscription === 'string'
            ? session.subscription
            : session.subscription?.id;
        if (
          session.mode !== 'subscription' ||
          !subscription ||
          !session.metadata?.storeId ||
          !session.metadata.planId
        ) {
          return { kind: 'ignored', eventId: event.id };
        }
        return {
          kind: 'activated',
          eventId: event.id,
          storeId: session.metadata.storeId,
          planId: session.metadata.planId,
          providerRef: subscription,
        };
      }
      case 'invoice.paid': {
        const invoice = event.data.object;
        const parent = invoice.parent?.subscription_details?.subscription;
        const subscription = typeof parent === 'string' ? parent : parent?.id;
        if (!subscription) return { kind: 'ignored', eventId: event.id };
        return {
          kind: 'invoice_paid',
          eventId: event.id,
          providerRef: subscription,
          amount: invoice.amount_paid,
          currency: invoice.currency.toUpperCase(),
        };
      }
      case 'customer.subscription.deleted':
        return { kind: 'cancelled', eventId: event.id, providerRef: event.data.object.id };
      default:
        return { kind: 'ignored', eventId: event.id };
    }
  }
}
