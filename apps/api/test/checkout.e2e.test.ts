import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { EMAIL_SENDER, type MemoryEmailSender } from '../src/email/email.js';
import { OrderLifecycle } from '../src/orders/order-lifecycle.service.js';
import { OutboxProcessor } from '../src/outbox/outbox.service.js';
import {
  MOCK_SIGNATURE_HEADER,
  MockPaymentProvider,
} from '../src/payments/mock-payment.provider.js';
import {
  createTestApp,
  merchantWithStore,
  resetDatabase,
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

describe('Checkout, payments & orders', () => {
  let ctx: TestContext;
  let mailbox: MemoryEmailSender;
  let outbox: OutboxProcessor;
  let lifecycle: OrderLifecycle;

  beforeAll(async () => {
    ctx = await createTestApp();
    await resetDatabase(ctx.owner);
    const app = ctx.app as INestApplication;
    mailbox = app.get(EMAIL_SENDER);
    outbox = app.get(OutboxProcessor);
    lifecycle = app.get(OrderLifecycle);
  });

  afterAll(async () => {
    await ctx?.close();
  });

  beforeEach(() => {
    mailbox.sent.length = 0;
  });

  /** A store with one tracked product (stock 5) and an open storefront client. */
  async function setup(stock = 5, price = 2500) {
    const merchant = await merchantWithStore(ctx);
    // Deliver queued sign-up verification emails so tests see only their own messages.
    while ((await outbox.processBatch()) > 0);
    mailbox.sent.length = 0;
    const host = `${merchant.store.subdomain}.localhost:3200`;
    const sf = storefrontClient(ctx, host);
    const product = await ctx
      .http()
      .post(`/api/v1/admin/stores/${merchant.store.id}/products`)
      .set(merchant.auth)
      .send({
        title: 'Lamp',
        status: 'ACTIVE',
        variants: [{ price, inventoryQuantity: stock, sku: 'LAMP' }],
      })
      .expect(201);
    const variantId = product.body.variants[0].id as string;
    return { merchant, host, sf, variantId, admin: `/api/v1/admin/stores/${merchant.store.id}` };
  }

  async function cartWith(
    sf: ReturnType<typeof storefrontClient>,
    variantId: string,
    quantity: number,
  ) {
    const cart = (await sf('post', '/cart').expect(201)).body.token as string;
    await sf('post', '/cart/lines', { cart }).send({ variantId, quantity }).expect(201);
    return cart;
  }

  function checkout(sf: ReturnType<typeof storefrontClient>, cart: string, extra: object = {}) {
    return sf('post', '/checkout', { cart }).send({
      email: 'ada@example.com',
      shippingAddress: address,
      idempotencyKey: randomUUID(),
      ...extra,
    });
  }

  async function pay(
    sf: ReturnType<typeof storefrontClient>,
    paymentUrl: string,
    outcome: 'succeed' | 'fail' = 'succeed',
  ) {
    const reference = paymentUrl.split('/checkout/pay/')[1] ?? '';
    return sf('post', `/checkout/mock-payments/${reference}`).send({ outcome }).expect(200);
  }

  it('previews totals and places an order that reserves stock and opens a sandbox payment', async () => {
    const { sf, host, variantId, merchant, admin } = await setup();
    const cart = await cartWith(sf, variantId, 2);

    const preview = await sf('post', '/checkout/preview', { cart })
      .send({ country: 'GB' })
      .expect(200);
    expect(preview.body).toMatchObject({
      subtotal: 5000,
      shippingTotal: 0,
      total: 5000,
      shippingOptions: [{ id: 'free-standard' }],
    });

    const placed = await checkout(sf, cart).expect(201);
    expect(placed.body.orderNumber).toBe(1001);
    expect(placed.body.paymentUrl).toMatch(new RegExp(`^http://${host}/checkout/pay/mockpay_`));

    const variant = await ctx.platform.productVariant.findUniqueOrThrow({
      where: { id: variantId },
    });
    expect(variant.inventoryQuantity).toBe(3);

    const orders = await ctx.http().get(`${admin}/orders`).set(merchant.auth).expect(200);
    expect(orders.body.items[0]).toMatchObject({
      number: 1001,
      status: 'PENDING_PAYMENT',
      financialStatus: 'PENDING',
      total: 5000,
      itemCount: 2,
    });
  });

  it('is idempotent: retrying with the same key returns the same payment and no new order', async () => {
    const { sf, variantId, merchant } = await setup();
    const cart = await cartWith(sf, variantId, 1);
    const key = randomUUID();
    const first = await checkout(sf, cart, { idempotencyKey: key }).expect(201);
    const second = await checkout(sf, cart, { idempotencyKey: key }).expect(201);
    expect(second.body).toEqual(first.body);
    expect(await ctx.platform.order.count({ where: { storeId: merchant.store.id } })).toBe(1);

    // Someone else replaying the key (different cart) does not get the payment link.
    const otherCart = await cartWith(sf, variantId, 1);
    const replay = await checkout(sf, otherCart, { idempotencyKey: key }).expect(409);
    expect(JSON.stringify(replay.body)).not.toContain('mockpay_');
  });

  it('limits how many unpaid orders one email can hold', async () => {
    const { sf, variantId } = await setup(10);
    for (let i = 0; i < 3; i++) {
      await checkout(sf, await cartWith(sf, variantId, 1)).expect(201);
    }
    const blocked = await checkout(sf, await cartWith(sf, variantId, 1)).expect(429);
    expect(blocked.body.detail).toMatch(/unpaid orders/);
  });

  it('marks the order paid from the signed webhook, empties the cart, and emails both parties', async () => {
    const { sf, host, variantId, merchant, admin } = await setup();
    const cart = await cartWith(sf, variantId, 1);
    const placed = await checkout(sf, cart).expect(201);

    const payment = await pay(sf, placed.body.paymentUrl);
    expect(payment.body.status).toBe('SUCCEEDED');
    const statusUrl = payment.body.returnUrl as string;
    expect(statusUrl).toMatch(new RegExp(`^http://${host}/orders/`));

    const order = (await ctx.http().get(`${admin}/orders`).set(merchant.auth).expect(200)).body
      .items[0];
    expect(order).toMatchObject({ status: 'OPEN', financialStatus: 'PAID' });
    await sf('get', '/cart', { cart }).expect(404);

    expect(await outbox.processBatch()).toBe(2);
    const subjects = mailbox.sent.map((m) => m.subject).sort();
    expect(subjects).toEqual(
      [`Order #1001 confirmed`, expect.stringContaining('New order #1001')].sort(),
    );
    const confirmation = mailbox.sent.find((m) => m.to === 'ada@example.com');
    expect(confirmation?.text).toContain('/orders/');

    // The order-status link works on this store's host only.
    const token = new URL(statusUrl).pathname.split('/orders/')[1] ?? '';
    const status = await sf('get', `/orders/${token}`).expect(200);
    expect(status.body).toMatchObject({
      number: 1001,
      financialStatus: 'PAID',
      lines: [{ title: 'Lamp', quantity: 1 }],
    });
    expect(JSON.stringify(status.body)).not.toContain('ada@example.com');
    await sf('get', `/orders/${token.slice(0, -2)}xx`).expect(404);
    const other = await setup();
    await other.sf('get', `/orders/${token}`).expect(404);
  });

  it('webhooks: rejects bad signatures, ignores duplicates, and refuses mismatched amounts', async () => {
    const { sf, variantId, merchant } = await setup();
    const cart = await cartWith(sf, variantId, 1);
    const placed = await checkout(sf, cart).expect(201);
    const reference = placed.body.paymentUrl.split('/checkout/pay/')[1];

    await ctx
      .http()
      .post('/api/v1/webhooks/payments/mock')
      .set(MOCK_SIGNATURE_HEADER, 'deadbeef')
      .set('content-type', 'application/json')
      .send({ id: 'evt_x', type: 'payment.succeeded', reference, amount: 2500, currency: 'USD' })
      .expect(400);

    const provider = new MockPaymentProvider(
      process.env.MOCK_PAYMENT_WEBHOOK_SECRET ?? 'mock-sandbox-webhook-secret',
    );
    const tampered = provider.buildWebhook(reference, 'succeed', 1, 'USD');
    const sent = await ctx
      .http()
      .post('/api/v1/webhooks/payments/mock')
      .set(MOCK_SIGNATURE_HEADER, tampered.signature)
      .set('content-type', 'application/json')
      .send(tampered.body.toString())
      .expect(200);
    expect(sent.body).toEqual({ received: true });
    const duplicate = await ctx
      .http()
      .post('/api/v1/webhooks/payments/mock')
      .set(MOCK_SIGNATURE_HEADER, tampered.signature)
      .set('content-type', 'application/json')
      .send(tampered.body.toString())
      .expect(200);
    expect(duplicate.body).toEqual({ received: true, duplicate: true });

    const order = await ctx.platform.order.findFirstOrThrow({
      where: { storeId: merchant.store.id },
      include: { payments: true, events: true },
    });
    expect(order.financialStatus).toBe('PENDING');
    expect(order.payments[0]?.status).toBe('FAILED');
    expect(order.events.map((e) => e.type)).toContain('payment_mismatch');
  });

  it('a declined payment cancels the order and releases stock', async () => {
    const { sf, variantId } = await setup(5);
    const cart = await cartWith(sf, variantId, 2);
    const placed = await checkout(sf, cart).expect(201);
    await pay(sf, placed.body.paymentUrl, 'fail');

    const order = await ctx.platform.order.findFirstOrThrow({
      where: { number: 1001, cartId: { not: null } },
      orderBy: { createdAt: 'desc' },
    });
    expect(order).toMatchObject({
      status: 'CANCELLED',
      financialStatus: 'VOIDED',
      cancelReason: 'payment_failed',
    });
    const variant = await ctx.platform.productVariant.findUniqueOrThrow({
      where: { id: variantId },
    });
    expect(variant.inventoryQuantity).toBe(5);
    // Cart is kept so the shopper can try again.
    await sf('get', '/cart', { cart }).expect(200);
  });

  it('never oversells when two shoppers race for the last unit', async () => {
    const { sf, variantId, merchant } = await setup(1);
    const cartA = await cartWith(sf, variantId, 1);
    const cartB = await cartWith(sf, variantId, 1);
    const results = await Promise.all([checkout(sf, cartA), checkout(sf, cartB)]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    const variant = await ctx.platform.productVariant.findUniqueOrThrow({
      where: { id: variantId },
    });
    expect(variant.inventoryQuantity).toBe(0);
    expect(await ctx.platform.order.count({ where: { storeId: merchant.store.id } })).toBe(1);
  });

  it('expires unpaid orders and restarting checkout does not hold stock twice', async () => {
    const { sf, variantId, merchant } = await setup(3);
    const cart = await cartWith(sf, variantId, 2);
    await checkout(sf, cart).expect(201);
    await checkout(sf, cart).expect(201); // new key: supersedes the first pending order
    let variant = await ctx.platform.productVariant.findUniqueOrThrow({ where: { id: variantId } });
    expect(variant.inventoryQuantity).toBe(1);

    await ctx.platform.order.updateMany({
      where: { storeId: merchant.store.id, status: 'PENDING_PAYMENT' },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    expect(await lifecycle.expireStaleOrders()).toBeGreaterThanOrEqual(1);
    variant = await ctx.platform.productVariant.findUniqueOrThrow({ where: { id: variantId } });
    expect(variant.inventoryQuantity).toBe(3);
    const statuses = await ctx.platform.order.findMany({
      where: { storeId: merchant.store.id },
      select: { status: true, cancelReason: true },
    });
    expect(statuses.every((o) => o.status === 'CANCELLED')).toBe(true);
    expect(statuses.map((o) => o.cancelReason).sort()).toEqual(['payment_timeout', 'superseded']);
  });

  it('admin fulfils, partially refunds with restock, then fully refunds', async () => {
    const { sf, variantId, merchant, admin } = await setup(5, 1000);
    const cart = await cartWith(sf, variantId, 3);
    const placed = await checkout(sf, cart).expect(201);
    await pay(sf, placed.body.paymentUrl);
    const orderId = (await ctx.http().get(`${admin}/orders`).set(merchant.auth).expect(200)).body
      .items[0].id as string;
    const url = `${admin}/orders/${orderId}`;

    const fulfilled = await ctx
      .http()
      .post(`${url}/fulfillments`)
      .set(merchant.auth)
      .send({ trackingCompany: 'UPS', trackingNumber: '1Z999' })
      .expect(201);
    expect(fulfilled.body.fulfillmentStatus).toBe('FULFILLED');
    await ctx.http().post(`${url}/fulfillments`).set(merchant.auth).send({}).expect(409);

    const lineId = fulfilled.body.lines[0].id as string;
    const partial = await ctx
      .http()
      .post(`${url}/refunds`)
      .set(merchant.auth)
      .send({ amount: 1000, reason: 'Damaged', restock: [{ lineId, quantity: 1 }] })
      .expect(201);
    expect(partial.body).toMatchObject({
      financialStatus: 'PARTIALLY_REFUNDED',
      refundableAmount: 2000,
    });
    expect(
      (await ctx.platform.productVariant.findUniqueOrThrow({ where: { id: variantId } }))
        .inventoryQuantity,
    ).toBe(3);

    await ctx.http().post(`${url}/refunds`).set(merchant.auth).send({ amount: 2001 }).expect(400);
    await ctx
      .http()
      .post(`${url}/refunds`)
      .set(merchant.auth)
      .send({ amount: 1, restock: [{ lineId, quantity: 3 }] })
      .expect(400);

    const full = await ctx
      .http()
      .post(`${url}/refunds`)
      .set(merchant.auth)
      .send({ amount: 2000 })
      .expect(201);
    expect(full.body).toMatchObject({ financialStatus: 'REFUNDED', refundableAmount: 0 });
    expect(full.body.events.map((e: { type: string }) => e.type)).toEqual(
      expect.arrayContaining(['placed', 'paid', 'fulfilled', 'refunded']),
    );

    await outbox.processBatch();
    expect(mailbox.sent.map((m) => m.subject)).toEqual(
      expect.arrayContaining(['Order #1001 is on its way', 'Refund for order #1001']),
    );
  });

  it('cancelling a paid order refunds it and restocks', async () => {
    const { sf, variantId, merchant, admin } = await setup(5, 1500);
    const cart = await cartWith(sf, variantId, 2);
    const placed = await checkout(sf, cart).expect(201);
    await pay(sf, placed.body.paymentUrl);
    const orderId = (await ctx.http().get(`${admin}/orders`).set(merchant.auth).expect(200)).body
      .items[0].id as string;

    const cancelled = await ctx
      .http()
      .post(`${admin}/orders/${orderId}/cancel`)
      .set(merchant.auth)
      .send({ reason: 'CUSTOMER' })
      .expect(201);
    expect(cancelled.body).toMatchObject({ status: 'CANCELLED', financialStatus: 'REFUNDED' });
    expect(
      (await ctx.platform.productVariant.findUniqueOrThrow({ where: { id: variantId } }))
        .inventoryQuantity,
    ).toBe(5);
  });

  it('isolates orders between stores and enforces order permissions', async () => {
    const a = await setup();
    const b = await setup();
    const cart = await cartWith(a.sf, a.variantId, 1);
    await checkout(a.sf, cart).expect(201);
    const orderId = (await ctx.http().get(`${a.admin}/orders`).set(a.merchant.auth).expect(200))
      .body.items[0].id as string;

    await ctx.http().get(`${a.admin}/orders/${orderId}`).set(b.merchant.auth).expect(404);
    await ctx.http().get(`${b.admin}/orders/${orderId}`).set(b.merchant.auth).expect(404);
    await ctx
      .http()
      .post(`${b.admin}/orders/${orderId}/refunds`)
      .set(b.merchant.auth)
      .send({ amount: 1 })
      .expect(404);
    await b
      .sf('post', '/checkout', { cart })
      .send({ email: 'x@example.com', shippingAddress: address, idempotencyKey: randomUUID() })
      .expect(404);

    const viewer = await merchantWithStore(ctx);
    await ctx.platform.storeMember.create({
      data: {
        storeId: a.merchant.store.id,
        userId: viewer.session.user.id,
        role: 'STAFF',
        permissions: ['orders:read'],
      },
    });
    await ctx.http().get(`${a.admin}/orders/${orderId}`).set(viewer.auth).expect(200);
    await ctx
      .http()
      .post(`${a.admin}/orders/${orderId}/cancel`)
      .set(viewer.auth)
      .send({})
      .expect(403);
  });

  it('customer accounts: register, sign in, see own orders; guests must verify email first', async () => {
    const { sf, variantId, host } = await setup();
    const registered = await sf('post', '/customers/register')
      .send({ name: 'Grace', email: 'grace@example.com', password: 'grace-password-123' })
      .expect(201);
    expect(registered.body.status).toBe('created');
    const customer = registered.body.session.token as string;

    const cart = await cartWith(sf, variantId, 1);
    const placed = await sf('post', '/checkout', { cart, customer })
      .send({
        email: 'ignored@example.com',
        shippingAddress: address,
        idempotencyKey: randomUUID(),
      })
      .expect(201);
    await pay(sf, placed.body.paymentUrl);
    const me = await sf('get', '/customers/me', { customer }).expect(200);
    expect(me.body).toMatchObject({
      email: 'grace@example.com',
      orders: [{ number: placed.body.orderNumber, financialStatus: 'PAID' }],
    });
    await sf('get', `/customers/me/orders/${placed.body.orderNumber}`, { customer }).expect(200);

    // Duplicate registration is refused; wrong password is generic.
    await sf('post', '/customers/register')
      .send({ name: 'G', email: 'grace@example.com', password: 'another-password-1' })
      .expect(409);
    const bad = await sf('post', '/customers/login')
      .send({ email: 'grace@example.com', password: 'nope-nope-nope' })
      .expect(401);
    expect(bad.body.detail).toBe('Invalid email or password.');

    // A guest (from checkout) cannot be claimed without the emailed activation link.
    const guestCart = await cartWith(sf, variantId, 1);
    await checkout(sf, guestCart).expect(201); // creates guest ada@example.com
    const claim = await sf('post', '/customers/register')
      .send({ name: 'Mallory', email: 'ada@example.com', password: 'mallory-password-1' })
      .expect(201);
    expect(claim.body).toEqual({ status: 'activation_sent' });
    await sf('post', '/customers/login')
      .send({ email: 'ada@example.com', password: 'mallory-password-1' })
      .expect(401);

    await outbox.processBatch();
    const activation = mailbox.sent.find((m) => m.subject.startsWith('Activate your'));
    const link = /\/account\/activate\/([\w-]+)/.exec(activation?.text ?? '')?.[1] ?? '';
    expect(activation?.text).toContain(`http://${host}/account/activate/`);
    const activated = await sf('post', '/customers/activate')
      .send({ token: link, password: 'ada-real-password-1' })
      .expect(200);
    await sf('get', '/customers/me', { customer: activated.body.token }).expect(200);
    await sf('post', '/customers/activate')
      .send({ token: link, password: 'ada-real-password-2' })
      .expect(404);

    // Password reset: always 202; the link works once and revokes old sessions.
    await sf('post', '/customers/password-reset').send({ email: 'nobody@example.com' }).expect(202);
    await sf('post', '/customers/password-reset').send({ email: 'grace@example.com' }).expect(202);
    await outbox.processBatch();
    const reset = mailbox.sent.find((m) => m.subject.startsWith('Reset your'));
    const resetToken = /\/account\/reset\/([\w-]+)/.exec(reset?.text ?? '')?.[1] ?? '';
    await sf('post', '/customers/reset')
      .send({ token: resetToken, password: 'grace-new-password-1' })
      .expect(200);
    await sf('get', '/customers/me', { customer }).expect(401);

    // Accounts are per store.
    const other = await setup();
    await other
      .sf('post', '/customers/login')
      .send({ email: 'grace@example.com', password: 'grace-new-password-1' })
      .expect(401);
  });

  it('reports analytics from paid orders net of refunds', async () => {
    const { sf, variantId, merchant, admin } = await setup(10, 2000);
    for (const qty of [1, 2]) {
      const cart = await cartWith(sf, variantId, qty);
      const placed = await checkout(sf, cart).expect(201);
      await pay(sf, placed.body.paymentUrl);
    }
    const unpaid = await cartWith(sf, variantId, 1);
    await checkout(sf, unpaid).expect(201);
    const orderId = (
      await ctx
        .http()
        .get(`${admin}/orders`)
        .query({ financialStatus: 'PAID' })
        .set(merchant.auth)
        .expect(200)
    ).body.items[0].id as string;
    await ctx
      .http()
      .post(`${admin}/orders/${orderId}/refunds`)
      .set(merchant.auth)
      .send({ amount: 500 })
      .expect(201);

    const stats = await ctx
      .http()
      .get(`${admin}/analytics`)
      .query({ days: 7 })
      .set(merchant.auth)
      .expect(200);
    expect(stats.body).toMatchObject({
      grossSales: 6000,
      refunded: 500,
      netSales: 5500,
      orderCount: 2,
      averageOrderValue: 3000,
      topProducts: [{ title: 'Lamp', quantity: 3, revenue: 6000 }],
    });
    expect(stats.body.daily.at(-1)).toMatchObject({ sales: 6000, orders: 2 });
  });
});
