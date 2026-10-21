import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { EMAIL_SENDER, type MemoryEmailSender } from '../src/email/email.js';
import { OutboxProcessor } from '../src/outbox/outbox.service.js';
import {
  createTestApp,
  merchantWithStore,
  payMock,
  resetDatabase,
  storefrontClient,
  type TestContext,
} from './utils.js';

const address = { name: 'Grace', line1: '1 Way', city: 'Town', postalCode: '1', country: 'GB' };

describe('Returns', () => {
  let ctx: TestContext;
  let mailbox: MemoryEmailSender;
  let outbox: OutboxProcessor;

  beforeAll(async () => {
    ctx = await createTestApp();
    await resetDatabase(ctx.owner);
    const app = ctx.app as INestApplication;
    mailbox = app.get(EMAIL_SENDER);
    outbox = app.get(OutboxProcessor);
  });

  afterAll(async () => {
    await ctx?.close();
  });

  beforeEach(() => {
    mailbox.sent.length = 0;
  });

  async function paidOrder(quantity = 3) {
    const m = await merchantWithStore(ctx);
    const admin = `/api/v1/admin/stores/${m.store.id}`;
    const sf = storefrontClient(ctx, `${m.store.subdomain}.localhost:3200`);
    const product = await ctx
      .http()
      .post(`${admin}/products`)
      .set(m.auth)
      .send({ title: 'Mug', status: 'ACTIVE', variants: [{ price: 1000, inventoryQuantity: 10 }] })
      .expect(201);
    const customer = (
      await sf('post', '/customers/register')
        .send({
          name: 'Grace',
          email: `grace-${randomUUID().slice(0, 6)}@example.com`,
          password: 'grace-password-123',
        })
        .expect(201)
    ).body.session.token as string;
    const cart = (await sf('post', '/cart').expect(201)).body.token as string;
    await sf('post', '/cart/lines', { cart })
      .send({ variantId: product.body.variants[0].id, quantity })
      .expect(201);
    const placed = await sf('post', '/checkout', { cart, customer })
      .send({ email: 'x@example.com', shippingAddress: address, idempotencyKey: randomUUID() })
      .expect(201);
    await payMock(sf, placed.body.paymentUrl);
    const number = placed.body.orderNumber as number;
    const order = await sf('get', `/customers/me/orders/${number}`, { customer }).expect(200);
    while ((await outbox.processBatch()) > 0);
    mailbox.sent.length = 0;
    return {
      m,
      admin,
      sf,
      customer,
      number,
      variantId: product.body.variants[0].id as string,
      lineId: order.body.lines[0].id as string,
      orderId: (
        await ctx.platform.order.findFirstOrThrow({ where: { storeId: m.store.id, number } })
      ).id,
    };
  }

  it('customer requests a return; staff approve, receive and refund with restock', async () => {
    const o = await paidOrder(3);
    const view = await o
      .sf('get', `/customers/me/orders/${o.number}`, { customer: o.customer })
      .expect(200);
    expect(view.body).toMatchObject({ returnable: true, returns: [] });
    expect(view.body.lines[0].returnableQuantity).toBe(3);

    const requested = await o
      .sf('post', `/customers/me/orders/${o.number}/returns`, { customer: o.customer })
      .send({ lines: [{ orderLineId: o.lineId, quantity: 2, reason: 'SIZE' }], note: 'Too small' })
      .expect(201);
    expect(requested.body).toMatchObject({ status: 'REQUESTED', suggestedRefund: 2000 });
    // Only one unit is left to return.
    await o
      .sf('post', `/customers/me/orders/${o.number}/returns`, { customer: o.customer })
      .send({ lines: [{ orderLineId: o.lineId, quantity: 2, reason: 'SIZE' }] })
      .expect(400);
    await outbox.processBatch();
    expect(mailbox.sent.some((m) => m.subject.includes(`Return for order #${o.number}`))).toBe(
      true,
    );

    const queue = await ctx
      .http()
      .get(`${o.admin}/returns?status=REQUESTED`)
      .set(o.m.auth)
      .expect(200);
    expect(queue.body.items.map((r: { id: string }) => r.id)).toEqual([requested.body.id]);

    // Closing needs an approved return.
    await ctx
      .http()
      .post(`${o.admin}/returns/${requested.body.id}/close`)
      .set(o.m.auth)
      .send({})
      .expect(409);
    mailbox.sent.length = 0;
    await ctx
      .http()
      .post(`${o.admin}/returns/${requested.body.id}/approve`)
      .set(o.m.auth)
      .expect(200);
    await outbox.processBatch();
    expect(mailbox.sent.find((m) => m.text.includes('is approved'))).toBeTruthy();

    const closed = await ctx
      .http()
      .post(`${o.admin}/returns/${requested.body.id}/close`)
      .set(o.m.auth)
      .send({ restock: true })
      .expect(200);
    expect(closed.body).toMatchObject({ status: 'CLOSED', refundId: expect.any(String) });

    const order = await ctx.http().get(`${o.admin}/orders/${o.orderId}`).set(o.m.auth).expect(200);
    expect(order.body.financialStatus).toBe('PARTIALLY_REFUNDED');
    expect(order.body.refundableAmount).toBe(1000);
    expect(order.body.returns[0]).toMatchObject({ status: 'CLOSED' });
    const variant = await ctx.platform.productVariant.findUniqueOrThrow({
      where: { id: o.variantId },
    });
    expect(variant.inventoryQuantity).toBe(9); // 10 - 3 sold + 2 back
  });

  it('declined returns free their units; the window and ownership are enforced', async () => {
    const o = await paidOrder(1);
    const ask = () =>
      o
        .sf('post', `/customers/me/orders/${o.number}/returns`, { customer: o.customer })
        .send({ lines: [{ orderLineId: o.lineId, quantity: 1, reason: 'CHANGED_MIND' }] });
    const first = await ask().expect(201);
    await ask().expect(400);
    await ctx
      .http()
      .post(`${o.admin}/returns/${first.body.id}/decline`)
      .set(o.m.auth)
      .send({ reason: 'Final sale item' })
      .expect(200);
    const view = await o
      .sf('get', `/customers/me/orders/${o.number}`, { customer: o.customer })
      .expect(200);
    expect(view.body.returns[0]).toMatchObject({
      status: 'DECLINED',
      declineReason: 'Final sale item',
    });
    expect(view.body.lines[0].returnableQuantity).toBe(1);
    await ctx.http().post(`${o.admin}/returns/${first.body.id}/approve`).set(o.m.auth).expect(409);

    // Someone else's account cannot see or return the order.
    const stranger = (
      await o
        .sf('post', '/customers/register')
        .send({ name: 'Eve', email: 'eve@example.com', password: 'eve-password-123' })
        .expect(201)
    ).body.session.token as string;
    await o
      .sf('post', `/customers/me/orders/${o.number}/returns`, { customer: stranger })
      .send({ lines: [{ orderLineId: o.lineId, quantity: 1, reason: 'OTHER' }] })
      .expect(404);

    // After the return window, customers must contact the store; staff can still record one.
    await ctx.platform.order.update({
      where: { id: o.orderId },
      data: { paidAt: new Date(Date.now() - 40 * 86_400_000) },
    });
    await ask().expect(409);
    const staff = await ctx
      .http()
      .post(`${o.admin}/orders/${o.orderId}/returns`)
      .set(o.m.auth)
      .send({ lines: [{ orderLineId: o.lineId, quantity: 1, reason: 'DAMAGED' }] })
      .expect(201);
    expect(staff.body).toMatchObject({ status: 'OPEN', requestedByCustomer: false });
    // Closing with amount 0 records the return without a refund.
    const closed = await ctx
      .http()
      .post(`${o.admin}/returns/${staff.body.id}/close`)
      .set(o.m.auth)
      .send({ amount: 0, restock: false })
      .expect(200);
    expect(closed.body).toMatchObject({ status: 'CLOSED', refundId: null });
  });
});
