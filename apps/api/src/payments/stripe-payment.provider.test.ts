import Stripe from 'stripe';
import { describe, expect, it } from 'vitest';
import { InvalidWebhookError } from './payment-provider.js';
import { StripePaymentProvider } from './stripe-payment.provider.js';

const WEBHOOK_SECRET = 'whsec_test_secret_for_unit_tests';
const stripe = new Stripe('sk_test_dummy');
const provider = new StripePaymentProvider(stripe, WEBHOOK_SECRET);

function signedEvent(event: object) {
  const payload = JSON.stringify(event);
  const header = stripe.webhooks.generateTestHeaderString({ payload, secret: WEBHOOK_SECRET });
  return { body: Buffer.from(payload), headers: { 'stripe-signature': header } };
}

describe('StripePaymentProvider.parseWebhook (offline)', () => {
  it('maps a paid checkout session to payment_succeeded', () => {
    const { body, headers } = signedEvent({
      id: 'evt_1',
      object: 'event',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test_123',
          object: 'checkout.session',
          payment_status: 'paid',
          amount_total: 4200,
          currency: 'usd',
          payment_intent: 'pi_123',
        },
      },
    });
    expect(provider.parseWebhook(body, headers)).toEqual({
      kind: 'payment_succeeded',
      eventId: 'evt_1',
      type: 'checkout.session.completed',
      providerRef: 'cs_test_123',
      providerPaymentId: 'pi_123',
      amount: 4200,
      currency: 'USD',
    });
  });

  it('maps expired sessions to payment_failed and ignores unrelated events', () => {
    const expired = signedEvent({
      id: 'evt_2',
      object: 'event',
      type: 'checkout.session.expired',
      data: { object: { id: 'cs_test_9', object: 'checkout.session' } },
    });
    expect(provider.parseWebhook(expired.body, expired.headers)).toMatchObject({
      kind: 'payment_failed',
      providerRef: 'cs_test_9',
    });
    const other = signedEvent({
      id: 'evt_3',
      object: 'event',
      type: 'customer.created',
      data: { object: {} },
    });
    expect(provider.parseWebhook(other.body, other.headers).kind).toBe('ignored');
  });

  it('rejects tampered payloads', () => {
    const { headers } = signedEvent({
      id: 'evt_4',
      object: 'event',
      type: 'x',
      data: { object: {} },
    });
    expect(() => provider.parseWebhook(Buffer.from('{"id":"evt_forged"}'), headers)).toThrow(
      InvalidWebhookError,
    );
  });
});
