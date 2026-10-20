import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import type { IncomingHttpHeaders } from 'node:http';
import {
  type CreatedPayment,
  type CreatePaymentInput,
  InvalidWebhookError,
  type PaymentProvider,
  type RefundRequest,
  type RefundResult,
  type WebhookOutcome,
} from './payment-provider.js';

export const MOCK_SIGNATURE_HEADER = 'x-mock-signature';

interface MockEvent {
  id: string;
  type: 'payment.succeeded' | 'payment.failed';
  reference: string;
  amount: number;
  currency: string;
}

/**
 * Sandbox provider for local development and tests. It behaves like a hosted checkout: the
 * shopper is sent to a sandbox page, and the outcome arrives as a *signed webhook* that goes
 * through the same verification, de-duplication and order logic as a real provider.
 */
export class MockPaymentProvider implements PaymentProvider {
  readonly name = 'mock';

  constructor(private readonly secret: string) {}

  createPayment(input: CreatePaymentInput): Promise<CreatedPayment> {
    const providerRef = `mockpay_${randomUUID()}`;
    const origin = new URL(input.successUrl).origin;
    return Promise.resolve({
      providerRef,
      checkoutUrl: `${origin}/checkout/pay/${providerRef}`,
      returnUrl: input.successUrl,
    });
  }

  /** Builds the webhook the sandbox "provider" would send for an outcome. */
  buildWebhook(reference: string, outcome: 'succeed' | 'fail', amount: number, currency: string) {
    const event: MockEvent = {
      id: `evt_${randomUUID()}`,
      type: outcome === 'succeed' ? 'payment.succeeded' : 'payment.failed',
      reference,
      amount,
      currency,
    };
    const body = Buffer.from(JSON.stringify(event));
    return { body, signature: this.sign(body) };
  }

  parseWebhook(rawBody: Buffer, headers: IncomingHttpHeaders): WebhookOutcome {
    const given = headers[MOCK_SIGNATURE_HEADER];
    const signature = Array.isArray(given) ? given[0] : given;
    const expected = Buffer.from(this.sign(rawBody), 'hex');
    const actual = Buffer.from(signature ?? '', 'hex');
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
      throw new InvalidWebhookError('Invalid mock webhook signature');
    }
    const event = JSON.parse(rawBody.toString('utf8')) as MockEvent;
    if (event.type === 'payment.succeeded') {
      return {
        kind: 'payment_succeeded',
        eventId: event.id,
        type: event.type,
        providerRef: event.reference,
        providerPaymentId: `mockcharge_${event.reference}`,
        amount: event.amount,
        currency: event.currency,
      };
    }
    if (event.type === 'payment.failed') {
      return {
        kind: 'payment_failed',
        eventId: event.id,
        type: event.type,
        providerRef: event.reference,
      };
    }
    return { kind: 'ignored', eventId: String(event.id), type: String(event.type) };
  }

  refund(_request: RefundRequest): Promise<RefundResult> {
    return Promise.resolve({ providerRef: `mockrefund_${randomUUID()}`, status: 'SUCCEEDED' });
  }

  private sign(body: Buffer): string {
    return createHmac('sha256', this.secret).update(body).digest('hex');
  }
}
