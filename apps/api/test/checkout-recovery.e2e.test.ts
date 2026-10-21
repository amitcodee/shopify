import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { CheckoutRecoveryService } from '../src/checkout/checkout-recovery.service.js';
import { EMAIL_SENDER, type MemoryEmailSender } from '../src/email/email.js';
import { OrderLifecycle } from '../src/orders/order-lifecycle.service.js';
import { OutboxProcessor } from '../src/outbox/outbox.service.js';
import {
  createTestApp,
  merchantWithStore,
  payMock,
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

describe('Abandoned checkout recovery', () => {
  let ctx: TestContext;
  let mailbox: MemoryEmailSender;
  let outbox: OutboxProcessor;
  let lifecycle: OrderLifecycle;
  let recovery: CheckoutRecoveryService;

  beforeAll(async () => {
    ctx = await createTestApp();
    await resetDatabase(ctx.owner);
    const app = ctx.app as INestApplication;
    mailbox = app.get(EMAIL_SENDER);
    outbox = app.get(OutboxProcessor);
    lifecycle = app.get(OrderLifecycle);
    recovery = app.get(CheckoutRecoveryService);
  });

  afterAll(async () => {
    await ctx?.close();
  });

  beforeEach(() => {
    mailbox.sent.length = 0;
  });

  async function setup(stock = 5) {
    const merchant = await merchantWithStore(ctx);
    while ((await outbox.processBatch()) > 0);
    mailbox.sent.length = 0;
    const sf = storefrontClient(ctx, `${merchant.store.subdomain}.localhost:3200`);
    const admin = `/api/v1/admin/stores/${merchant.store.id}`;
    const product = await ctx
      .http()
      .post(`${admin}/products`)
      .set(merchant.auth)
      .send({
        title: 'Lamp',
        status: 'ACTIVE',
        variants: [{ price: 2500, inventoryQuantity: stock }],
      })
      .expect(201);
    return { merchant, sf, admin, variantId: product.body.variants[0].id as string };
  }

  /** Checks out `quantity` lamps as `email` and lets the order expire unpaid `hoursAgo`. */
  async function abandon(
    s: Awaited<ReturnType<typeof setup>>,
    email: string,
    { quantity = 2, hoursAgo = 11 } = {},
  ) {
    const cart = (await s.sf('post', '/cart').expect(201)).body.token as string;
    await s
      .sf('post', '/cart/lines', { cart })
      .send({ variantId: s.variantId, quantity })
      .expect(201);
    const placed = await s
      .sf('post', '/checkout', { cart })
      .send({ email, shippingAddress: address, idempotencyKey: randomUUID() })
      .expect(201);
    const { id: orderId } = await ctx.platform.order.findFirstOrThrow({
      where: { storeId: s.merchant.store.id, number: placed.body.orderNumber },
    });
    await ctx.platform.order.update({
      where: { id: orderId },
      data: {
        expiresAt: new Date(Date.now() - 1000),
        createdAt: new Date(Date.now() - hoursAgo * 60 * 60 * 1000),
      },
    });
    await lifecycle.expireStaleOrders();
    return { orderId, cart, paymentUrl: placed.body.paymentUrl as string };
  }

  async function deliver() {
    while ((await outbox.processBatch()) > 0);
    return mailbox.sent.filter((m) => m.subject.startsWith('You left something'));
  }

  it('emails the shopper after the delay and the link rebuilds the cart on any device', async () => {
    const s = await setup();
    const { orderId } = await abandon(s, 'ada@example.com', { hoursAgo: 2 });

    // Default delay is 10 hours: nothing yet.
    expect(await recovery.sendDue()).toBe(0);
    await ctx.platform.order.update({
      where: { id: orderId },
      data: { createdAt: new Date(Date.now() - 11 * 60 * 60 * 1000) },
    });
    expect(await recovery.sendDue()).toBe(1);
    expect(await recovery.sendDue()).toBe(0); // only once

    const [email] = await deliver();
    expect(email?.to).toBe('ada@example.com');
    expect(email?.text).toContain('Lamp');
    const token = /\/cart\/recover\/([^\s"]+)/.exec(email?.text ?? '')?.[1] ?? '';
    expect(token.startsWith(`${orderId}.`)).toBe(true);

    const restored = await s.sf('post', '/cart/recover').send({ token }).expect(201);
    expect(restored.body.cart.lines).toHaveLength(1);
    expect(restored.body.cart.lines[0]).toMatchObject({ variantId: s.variantId, quantity: 2 });

    // Forged or foreign tokens do not work.
    await s
      .sf('post', '/cart/recover')
      .send({ token: `${orderId}.${'x'.repeat(43)}` })
      .expect(404);
    const other = await setup();
    await other.sf('post', '/cart/recover').send({ token }).expect(404);

    const timeline = await ctx
      .http()
      .get(`${s.admin}/orders/${orderId}`)
      .set(s.merchant.auth)
      .expect(200);
    expect(JSON.stringify(timeline.body)).toContain('recovery_email_sent');

    const list = await ctx
      .http()
      .get(`${s.admin}/abandoned-checkouts`)
      .set(s.merchant.auth)
      .expect(200);
    expect(list.body.total).toBe(1);
    expect(list.body.items[0]).toMatchObject({
      id: orderId,
      email: 'ada@example.com',
      total: expect.any(Number),
      itemCount: 2,
      recoveryStatus: 'SENT',
      recoveredOrder: null,
    });

    // Paying for the restored cart marks the checkout as recovered.
    const paid = await s
      .sf('post', '/checkout', { cart: restored.body.token })
      .send({ email: 'ADA@example.com', shippingAddress: address, idempotencyKey: randomUUID() })
      .expect(201);
    await payMock(s.sf, paid.body.paymentUrl);
    const after = await ctx
      .http()
      .get(`${s.admin}/abandoned-checkouts`)
      .set(s.merchant.auth)
      .expect(200);
    expect(after.body.items[0].recoveredOrder).toMatchObject({ number: paid.body.orderNumber });
  });

  it('caps restored quantities at current stock and drops unavailable items', async () => {
    const s = await setup(5);
    const { orderId } = await abandon(s, 'bo@example.com', { quantity: 4 });
    await ctx.platform.productVariant.update({
      where: { id: s.variantId },
      data: { inventoryQuantity: 1 },
    });
    await recovery.sendDue();
    const token = /\/cart\/recover\/([^\s"]+)/.exec((await deliver())[0]?.text ?? '')?.[1] ?? '';
    expect(token.startsWith(orderId)).toBe(true);
    const restored = await s.sf('post', '/cart/recover').send({ token }).expect(201);
    expect(restored.body.cart.lines[0].quantity).toBe(1);

    await ctx.platform.product.updateMany({
      where: { storeId: s.merchant.store.id },
      data: { status: 'DRAFT' },
    });
    const empty = await s.sf('post', '/cart/recover').send({ token }).expect(201);
    expect(empty.body.cart.lines).toEqual([]);
  });

  it('skips shoppers who came back, and stores that turned emails off', async () => {
    const s = await setup(10);
    // Abandoned, then paid a newer order with the same email.
    const first = await abandon(s, 'cy@example.com');
    const cart = (await s.sf('post', '/cart').expect(201)).body.token as string;
    await s.sf('post', '/cart/lines', { cart }).send({ variantId: s.variantId }).expect(201);
    const placed = await s
      .sf('post', '/checkout', { cart })
      .send({ email: 'cy@example.com', shippingAddress: address, idempotencyKey: randomUUID() })
      .expect(201);
    await payMock(s.sf, placed.body.paymentUrl);

    expect(await recovery.sendDue()).toBe(0);
    expect(await deliver()).toHaveLength(0);
    const handled = await ctx.platform.order.findUniqueOrThrow({ where: { id: first.orderId } });
    expect(handled.recoveryStatus).toBe('SKIPPED');

    // Store setting off: never emailed; invalid delays are rejected.
    await ctx
      .http()
      .patch(`/api/v1/admin/stores/${s.merchant.store.id}`)
      .set(s.merchant.auth)
      .send({ abandonedCheckoutDelayHours: 5 })
      .expect(400);
    const updated = await ctx
      .http()
      .patch(`/api/v1/admin/stores/${s.merchant.store.id}`)
      .set(s.merchant.auth)
      .send({ abandonedCheckoutDelayHours: null })
      .expect(200);
    expect(updated.body.abandonedCheckoutDelayHours).toBeNull();
    const off = await abandon(s, 'di@example.com');
    expect(await recovery.sendDue()).toBe(0);
    const pending = await ctx.platform.order.findUniqueOrThrow({ where: { id: off.orderId } });
    expect(pending.recoveryStatus).toBeNull();

    // Checkouts older than a week are never emailed.
    await ctx
      .http()
      .patch(`/api/v1/admin/stores/${s.merchant.store.id}`)
      .set(s.merchant.auth)
      .send({ abandonedCheckoutDelayHours: 1 })
      .expect(200);
    await ctx.platform.order.update({
      where: { id: off.orderId },
      data: { createdAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000) },
    });
    expect(await recovery.sendDue()).toBe(0);
  });
});
