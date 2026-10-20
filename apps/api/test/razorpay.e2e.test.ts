import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createGateways } from '../src/payments/payments.module.js';
import { FakeRazorpay, RAZORPAY_TEST_SECRET, razorpayWebhook } from './fake-razorpay.js';
import {
  createStore,
  createTestApp,
  resetDatabase,
  signup,
  storefrontClient,
  type TestContext,
} from './utils.js';

const business = {
  legalBusinessName: 'Chai Traders Pvt Ltd',
  businessType: 'private_limited',
  contactName: 'Asha Rao',
  phone: '9876543210',
  pan: 'abcde1234f',
  street1: '12 MG Road',
  city: 'Bengaluru',
  state: 'Karnataka',
  postalCode: '560001',
  accountNumber: '123456789012',
  ifsc: 'hdfc0001234',
  beneficiaryName: 'Chai Traders Pvt Ltd',
};

const address = {
  name: 'Asha Rao',
  line1: '12 MG Road',
  city: 'Bengaluru',
  postalCode: '560001',
  country: 'IN',
};

describe('Razorpay gateway (Route + Payment Links) through the API', () => {
  let ctx: TestContext;
  const fake = new FakeRazorpay();

  beforeAll(async () => {
    ctx = await createTestApp({
      gateways: (env) =>
        createGateways(
          {
            ...env,
            PAYMENT_PROVIDERS: ['mock', 'razorpay'],
            RAZORPAY_KEY_ID: 'rzp_test_key',
            RAZORPAY_KEY_SECRET: 'rzp-test-secret',
            RAZORPAY_WEBHOOK_SECRET: RAZORPAY_TEST_SECRET,
          },
          { razorpayFetch: fake.fetch },
        ),
    });
    await resetDatabase(ctx.owner);
  });

  afterAll(async () => {
    await ctx?.close();
  });

  async function inrStore() {
    const session = await signup(ctx);
    const store = await createStore(ctx, session.token, { currency: 'INR', payments: false });
    const auth = { Authorization: `Bearer ${session.token}` };
    const admin = `/api/v1/admin/stores/${store.id}`;
    const product = await ctx
      .http()
      .post(`${admin}/products`)
      .set(auth)
      .send({
        title: 'Masala Chai',
        status: 'ACTIVE',
        variants: [{ price: 50_000, inventoryQuantity: 9 }],
      })
      .expect(201);
    return {
      store,
      auth,
      admin,
      sf: storefrontClient(ctx, `${store.subdomain}.localhost:3200`),
      variantId: product.body.variants[0].id as string,
    };
  }

  function webhook(path: 'payments' | 'connect', event: object) {
    const hook = razorpayWebhook(event);
    return ctx.http().post(`/api/v1/webhooks/${path}/razorpay`).set(hook.headers).send(hook.body);
  }

  async function checkout(sf: ReturnType<typeof storefrontClient>, variantId: string) {
    const cart = (await sf('post', '/cart').expect(201)).body.token as string;
    await sf('post', '/cart/lines', { cart }).send({ variantId, quantity: 1 }).expect(201);
    return sf('post', '/checkout', { cart }).send({
      email: 'buyer@example.com',
      shippingAddress: address,
      idempotencyKey: randomUUID(),
    });
  }

  it('offers Razorpay to INR stores and onboards with details passed through to Razorpay', async () => {
    const { auth, admin, store, sf, variantId } = await inrStore();
    const overview = await ctx.http().get(`${admin}/payments`).set(auth).expect(200);
    expect(overview.body.gateways[0]).toMatchObject({
      provider: 'mock',
      onboarding: 'hosted',
    });
    expect(overview.body.gateways).toContainEqual(
      expect.objectContaining({ provider: 'razorpay', onboarding: 'form', currencies: ['INR'] }),
    );

    const invalid = await ctx
      .http()
      .post(`${admin}/payments/account`)
      .set(auth)
      .send({ provider: 'razorpay', business: { ...business, ifsc: 'NOPE' } })
      .expect(400);
    expect(JSON.stringify(invalid.body)).toContain('IFSC');

    const connected = await ctx
      .http()
      .post(`${admin}/payments/account`)
      .set(auth)
      .send({ provider: 'razorpay', business })
      .expect(200);
    expect(connected.body).toEqual({ url: null });
    expect(fake.last('POST', /^\/v2\/accounts$/)?.body).toMatchObject({
      legal_info: { pan: 'ABCDE1234F' },
    });

    const row = await ctx.platform.paymentAccount.findUniqueOrThrow({
      where: { storeId: store.id },
    });
    expect(row).toMatchObject({
      provider: 'razorpay',
      status: 'ONBOARDING',
      detailsSubmitted: true,
    });
    // Bank details went to Razorpay only.
    expect(JSON.stringify(row)).not.toContain('123456789012');
    expect((await checkout(sf, variantId)).status).toBe(409);

    // Razorpay activates the linked account.
    await webhook('connect', {
      entity: 'event',
      account_id: row.accountId,
      event: 'product.route.activated',
      payload: {
        merchant_product: { entity: { id: 'acc_prd_test1', activation_status: 'activated' } },
      },
    }).expect(200);
    const active = await ctx.http().get(`${admin}/payments`).set(auth).expect(200);
    expect(active.body).toMatchObject({
      acceptingPayments: true,
      sandbox: false,
      account: { provider: 'razorpay', label: 'Razorpay', status: 'ACTIVE', hasDashboard: false },
    });
    await ctx.http().post(`${admin}/payments/account/dashboard-link`).set(auth).expect(404);
  });

  it('checks out on a Payment Link with a Route transfer, then refunds and disputes', async () => {
    const { auth, admin, store, sf, variantId } = await inrStore();
    fake.productStatus = 'activated';
    await ctx
      .http()
      .post(`${admin}/payments/account`)
      .set(auth)
      .send({ provider: 'razorpay', business })
      .expect(200);
    const account = await ctx.platform.paymentAccount.findUniqueOrThrow({
      where: { storeId: store.id },
    });
    expect(account.status).toBe('ACTIVE');

    const placed = await checkout(sf, variantId);
    expect(placed.status).toBe(201);
    expect(placed.body.paymentUrl).toMatch(/^https:\/\/rzp\.io\/i\/test/);
    const link = fake.last('POST', /^\/v1\/payment_links$/);
    // ₹500.00, Starter plan 2% fee → ₹490.00 to the store.
    expect(link?.body).toMatchObject({
      amount: 50_000,
      currency: 'INR',
      options: { order: { transfers: [{ account: account.accountId, amount: 49_000 }] } },
    });
    const payment = await ctx.platform.payment.findFirstOrThrow({ where: { storeId: store.id } });
    expect(payment).toMatchObject({ provider: 'razorpay', applicationFee: 1000 });

    const paid = {
      entity: 'event',
      event: 'payment_link.paid',
      payload: {
        payment_link: { entity: { id: payment.providerRef, amount: 50_000, currency: 'INR' } },
        payment: { entity: { id: 'pay_rzp1', amount: 50_000, currency: 'INR' } },
      },
    };
    await webhook('payments', paid).expect(200);
    const order = (await ctx.http().get(`${admin}/orders`).set(auth).expect(200)).body.items[0];
    expect(order).toMatchObject({ financialStatus: 'PAID', status: 'OPEN' });

    await ctx
      .http()
      .post(`${admin}/orders/${order.id}/refunds`)
      .set(auth)
      .send({ amount: 10_000 })
      .expect(201);
    expect(fake.last('POST', /\/refund$/)).toMatchObject({
      path: '/v1/payments/pay_rzp1/refund',
      body: { amount: 10_000, reverse_all: 1 },
    });

    await webhook('payments', {
      entity: 'event',
      event: 'payment.dispute.created',
      payload: {
        dispute: {
          entity: {
            id: 'disp_rzp1',
            payment_id: 'pay_rzp1',
            amount: 40_000,
            currency: 'INR',
            reason_code: 'fraud',
          },
        },
      },
    }).expect(200);
    const detail = (await ctx.http().get(`${admin}/orders/${order.id}`).set(auth).expect(200)).body;
    expect(detail.disputes).toEqual([
      expect.objectContaining({ amount: 40_000, status: 'NEEDS_RESPONSE', reason: 'fraud' }),
    ]);
  });

  it('keeps one gateway per store, rejects mismatched currencies, and allows switching', async () => {
    const usd = await signup(ctx);
    const usdStore = await createStore(ctx, usd.token, { payments: false });
    await ctx
      .http()
      .post(`/api/v1/admin/stores/${usdStore.id}/payments/account`)
      .set({ Authorization: `Bearer ${usd.token}` })
      .send({ provider: 'razorpay', business })
      .expect(400);

    const { auth, admin, store } = await inrStore();
    await ctx
      .http()
      .post(`${admin}/payments/account`)
      .set(auth)
      .send({ provider: 'razorpay', business })
      .expect(200);
    await ctx
      .http()
      .post(`${admin}/payments/account`)
      .set(auth)
      .send({ provider: 'mock', country: 'US' })
      .expect(409);

    await ctx.http().post(`${admin}/payments/account/disconnect`).set(auth).expect(204);
    const link = await ctx
      .http()
      .post(`${admin}/payments/account`)
      .set(auth)
      .send({ provider: 'mock', country: 'US' })
      .expect(200);
    expect(link.body.url).toContain('/settings/payments/sandbox');
    const row = await ctx.platform.paymentAccount.findUniqueOrThrow({
      where: { storeId: store.id },
    });
    expect(row).toMatchObject({ provider: 'mock', status: 'ONBOARDING' });
    const audit = await ctx.platform.auditLog.findMany({
      where: { storeId: store.id, action: { startsWith: 'payments.' } },
      orderBy: { createdAt: 'asc' },
    });
    expect(audit.map((a) => a.action)).toEqual([
      'payments.account_created',
      'payments.account_disconnected',
      'payments.account_created',
    ]);
  });

  it('rejects unsigned Razorpay webhooks', async () => {
    const hook = razorpayWebhook({ entity: 'event', event: 'payment_link.paid', payload: {} });
    await ctx
      .http()
      .post('/api/v1/webhooks/payments/razorpay')
      .set({ ...hook.headers, 'x-razorpay-signature': '00'.repeat(32) })
      .send(hook.body)
      .expect(400);
  });
});
