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

describe('StripePaymentProvider requests (offline)', () => {
  function fakeStripe() {
    const calls: { method: string; params: unknown; options: unknown }[] = [];
    const client = {
      checkout: {
        sessions: {
          create: (params: unknown, options: unknown) => {
            calls.push({ method: 'sessions.create', params, options });
            return Promise.resolve({ id: 'cs_1', url: 'https://checkout.stripe.com/c/cs_1' });
          },
        },
      },
      refunds: {
        create: (params: unknown, options: unknown) => {
          calls.push({ method: 'refunds.create', params, options });
          return Promise.resolve({ id: 're_1', status: 'succeeded' });
        },
      },
    };
    return { calls, provider: new StripePaymentProvider(client as unknown as Stripe, 'whsec_x') };
  }

  it('creates a destination charge to the store account with the platform fee', async () => {
    const { calls, provider: p } = fakeStripe();
    await p.createPayment({
      storeId: 's1',
      orderId: 'o1',
      orderNumber: 1001,
      amount: 10_000,
      currency: 'USD',
      email: 'ada@example.com',
      successUrl: 'https://shop.example/ok',
      cancelUrl: 'https://shop.example/cancel',
      idempotencyKey: 'checkout-o1',
      destination: { accountId: 'acct_123', applicationFee: 200 },
    });
    expect(calls[0]?.params).toMatchObject({
      payment_intent_data: {
        on_behalf_of: 'acct_123',
        transfer_data: { destination: 'acct_123' },
        application_fee_amount: 200,
      },
    });
    expect(calls[0]?.options).toEqual({ idempotencyKey: 'checkout-o1' });
  });

  it('omits a zero fee and reverses the transfer on refunds', async () => {
    const { calls, provider: p } = fakeStripe();
    await p.createPayment({
      storeId: 's1',
      orderId: 'o1',
      orderNumber: 1001,
      amount: 100,
      currency: 'USD',
      email: 'ada@example.com',
      successUrl: 'https://shop.example/ok',
      cancelUrl: 'https://shop.example/cancel',
      idempotencyKey: 'checkout-o1',
      destination: { accountId: 'acct_123', applicationFee: 0 },
    });
    const intent = (calls[0]?.params as { payment_intent_data: object }).payment_intent_data;
    expect(intent).not.toHaveProperty('application_fee_amount');

    await p.refund({
      providerRef: 'cs_1',
      providerPaymentId: 'pi_1',
      amount: 500,
      currency: 'USD',
      idempotencyKey: 'refund-r1',
      reverseTransfer: true,
    });
    expect(calls[1]?.params).toEqual({
      payment_intent: 'pi_1',
      amount: 500,
      reverse_transfer: true,
      refund_application_fee: true,
    });
  });
});
