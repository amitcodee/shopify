import type { IncomingHttpHeaders } from 'node:http';
import Stripe from 'stripe';
import {
  type CreatedPayment,
  type CreatePaymentInput,
  InvalidWebhookError,
  type PaymentProvider,
  type RefundRequest,
  type RefundResult,
  type WebhookOutcome,
} from './payment-provider.js';

/**
 * Stripe Checkout adapter (use test-mode keys in development). Shoppers pay on Stripe's hosted
 * page; the order is marked paid only from a verified `checkout.session.completed` webhook.
 *
 * Sales are Connect destination charges: settled to the store's connected account
 * (`on_behalf_of`, so the merchant is the settlement merchant and their descriptor shows on the
 * statement) minus the plan's platform fee (`application_fee_amount`) — see ADR 0006.
 */
export class StripePaymentProvider implements PaymentProvider {
  readonly name = 'stripe';

  constructor(
    private readonly stripe: Stripe,
    private readonly webhookSecret: string,
  ) {}

  static create(secretKey: string, webhookSecret: string): StripePaymentProvider {
    return new StripePaymentProvider(new Stripe(secretKey), webhookSecret);
  }

  async createPayment(input: CreatePaymentInput): Promise<CreatedPayment> {
    const metadata = {
      orderId: input.orderId,
      storeId: input.storeId,
      orderNumber: String(input.orderNumber),
    };
    const session = await this.stripe.checkout.sessions.create(
      {
        mode: 'payment',
        customer_email: input.email,
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: input.currency.toLowerCase(),
              unit_amount: input.amount,
              product_data: { name: `Order #${input.orderNumber}` },
            },
          },
        ],
        success_url: input.successUrl,
        cancel_url: input.cancelUrl,
        metadata,
        payment_intent_data: {
          metadata,
          on_behalf_of: input.destination.accountId,
          transfer_data: { destination: input.destination.accountId },
          ...(input.destination.applicationFee > 0
            ? { application_fee_amount: input.destination.applicationFee }
            : {}),
        },
      },
      { idempotencyKey: input.idempotencyKey },
    );
    if (!session.url) throw new Error('Stripe did not return a checkout URL');
    return { providerRef: session.id, checkoutUrl: session.url };
  }

  parseWebhook(rawBody: Buffer, headers: IncomingHttpHeaders): WebhookOutcome {
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
      case 'checkout.session.completed':
      case 'checkout.session.async_payment_succeeded': {
        const session = event.data.object;
        if (session.payment_status !== 'paid')
          return { kind: 'ignored', eventId: event.id, type: event.type };
        return {
          kind: 'payment_succeeded',
          eventId: event.id,
          type: event.type,
          providerRef: session.id,
          providerPaymentId:
            typeof session.payment_intent === 'string'
              ? session.payment_intent
              : (session.payment_intent?.id ?? null),
          amount: session.amount_total ?? 0,
          currency: (session.currency ?? '').toUpperCase(),
        };
      }
      case 'checkout.session.expired':
      case 'checkout.session.async_payment_failed':
        return {
          kind: 'payment_failed',
          eventId: event.id,
          type: event.type,
          providerRef: event.data.object.id,
        };
      default:
        return { kind: 'ignored', eventId: event.id, type: event.type };
    }
  }

  async refund(request: RefundRequest): Promise<RefundResult> {
    if (!request.providerPaymentId) throw new Error('Missing Stripe payment intent for refund');
    const refund = await this.stripe.refunds.create(
      {
        payment_intent: request.providerPaymentId,
        amount: request.amount,
        ...(request.reverseTransfer
          ? { reverse_transfer: true, refund_application_fee: true }
          : {}),
      },
      { idempotencyKey: request.idempotencyKey },
    );
    const status =
      refund.status === 'succeeded'
        ? 'SUCCEEDED'
        : refund.status === 'failed' || refund.status === 'canceled'
          ? 'FAILED'
          : 'PENDING';
    return { providerRef: refund.id, status };
  }
}
