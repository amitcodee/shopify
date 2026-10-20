import { describe, expect, it } from 'vitest';
import { InvalidWebhookError } from '../src/payments/payment-provider.js';
import { RazorpayClient } from '../src/payments/razorpay/razorpay-client.js';
import { RazorpayConnectProvider } from '../src/payments/razorpay/razorpay-connect.provider.js';
import { RazorpayPaymentProvider } from '../src/payments/razorpay/razorpay-payment.provider.js';
import { FakeRazorpay, RAZORPAY_TEST_SECRET, razorpayWebhook } from './fake-razorpay.js';

function setup() {
  const fake = new FakeRazorpay();
  const client = new RazorpayClient('rzp_test_key', 'secret', fake.fetch);
  return {
    fake,
    payments: new RazorpayPaymentProvider(client, RAZORPAY_TEST_SECRET),
    connect: new RazorpayConnectProvider(client, RAZORPAY_TEST_SECRET),
  };
}

const business = {
  legalBusinessName: 'Chai Traders Pvt Ltd',
  businessType: 'private_limited' as const,
  contactName: 'Asha Rao',
  phone: '9876543210',
  pan: 'ABCDE1234F',
  street1: '12 MG Road',
  city: 'Bengaluru',
  state: 'Karnataka',
  postalCode: '560001',
  accountNumber: '123456789012',
  ifsc: 'HDFC0001234',
  beneficiaryName: 'Chai Traders Pvt Ltd',
};

describe('Razorpay adapters (offline)', () => {
  it('creates a Payment Link whose order transfers the sale minus the fee to the store', async () => {
    const { fake, payments } = setup();
    const created = await payments.createPayment({
      storeId: 's1',
      orderId: '0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b',
      orderNumber: 1001,
      amount: 100_000,
      currency: 'INR',
      email: 'ada@example.com',
      successUrl: 'https://shop.example/orders/x?from=checkout',
      cancelUrl: 'https://shop.example/checkout?cancelled=1',
      idempotencyKey: 'checkout-o1',
      destination: { accountId: 'acc_store1', applicationFee: 2000 },
    });
    expect(created).toEqual({ providerRef: 'plink_test1', checkoutUrl: 'https://rzp.io/i/test1' });
    const request = fake.last('POST', /^\/v1\/payment_links$/);
    expect(request?.headers.authorization).toBe(
      `Basic ${Buffer.from('rzp_test_key:secret').toString('base64')}`,
    );
    expect(request?.body).toMatchObject({
      amount: 100_000,
      currency: 'INR',
      reference_id: '0190a1b2c3d47e5f8a9b0c1d2e3f4a5b',
      callback_url: 'https://shop.example/orders/x?from=checkout',
      options: {
        order: {
          transfers: [{ account: 'acc_store1', amount: 98_000, currency: 'INR', on_hold: false }],
        },
      },
    });
  });

  it('refunds with transfer reversal and an idempotency key', async () => {
    const { fake, payments } = setup();
    const result = await payments.refund({
      providerRef: 'plink_1',
      providerPaymentId: 'pay_123',
      amount: 5000,
      currency: 'INR',
      idempotencyKey: 'refund-r1',
      reverseTransfer: true,
    });
    expect(result).toEqual({ providerRef: 'rfnd_test1', status: 'SUCCEEDED' });
    const request = fake.last('POST', /\/refund$/);
    expect(request?.path).toBe('/v1/payments/pay_123/refund');
    expect(request?.body).toMatchObject({ amount: 5000, reverse_all: 1 });
    expect(request?.headers['x-razorpay-idempotency']).toBe('refund-r1');
  });

  it('parses paid links and disputes; rejects bad signatures', () => {
    const { payments } = setup();
    const paid = razorpayWebhook(
      {
        entity: 'event',
        event: 'payment_link.paid',
        payload: {
          payment_link: { entity: { id: 'plink_9', amount: 4200, currency: 'INR' } },
          payment: { entity: { id: 'pay_9', amount: 4200, currency: 'INR', status: 'captured' } },
        },
      },
      'evt_paid',
    );
    expect(payments.parseWebhook(Buffer.from(paid.body), paid.headers)).toEqual({
      kind: 'payment_succeeded',
      eventId: 'evt_paid',
      type: 'payment_link.paid',
      providerRef: 'plink_9',
      providerPaymentId: 'pay_9',
      amount: 4200,
      currency: 'INR',
    });

    const dispute = razorpayWebhook({
      entity: 'event',
      event: 'payment.dispute.created',
      payload: {
        dispute: {
          entity: {
            id: 'disp_1',
            payment_id: 'pay_9',
            amount: 4200,
            currency: 'INR',
            reason_code: 'chargeback',
            respond_by: 1_800_000_000,
          },
        },
      },
    });
    expect(payments.parseWebhook(Buffer.from(dispute.body), dispute.headers)).toMatchObject({
      kind: 'dispute',
      providerPaymentId: 'pay_9',
      dispute: {
        id: 'disp_1',
        status: 'NEEDS_RESPONSE',
        evidenceDueBy: new Date(1_800_000_000_000),
      },
    });

    expect(() =>
      payments.parseWebhook(Buffer.from(paid.body), {
        ...paid.headers,
        'x-razorpay-signature': 'ab'.repeat(32),
      }),
    ).toThrow(InvalidWebhookError);
  });

  it('onboards a Route linked account in four calls without keeping bank details', async () => {
    const { fake, connect } = setup();
    const created = await connect.createAccount({
      storeId: 's1',
      storeName: 'Chai Co',
      email: 'owner@example.com',
      country: 'IN',
      idempotencyKey: 'connect-account-s1-first',
      business,
    });
    expect(
      fake.requests.map((r) => `${r.method} ${r.path.replace(/acc_test\d+/, 'acc_X')}`),
    ).toEqual([
      'POST /v2/accounts',
      'POST /v2/accounts/acc_X/stakeholders',
      'POST /v2/accounts/acc_X/products',
      'PATCH /v2/accounts/acc_X/products/acc_prd_test1',
    ]);
    expect(fake.requests[0]?.body).toMatchObject({
      type: 'route',
      business_type: 'private_limited',
      legal_info: { pan: 'ABCDE1234F' },
    });
    expect(fake.requests[3]?.body).toMatchObject({
      settlements: { account_number: '123456789012', ifsc_code: 'HDFC0001234' },
      tnc_accepted: true,
    });
    // Only ids come back for storage.
    expect(JSON.stringify(created)).not.toContain('123456789012');
    expect(created.providerData).toEqual({ productId: 'acc_prd_test1' });
    expect(created.state).toMatchObject({ chargesEnabled: false, detailsSubmitted: true });
  });

  it('maps product.route webhooks to account updates', () => {
    const { connect } = setup();
    const activated = razorpayWebhook({
      entity: 'event',
      account_id: 'acc_store1',
      event: 'product.route.activated',
      payload: {
        merchant_product: { entity: { id: 'acc_prd_1', activation_status: 'activated' } },
      },
    });
    expect(connect.parseWebhook(Buffer.from(activated.body), activated.headers)).toMatchObject({
      kind: 'account_updated',
      account: { accountId: 'acc_store1', chargesEnabled: true, payoutsEnabled: true },
    });
    const unrelated = razorpayWebhook({ entity: 'event', event: 'payment.captured', payload: {} });
    expect(connect.parseWebhook(Buffer.from(unrelated.body), unrelated.headers).kind).toBe(
      'ignored',
    );
  });
});
