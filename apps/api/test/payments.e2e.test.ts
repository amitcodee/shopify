import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { createPrismaClient, withTenant } from '@repo/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CONNECT_PROVIDERS, type ConnectProvider } from '../src/payments/connect-provider.js';
import { type MockConnectProvider } from '../src/payments/mock-connect.provider.js';
import { MOCK_SIGNATURE_HEADER } from '../src/payments/mock-payment.provider.js';
import {
  createStore,
  createTestApp,
  enablePayments,
  payMock,
  resetDatabase,
  signup,
  storefrontClient,
  type TestContext,
} from './utils.js';

const address = {
  name: 'Ada Lovelace',
  line1: '1 Analytical Way',
  city: 'London',
  postalCode: 'N1 1AA',
  country: 'gb',
};

describe('Payments (Connect payout accounts)', () => {
  let ctx: TestContext;
  let connect: MockConnectProvider;

  beforeAll(async () => {
    ctx = await createTestApp();
    await resetDatabase(ctx.owner);
    const providers = (ctx.app as INestApplication).get<Map<string, ConnectProvider>>(
      CONNECT_PROVIDERS,
    );
    connect = providers.get('mock') as MockConnectProvider;
  });

  afterAll(async () => {
    await ctx?.close();
  });

  /** A store without payments, with one product (price 10000) and a storefront client. */
  async function setup() {
    const session = await signup(ctx);
    const store = await createStore(ctx, session.token, { payments: false });
    const auth = { Authorization: `Bearer ${session.token}` };
    const admin = `/api/v1/admin/stores/${store.id}`;
    const product = await ctx
      .http()
      .post(`${admin}/products`)
      .set(auth)
      .send({
        title: 'Chair',
        status: 'ACTIVE',
        variants: [{ price: 10_000, inventoryQuantity: 9 }],
      })
      .expect(201);
    const sf = storefrontClient(ctx, `${store.subdomain}.localhost:3200`);
    return {
      session,
      store,
      auth,
      admin,
      sf,
      variantId: product.body.variants[0].id as string,
    };
  }

  async function checkout(sf: ReturnType<typeof storefrontClient>, variantId: string) {
    const cart = (await sf('post', '/cart').expect(201)).body.token as string;
    await sf('post', '/cart/lines', { cart }).send({ variantId, quantity: 1 }).expect(201);
    return sf('post', '/checkout', { cart }).send({
      email: 'ada@example.com',
      shippingAddress: address,
      idempotencyKey: randomUUID(),
    });
  }

  function connectWebhook(body: Buffer, signature: string) {
    return ctx
      .http()
      .post('/api/v1/webhooks/connect/mock')
      .set('content-type', 'application/json')
      .set(MOCK_SIGNATURE_HEADER, signature)
      .send(body.toString('utf8'));
  }

  it('blocks checkout until onboarding completes, without reserving stock', async () => {
    const { sf, auth, admin, variantId } = await setup();

    const before = await ctx.http().get(`${admin}/payments`).set(auth).expect(200);
    expect(before.body).toMatchObject({
      provider: 'mock',
      sandbox: true,
      account: null,
      acceptingPayments: false,
      transactionFeeBps: 200,
    });
    const blocked = await checkout(sf, variantId);
    expect(blocked.status).toBe(409);
    expect(blocked.body.detail).toBe('This store is not accepting payments yet.');

    const link = await ctx
      .http()
      .post(`${admin}/payments/account`)
      .set(auth)
      .send({ country: 'US' })
      .expect(200);
    expect(link.body.url).toMatch(/\/settings\/payments\/sandbox\?account=acct_mock_/);
    // Connecting again reuses the account instead of creating another.
    const again = await ctx
      .http()
      .post(`${admin}/payments/account`)
      .set(auth)
      .send({ country: 'US' })
      .expect(200);
    expect(again.body.url).toBe(link.body.url);

    const onboarding = await ctx.http().get(`${admin}/payments`).set(auth).expect(200);
    expect(onboarding.body.account).toMatchObject({ status: 'ONBOARDING', chargesEnabled: false });
    expect((await checkout(sf, variantId)).status).toBe(409);

    const preview = await sf('post', '/checkout/preview', {
      cart: (await sf('post', '/cart').expect(201)).body.token as string,
    })
      .send({ country: 'GB' })
      .expect(200);
    expect(preview.body.acceptingPayments).toBe(false);

    const done = await ctx
      .http()
      .post(`${admin}/payments/sandbox-onboarding`)
      .set(auth)
      .send({ outcome: 'complete' })
      .expect(200);
    expect(done.body).toMatchObject({
      acceptingPayments: true,
      account: { status: 'ACTIVE', chargesEnabled: true, payoutsEnabled: true, country: 'US' },
    });
    expect((await checkout(sf, variantId)).status).toBe(201);

    const variant = await ctx.platform.productVariant.findUniqueOrThrow({
      where: { id: variantId },
    });
    expect(variant.inventoryQuantity).toBe(8); // only the successful checkout reserved stock
  });

  it('settles sales to the connected account minus the plan fee, and reverses refunds', async () => {
    const { sf, auth, admin, store, session, variantId } = await setup();
    await enablePayments(ctx, store.id, session.token);
    const account = await ctx.platform.paymentAccount.findUniqueOrThrow({
      where: { storeId: store.id },
    });

    const placed = await checkout(sf, variantId);
    expect(placed.status).toBe(201);
    const payment = await ctx.platform.payment.findFirstOrThrow({ where: { storeId: store.id } });
    // Starter plan: 2% of 10000.
    expect(payment).toMatchObject({ destinationAccountId: account.accountId, applicationFee: 200 });
    await payMock(sf, placed.body.paymentUrl as string);

    const order = (await ctx.http().get(`${admin}/orders`).set(auth).expect(200)).body.items[0];
    await ctx
      .http()
      .post(`${admin}/orders/${order.id}/refunds`)
      .set(auth)
      .send({ amount: 2500 })
      .expect(201);

    const overview = await ctx.http().get(`${admin}/payments`).set(auth).expect(200);
    expect(overview.body.summary).toMatchObject({
      currency: 'USD',
      paidOrders: 1,
      gross: 10_000,
      platformFees: 200,
      refunds: 2500,
      net: 7300,
    });
    expect(overview.body.payouts).toBeNull(); // the sandbox does not report payouts

    await ctx.platform.user.update({
      where: { id: session.user.id },
      data: { platformRole: 'SUPER_ADMIN' },
    });
    const stats = await ctx.http().get('/api/v1/platform/overview').set(auth).expect(200);
    expect(stats.body.fees30d).toEqual(
      expect.arrayContaining([{ currency: 'USD', amount: expect.any(Number) }]),
    );
    expect(stats.body.storesAcceptingPayments).toBeGreaterThanOrEqual(1);
  });

  it('a restricted account cannot take payments until the provider re-enables it', async () => {
    const { sf, store, session, auth, admin, variantId } = await setup();
    await enablePayments(ctx, store.id, session.token, 'restricted');
    const overview = await ctx.http().get(`${admin}/payments`).set(auth).expect(200);
    expect(overview.body.account).toMatchObject({
      status: 'RESTRICTED',
      requirementsDue: ['external_account'],
      disabledReason: 'requirements.past_due',
    });
    expect((await checkout(sf, variantId)).status).toBe(409);

    await ctx
      .http()
      .post(`${admin}/payments/sandbox-onboarding`)
      .set(auth)
      .send({ outcome: 'complete' })
      .expect(200);
    expect((await checkout(sf, variantId)).status).toBe(201);
  });

  it('verifies and de-duplicates Connect webhooks; deauthorization disconnects the store', async () => {
    const { sf, store, session, auth, admin, variantId } = await setup();
    await enablePayments(ctx, store.id, session.token);
    const account = await ctx.platform.paymentAccount.findUniqueOrThrow({
      where: { storeId: store.id },
    });

    const forged = connect.buildAccountWebhook(account.accountId, 'deauthorized', null);
    await connectWebhook(forged.body, 'deadbeef'.repeat(8)).expect(400);
    // A payment-webhook signature is not valid on the Connect endpoint.
    await ctx
      .http()
      .post('/api/v1/webhooks/payments/mock')
      .set('content-type', 'application/json')
      .set(MOCK_SIGNATURE_HEADER, forged.signature)
      .send(forged.body.toString('utf8'))
      .expect(400);

    const hook = connect.buildAccountWebhook(account.accountId, 'deauthorized', null);
    expect((await connectWebhook(hook.body, hook.signature).expect(200)).body).toEqual({
      received: true,
    });
    expect((await connectWebhook(hook.body, hook.signature).expect(200)).body).toEqual({
      received: true,
      duplicate: true,
    });

    const overview = await ctx.http().get(`${admin}/payments`).set(auth).expect(200);
    expect(overview.body).toMatchObject({
      acceptingPayments: false,
      account: { status: 'DISCONNECTED', chargesEnabled: false },
    });
    expect((await checkout(sf, variantId)).status).toBe(409);

    // A late account.updated cannot revive a disconnected account…
    const late = connect.buildAccountWebhook(account.accountId, 'complete', 'US');
    await connectWebhook(late.body, late.signature).expect(200);
    expect(
      (await ctx.http().get(`${admin}/payments`).set(auth).expect(200)).body.account.status,
    ).toBe('DISCONNECTED');

    // …but reconnecting creates a fresh account.
    await enablePayments(ctx, store.id, session.token);
    const fresh = await ctx.platform.paymentAccount.findUniqueOrThrow({
      where: { storeId: store.id },
    });
    expect(fresh.accountId).not.toBe(account.accountId);
    expect(fresh.status).toBe('ACTIVE');
  });

  it('only owners manage payouts, and accounts are isolated per store', async () => {
    const owner = await setup();
    await enablePayments(ctx, owner.store.id, owner.session.token);
    const adminUser = await signup(ctx);
    await ctx.platform.storeMember.create({
      data: { storeId: owner.store.id, userId: adminUser.user.id, role: 'ADMIN' },
    });
    const adminAuth = { Authorization: `Bearer ${adminUser.token}` };

    await ctx.http().get(`${owner.admin}/payments`).set(adminAuth).expect(200);
    for (const path of ['account/onboarding-link', 'account/dashboard-link']) {
      await ctx.http().post(`${owner.admin}/payments/${path}`).set(adminAuth).expect(403);
    }
    await ctx
      .http()
      .post(`${owner.admin}/payments/account`)
      .set(adminAuth)
      .send({ country: 'US' })
      .expect(403);
    await ctx
      .http()
      .post(`${owner.admin}/payments/sandbox-onboarding`)
      .set(adminAuth)
      .send({ outcome: 'restricted' })
      .expect(403);

    const dashboard = await ctx
      .http()
      .post(`${owner.admin}/payments/account/dashboard-link`)
      .set(owner.auth)
      .expect(200);
    expect(dashboard.body.url).toContain(`/s/${owner.store.id}/settings/payments`);

    const other = await setup();
    await ctx.http().get(`${owner.admin}/payments`).set(other.auth).expect(404);
    // Row-level security: the other store's tenant context sees no account rows.
    const appDb = createPrismaClient(process.env.DATABASE_URL ?? '');
    try {
      const visible = await withTenant(appDb, other.store.id, (tx) =>
        tx.paymentAccount.count({ where: { storeId: owner.store.id } }),
      );
      expect(visible).toBe(0);
      expect(await appDb.paymentAccount.count()).toBe(0); // no tenant context: fail closed
    } finally {
      await appDb.$disconnect();
    }
  });

  it('rejects unsupported countries and links before an account exists', async () => {
    const { auth, admin } = await setup();
    await ctx
      .http()
      .post(`${admin}/payments/account`)
      .set(auth)
      .send({ country: 'KP' })
      .expect(400);
    await ctx.http().post(`${admin}/payments/account/onboarding-link`).set(auth).expect(404);
    await ctx.http().post(`${admin}/payments/account/refresh`).set(auth).expect(404);
  });

  it('mirrors chargebacks onto the order, notifies the store, and counts lost ones', async () => {
    const { sf, store, session, auth, admin, variantId } = await setup();
    await enablePayments(ctx, store.id, session.token);
    const placed = await checkout(sf, variantId);
    await payMock(sf, placed.body.paymentUrl as string);
    const orderId = (await ctx.http().get(`${admin}/orders`).set(auth).expect(200)).body.items[0]
      .id as string;
    const dispute = (status: string) =>
      ctx.http().post(`${admin}/payments/sandbox-dispute`).set(auth).send({ orderId, status });

    const opened = await dispute('NEEDS_RESPONSE').expect(200);
    expect(opened.body.openDisputes).toBe(1);
    expect(opened.body.disputes[0]).toMatchObject({
      orderId,
      amount: 10_000,
      status: 'NEEDS_RESPONSE',
      reason: 'fraudulent',
    });
    // The same status twice is one timeline entry.
    await dispute('NEEDS_RESPONSE').expect(200);

    const order = (await ctx.http().get(`${admin}/orders/${orderId}`).set(auth).expect(200)).body;
    expect(order.disputes).toHaveLength(1);
    expect(order.disputes[0].evidenceDueBy).not.toBeNull();
    const events = await ctx.platform.orderEvent.findMany({
      where: { orderId, type: { startsWith: 'dispute_' } },
    });
    expect(events.map((e) => e.type)).toEqual(['dispute_needs_response']);
    const queued = await ctx.platform.outboxMessage.findMany({ where: { tenantId: store.id } });
    expect(
      queued.some((m) => JSON.stringify(m.payload).includes('Chargeback update on order')),
    ).toBe(true);

    const lost = await dispute('LOST').expect(200);
    expect(lost.body.openDisputes).toBe(0);
    expect(lost.body.summary).toMatchObject({ gross: 10_000, chargebacks: 10_000 });
    expect(lost.body.summary.net).toBe(10_000 - 200 - 10_000);

    // Another store cannot dispute (or see) this order.
    const other = await setup();
    await enablePayments(ctx, other.store.id, other.session.token);
    await ctx
      .http()
      .post(`${other.admin}/payments/sandbox-dispute`)
      .set(other.auth)
      .send({ orderId, status: 'WON' })
      .expect(404);
  });
});
