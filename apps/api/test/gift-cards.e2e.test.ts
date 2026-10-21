import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
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
  country: 'GB',
};

describe('Gift cards', () => {
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

  /** A store selling a 30.00 kettle (no shipping or tax configured: free fallback, 0 tax). */
  async function setup() {
    const merchant = await merchantWithStore(ctx);
    while ((await outbox.processBatch()) > 0);
    mailbox.sent.length = 0;
    const admin = `/api/v1/admin/stores/${merchant.store.id}`;
    const sf = storefrontClient(ctx, `${merchant.store.subdomain}.localhost:3200`);
    const product = await ctx
      .http()
      .post(`${admin}/products`)
      .set(merchant.auth)
      .send({
        title: 'Kettle',
        status: 'ACTIVE',
        variants: [{ price: 3000, inventoryQuantity: 20 }],
      })
      .expect(201);
    const issue = (body: object) =>
      ctx.http().post(`${admin}/gift-cards`).set(merchant.auth).send(body);
    return { merchant, admin, sf, issue, variantId: product.body.variants[0].id as string };
  }

  async function cartWith(s: Awaited<ReturnType<typeof setup>>, quantity = 1) {
    const cart = (await s.sf('post', '/cart').expect(201)).body.token as string;
    await s
      .sf('post', '/cart/lines', { cart })
      .send({ variantId: s.variantId, quantity })
      .expect(201);
    return cart;
  }

  const checkout = (s: Awaited<ReturnType<typeof setup>>, cart: string, giftCardCode?: string) =>
    s.sf('post', '/checkout', { cart }).send({
      email: 'ada@example.com',
      shippingAddress: address,
      idempotencyKey: randomUUID(),
      ...(giftCardCode ? { giftCardCode } : {}),
    });

  const balance = async (s: Awaited<ReturnType<typeof setup>>, id: string) =>
    (await ctx.http().get(`${s.admin}/gift-cards/${id}`).set(s.merchant.auth).expect(200)).body;

  it('issues a card shown once, emails it, and pays part of an order with it', async () => {
    const s = await setup();
    const issued = await s
      .issue({ initialValue: 2000, customerEmail: 'ada@example.com', notifyCustomer: true })
      .expect(201);
    expect(issued.body.code).toMatch(/^[A-Z2-9]{4}(-[A-Z2-9]{4}){3}$/);
    expect(issued.body).toMatchObject({
      balance: 2000,
      status: 'active',
      customerEmail: 'ada@example.com',
    });
    const stored = await ctx.platform.giftCard.findUniqueOrThrow({ where: { id: issued.body.id } });
    expect(JSON.stringify(stored)).not.toContain(issued.body.code.replaceAll('-', ''));

    await outbox.processBatch();
    const email = mailbox.sent.find((m) => m.subject.includes('gift card'));
    expect(email?.text).toContain(issued.body.code);

    // Codes are typed loosely: lower case, spaces instead of dashes.
    const typed = issued.body.code.toLowerCase().replaceAll('-', ' ');
    const cart = await cartWith(s);
    const preview = await s
      .sf('post', '/checkout/preview', { cart })
      .send({ country: 'GB', giftCardCode: typed })
      .expect(200);
    expect(preview.body).toMatchObject({
      total: 3000,
      amountDue: 1000,
      giftCard: { applied: 2000, remaining: 0 },
      giftCardError: null,
    });

    const placed = await checkout(s, cart, typed).expect(201);
    expect((await balance(s, issued.body.id)).balance).toBe(0);
    const order = await ctx.platform.order.findFirstOrThrow({
      where: { storeId: s.merchant.store.id, number: placed.body.orderNumber },
      include: { payments: true },
    });
    expect(order).toMatchObject({ total: 3000, giftCardAmount: 2000, financialStatus: 'PENDING' });
    const card = order.payments.find((p) => p.provider !== 'gift_card');
    expect(card?.amount).toBe(1000); // the provider charges only the rest

    await payMock(s.sf, placed.body.paymentUrl);
    const paid = await ctx
      .http()
      .get(`${s.admin}/orders/${order.id}`)
      .set(s.merchant.auth)
      .expect(200);
    expect(paid.body).toMatchObject({ financialStatus: 'PAID', giftCardAmount: 2000 });

    // Refunds go back to the card payment first, then to the gift card.
    await ctx
      .http()
      .post(`${s.admin}/orders/${order.id}/refunds`)
      .set(s.merchant.auth)
      .send({ amount: 1500 })
      .expect(201);
    const detail = await balance(s, issued.body.id);
    expect(detail.balance).toBe(500);
    expect(
      detail.transactions.map((t: { kind: string; amount: number }) => [t.kind, t.amount]),
    ).toEqual([
      ['REFUNDED', 500],
      ['REDEEMED', -2000],
      ['ISSUED', 2000],
    ]);
  });

  it('pays a whole order with a card and restores reservations of unpaid orders', async () => {
    const s = await setup();
    const big = await s.issue({ initialValue: 10000 }).expect(201);
    const placed = await checkout(s, await cartWith(s), big.body.code).expect(201);
    expect(placed.body.paymentUrl).toContain('/orders/'); // no payment page needed
    const order = await ctx.platform.order.findFirstOrThrow({
      where: { storeId: s.merchant.store.id, number: placed.body.orderNumber },
    });
    expect(order).toMatchObject({ status: 'OPEN', financialStatus: 'PAID', giftCardAmount: 3000 });
    expect((await balance(s, big.body.id)).balance).toBe(7000);

    // An unpaid order holding part of the balance gives it back when it expires.
    const partial = await s.issue({ initialValue: 1000 }).expect(201);
    await checkout(s, await cartWith(s), partial.body.code).expect(201);
    expect((await balance(s, partial.body.id)).balance).toBe(0);
    await ctx.platform.order.updateMany({
      where: { storeId: s.merchant.store.id, status: 'PENDING_PAYMENT' },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    await lifecycle.expireStaleOrders();
    const restored = await balance(s, partial.body.id);
    expect(restored.balance).toBe(1000);
    expect(restored.transactions[0]).toMatchObject({ kind: 'RESTORED', amount: 1000 });
  });

  it('rejects unusable cards and never overspends under concurrent checkouts', async () => {
    const s = await setup();
    const preview = (code: string) =>
      cartWith(s).then((cart) =>
        s.sf('post', '/checkout/preview', { cart }).send({ giftCardCode: code }).expect(200),
      );
    expect((await preview('NOPE-NOPE-NOPE-NOPE')).body.giftCardError).toBe(
      'This gift card is not valid.',
    );

    const expired = await s.issue({ initialValue: 500, expiresOn: '2020-01-01' }).expect(201);
    expect((await preview(expired.body.code)).body.giftCardError).toBe(
      'This gift card has expired.',
    );
    const disabled = await s.issue({ initialValue: 500, code: 'CUSTOMCODE42' }).expect(201);
    expect(disabled.body.code).toBe('CUST-OMCO-DE42');
    await s.issue({ initialValue: 500, code: 'customcode42' }).expect(409);
    await ctx
      .http()
      .patch(`${s.admin}/gift-cards/${disabled.body.id}`)
      .set(s.merchant.auth)
      .send({ disabled: true })
      .expect(200);
    expect((await preview('CUSTOMCODE42')).body.giftCardError).toBe('This gift card is not valid.');
    await checkout(s, await cartWith(s), 'CUSTOMCODE42').expect(400);

    // Another store's card is unknown here.
    const other = await setup();
    const foreign = await other.issue({ initialValue: 500 }).expect(201);
    expect((await preview(foreign.body.code)).body.giftCardError).toBe(
      'This gift card is not valid.',
    );

    // Two checkouts racing for one 30.00 card: the row lock lets only one spend it.
    const card = await s.issue({ initialValue: 3000 }).expect(201);
    const [a, b] = await Promise.all([cartWith(s), cartWith(s)]);
    const results = await Promise.all([
      checkout(s, a, card.body.code),
      checkout(s, b, card.body.code),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 400]);
    expect(results.find((r) => r.status === 400)?.body.detail).toBe(
      'This gift card has no balance left.',
    );
    expect((await balance(s, card.body.id)).balance).toBe(0);

    // Adjustments cannot take the balance below zero and are recorded.
    const topped = await ctx
      .http()
      .post(`${s.admin}/gift-cards/${card.body.id}/adjustments`)
      .set(s.merchant.auth)
      .send({ amount: 250, note: 'Goodwill' })
      .expect(201);
    expect(topped.body.balance).toBe(250);
    await ctx
      .http()
      .post(`${s.admin}/gift-cards/${card.body.id}/adjustments`)
      .set(s.merchant.auth)
      .send({ amount: -300, note: 'Too much' })
      .expect(400);

    const list = await ctx
      .http()
      .get(`${s.admin}/gift-cards`)
      .query({ q: card.body.code.slice(-4) })
      .set(s.merchant.auth)
      .expect(200);
    expect(list.body.items.map((c: { id: string }) => c.id)).toContain(card.body.id);
    await ctx
      .http()
      .get(`${s.admin}/gift-cards/${foreign.body.id}`)
      .set(s.merchant.auth)
      .expect(404);
  });

  it('sells gift card products: discounts skip them and paying issues emailed cards', async () => {
    const s = await setup();
    const giftProduct = await ctx
      .http()
      .post(`${s.admin}/products`)
      .set(s.merchant.auth)
      .send({
        title: 'Store gift card',
        status: 'ACTIVE',
        isGiftCard: true,
        options: [{ name: 'Amount', values: ['25', '50'] }],
        variants: [
          { options: ['25'], price: 2500, requiresShipping: true, inventoryQuantity: 0 },
          { options: ['50'], price: 5000 },
        ],
      })
      .expect(201);
    expect(giftProduct.body.isGiftCard).toBe(true);
    expect(giftProduct.body.variants[0]).toMatchObject({
      requiresShipping: false,
      taxable: false,
      trackInventory: false,
    });
    await ctx
      .http()
      .post(`${s.admin}/discounts`)
      .set(s.merchant.auth)
      .send({ code: 'HALF', type: 'PERCENTAGE', value: 50 })
      .expect(201);

    const cart = (await s.sf('post', '/cart').expect(201)).body.token as string;
    await s
      .sf('post', '/cart/lines', { cart })
      .send({ variantId: giftProduct.body.variants[0].id, quantity: 2 })
      .expect(201);
    await s.sf('post', '/cart/lines', { cart }).send({ variantId: s.variantId }).expect(201);
    const preview = await s
      .sf('post', '/checkout/preview', { cart })
      .send({ country: 'GB', discountCode: 'HALF' })
      .expect(200);
    // 50% off the 30.00 kettle only: the 2 × 25.00 cards keep their value.
    expect(preview.body).toMatchObject({ subtotal: 8000, discountTotal: 1500, total: 6500 });

    // Gift cards cannot pay for gift cards.
    const card = await s.issue({ initialValue: 1000 }).expect(201);
    const blocked = await s
      .sf('post', '/checkout/preview', { cart })
      .send({ giftCardCode: card.body.code })
      .expect(200);
    expect(blocked.body.giftCardError).toBe('Gift cards can’t be used to buy gift cards.');

    const placed = await s
      .sf('post', '/checkout', { cart })
      .send({
        email: 'buyer@example.com',
        shippingAddress: address,
        idempotencyKey: randomUUID(),
        discountCode: 'HALF',
      })
      .expect(201);
    mailbox.sent.length = 0;
    await payMock(s.sf, placed.body.paymentUrl);
    await outbox.processBatch();
    const codes = mailbox.sent
      .filter((m) => m.to === 'buyer@example.com' && m.subject.includes('gift card'))
      .map((m) => /([A-Z2-9]{4}(?:-[A-Z2-9]{4}){3})/.exec(m.text)?.[1]);
    expect(codes).toHaveLength(2);

    const issued = await ctx.platform.giftCard.findMany({
      where: { storeId: s.merchant.store.id, sourceOrderId: { not: null } },
    });
    expect(issued.map((c) => c.balance)).toEqual([2500, 2500]);

    // A purchased card works at checkout like any other.
    const next = await cartWith(s);
    const spend = await s
      .sf('post', '/checkout/preview', { cart: next })
      .send({ giftCardCode: codes[0] })
      .expect(200);
    expect(spend.body.giftCard).toMatchObject({ applied: 2500 });

    // Draft orders cannot sell gift cards.
    await ctx
      .http()
      .post(`${s.admin}/draft-orders`)
      .set(s.merchant.auth)
      .send({ lines: [{ variantId: giftProduct.body.variants[1].id, quantity: 1 }] })
      .expect(400);
  });
});
