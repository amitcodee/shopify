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
  name: 'Grace Hopper',
  line1: '1 Harbor Rd',
  city: 'Arlington',
  postalCode: '22201',
  country: 'US',
};

describe('Draft orders', () => {
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
        title: 'Chair',
        status: 'ACTIVE',
        variants: [{ price: 10000, inventoryQuantity: 5 }],
      })
      .expect(201);
    await ctx
      .http()
      .put(`${admin}/tax-rates`)
      .set(merchant.auth)
      .send({ country: 'US', name: 'Sales tax', rateBps: 1000 })
      .expect(200);
    return { merchant, admin, sf, variantId: product.body.variants[0].id as string };
  }

  const draftBody = (variantId: string) => ({
    email: 'grace@example.com',
    lines: [
      { variantId, quantity: 2 },
      { title: 'Assembly service', unitPrice: 5000, quantity: 1, requiresShipping: false },
    ],
    shippingAddress: address,
    shipping: { title: 'White glove', price: 2000 },
    discount: { type: 'PERCENTAGE', value: 10 },
    note: 'Deliver after 5pm',
  });

  it('prices drafts and completes them as paid with stock and a manual payment', async () => {
    const { merchant, admin, variantId } = await setup();
    const created = await ctx
      .http()
      .post(`${admin}/draft-orders`)
      .set(merchant.auth)
      .send(draftBody(variantId))
      .expect(201);
    // 2 × 100.00 + 50.00 = 250.00; -10% = 225.00; +20.00 shipping; tax 10% of 225.00 = 22.50.
    expect(created.body).toMatchObject({
      number: 1,
      status: 'OPEN',
      subtotal: 25000,
      discountTotal: 2500,
      shippingTotal: 2000,
      taxTotal: 2250,
      total: 26750,
      order: null,
    });
    expect(created.body.lines[0]).toMatchObject({ title: 'Chair', unitPrice: 10000, total: 18000 });

    // Custom price on the catalog line.
    const updated = await ctx
      .http()
      .put(`${admin}/draft-orders/${created.body.id}`)
      .set(merchant.auth)
      .send({
        ...draftBody(variantId),
        lines: [{ variantId, quantity: 2, unitPrice: 8000 }],
        discount: null,
      })
      .expect(200);
    expect(updated.body).toMatchObject({ subtotal: 16000, total: 16000 + 2000 + 1600 });

    const second = await ctx
      .http()
      .post(`${admin}/draft-orders`)
      .set(merchant.auth)
      .send({ lines: [{ title: 'Gift wrap', unitPrice: 500, quantity: 1 }] })
      .expect(201);
    expect(second.body.number).toBe(2);
    await ctx
      .http()
      .post(`${admin}/draft-orders/${second.body.id}/complete`)
      .set(merchant.auth)
      .expect(400);

    const done = await ctx
      .http()
      .post(`${admin}/draft-orders/${created.body.id}/complete`)
      .set(merchant.auth)
      .expect(200);
    expect(done.body.status).toBe('COMPLETED');
    expect(done.body.order).toMatchObject({ status: 'OPEN' });

    const order = await ctx.platform.order.findUniqueOrThrow({
      where: { id: done.body.order.id },
      include: { payments: true, lines: true },
    });
    expect(order).toMatchObject({
      financialStatus: 'PAID',
      total: 19600,
      email: 'grace@example.com',
    });
    expect(order.payments).toEqual([
      expect.objectContaining({ provider: 'manual', status: 'SUCCEEDED', amount: 19600 }),
    ]);
    const variant = await ctx.platform.productVariant.findUniqueOrThrow({
      where: { id: variantId },
    });
    expect(variant.inventoryQuantity).toBe(3);

    await outbox.processBatch();
    expect(mailbox.sent.map((m) => m.to)).toContain('grace@example.com');

    // Completed drafts are frozen; refunds of manual payments are recorded without a provider.
    await ctx
      .http()
      .put(`${admin}/draft-orders/${created.body.id}`)
      .set(merchant.auth)
      .send(draftBody(variantId))
      .expect(409);
    await ctx
      .http()
      .delete(`${admin}/draft-orders/${created.body.id}`)
      .set(merchant.auth)
      .expect(409);
    const refunded = await ctx
      .http()
      .post(`${admin}/orders/${order.id}/refunds`)
      .set(merchant.auth)
      .send({ amount: 19600, restock: [{ lineId: order.lines[0]?.id, quantity: 2 }] })
      .expect(201);
    expect(refunded.body.financialStatus).toBe('REFUNDED');

    const list = await ctx
      .http()
      .get(`${admin}/draft-orders`)
      .query({ status: 'OPEN' })
      .set(merchant.auth)
      .expect(200);
    expect(list.body.items.map((d: { number: number }) => d.number)).toEqual([2]);
  });

  it('invoices a draft that the customer pays on the storefront', async () => {
    const { merchant, admin, sf, variantId } = await setup();
    const draft = await ctx
      .http()
      .post(`${admin}/draft-orders`)
      .set(merchant.auth)
      .send(draftBody(variantId))
      .expect(201);
    const sent = await ctx
      .http()
      .post(`${admin}/draft-orders/${draft.body.id}/send-invoice`)
      .set(merchant.auth)
      .send({ message: 'Thanks for visiting the showroom!' })
      .expect(200);
    expect(sent.body.status).toBe('INVOICE_SENT');

    await outbox.processBatch();
    const email = mailbox.sent.find((m) => m.subject.startsWith('Invoice #D1'));
    expect(email?.to).toBe('grace@example.com');
    expect(email?.text).toContain('Thanks for visiting the showroom!');
    const token = /\/invoices\/([^\s"]+)/.exec(email?.text ?? '')?.[1] ?? '';

    const invoice = await sf('get', `/invoices/${token}`).expect(200);
    expect(invoice.body).toMatchObject({ number: 1, state: 'payable', total: 26750 });
    await sf('get', `/invoices/${draft.body.id}.forged`).expect(404);
    await storefrontClient(ctx, 'elsewhere.localhost:3200')('get', `/invoices/${token}`).expect(
      404,
    );

    const pay = await sf('post', `/invoices/${token}/pay`).expect(200);
    const again = await sf('post', `/invoices/${token}/pay`).expect(200);
    expect(again.body.paymentUrl).toBe(pay.body.paymentUrl); // same payment session

    // While the customer is paying, the merchant cannot change the draft.
    await ctx
      .http()
      .put(`${admin}/draft-orders/${draft.body.id}`)
      .set(merchant.auth)
      .send(draftBody(variantId))
      .expect(409);

    await payMock(sf, pay.body.paymentUrl);
    const completed = await ctx
      .http()
      .get(`${admin}/draft-orders/${draft.body.id}`)
      .set(merchant.auth)
      .expect(200);
    expect(completed.body.status).toBe('COMPLETED');
    expect(completed.body.order).toMatchObject({ number: pay.body.orderNumber, status: 'OPEN' });
    expect((await sf('get', `/invoices/${token}`).expect(200)).body.state).toBe('paid');
    await sf('post', `/invoices/${token}/pay`).expect(409);
  });

  it('lets the customer retry after an invoice payment expires, and isolates stores', async () => {
    const { merchant, admin, sf, variantId } = await setup();
    const draft = await ctx
      .http()
      .post(`${admin}/draft-orders`)
      .set(merchant.auth)
      .send(draftBody(variantId))
      .expect(201);
    await ctx
      .http()
      .post(`${admin}/draft-orders/${draft.body.id}/send-invoice`)
      .set(merchant.auth)
      .send({})
      .expect(200);
    await outbox.processBatch();
    const token =
      /\/invoices\/([^\s"]+)/.exec(
        mailbox.sent.find((m) => m.subject.startsWith('Invoice'))?.text ?? '',
      )?.[1] ?? '';

    const first = await sf('post', `/invoices/${token}/pay`).expect(200);
    await ctx.platform.order.updateMany({
      where: { storeId: merchant.store.id, status: 'PENDING_PAYMENT' },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    await lifecycle.expireStaleOrders();
    let variant = await ctx.platform.productVariant.findUniqueOrThrow({ where: { id: variantId } });
    expect(variant.inventoryQuantity).toBe(5); // released

    const second = await sf('post', `/invoices/${token}/pay`).expect(200);
    expect(second.body.orderNumber).not.toBe(first.body.orderNumber);
    variant = await ctx.platform.productVariant.findUniqueOrThrow({ where: { id: variantId } });
    expect(variant.inventoryQuantity).toBe(3);
    const expired = await ctx.platform.order.findFirstOrThrow({
      where: { storeId: merchant.store.id, number: first.body.orderNumber },
    });
    expect(expired.recoveryStatus).toBe('SKIPPED'); // no abandoned-checkout email for invoices

    const other = await merchantWithStore(ctx);
    await ctx
      .http()
      .get(`/api/v1/admin/stores/${other.store.id}/draft-orders/${draft.body.id}`)
      .set(other.auth)
      .expect(404);
    await ctx
      .http()
      .post(`/api/v1/admin/stores/${other.store.id}/draft-orders`)
      .set(other.auth)
      .send({ lines: [{ variantId, quantity: 1 }] })
      .expect(400); // another store's variant
  });
});
