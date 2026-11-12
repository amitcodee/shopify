import { createHash, randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { OrderLifecycle } from '../src/orders/order-lifecycle.service.js';
import { StoreUrls } from '../src/orders/store-urls.js';
import { STORE_GATEWAY_FETCH } from '../src/payments/store-gateways/store-gateways.service.js';
import {
  createStore,
  createTestApp,
  resetDatabase,
  signup,
  storefrontClient,
  type TestContext,
} from './utils.js';

const PAYU = { merchantKey: 'KEY12345', merchantSalt: 'super-secret-salt' };

describe('Store gateways (merchant-owned keys)', () => {
  let ctx: TestContext;
  let answer: () => Response;

  beforeAll(async () => {
    ctx = await createTestApp({
      overrides: [{ provide: STORE_GATEWAY_FETCH, useValue: () => Promise.resolve(answer()) }],
    });
    await resetDatabase(ctx.owner);
  });

  beforeEach(() => {
    answer = () => new Response(JSON.stringify({ status: 0, msg: 'none found' }));
  });

  afterAll(async () => {
    await ctx?.close();
  });

  async function merchant(currency = 'INR') {
    const session = await signup(ctx);
    const store = await createStore(ctx, session.token, { currency, payments: false });
    return { store, auth: { Authorization: `Bearer ${session.token}` } };
  }

  const base = (storeId: string) => `/api/v1/admin/stores/${storeId}/store-gateways`;

  async function connectPayu(storeId: string, auth: Record<string, string>) {
    await ctx
      .http()
      .put(`${base(storeId)}/payu`)
      .set(auth)
      .send({ mode: 'test', credentials: PAYU })
      .expect(200);
  }

  /** PayU's reverse hash over the fields it posts back. */
  function payuResult(fields: {
    status: string;
    txnid: string;
    amount: string;
    udf1?: string;
    email: string;
    firstname: string;
    mihpayid: string;
  }) {
    const hash = createHash('sha512')
      .update(
        `${PAYU.merchantSalt}|${fields.status}||||||||||${fields.udf1 ?? ''}|${fields.email}|${fields.firstname}|Store order|${fields.amount}|${fields.txnid}|${PAYU.merchantKey}`,
      )
      .digest('hex');
    return { key: PAYU.merchantKey, productinfo: 'Store order', ...fields, hash };
  }

  it('keeps secrets write-only and encrypted, and rejects keys the gateway refuses', async () => {
    const { store, auth } = await merchant();
    answer = () => new Response('Invalid Hash.');
    const refused = await ctx
      .http()
      .put(`${base(store.id)}/payu`)
      .set(auth)
      .send({ mode: 'test', credentials: PAYU })
      .expect(400);
    expect(refused.body.detail).toMatch(/did not accept/);

    answer = () => new Response(JSON.stringify({ status: 0 }));
    await connectPayu(store.id, auth);
    const overview = await ctx.http().get(base(store.id)).set(auth).expect(200);
    // The first gateway a store connects starts taking payments right away.
    expect(overview.body.connected[0]).toMatchObject({ id: 'payu', mode: 'test', active: true });
    expect(JSON.stringify(overview.body)).not.toContain(PAYU.merchantSalt);
    expect(JSON.stringify(overview.body)).not.toContain(PAYU.merchantKey);

    const row = await ctx.platform.storeGateway.findFirstOrThrow({ where: { storeId: store.id } });
    expect(row.credentialsEnc).not.toContain(PAYU.merchantSalt);

    // A blank secret keeps the saved one when rotating another field.
    await ctx
      .http()
      .put(`${base(store.id)}/payu`)
      .set(auth)
      .send({ mode: 'test', credentials: { merchantKey: PAYU.merchantKey, merchantSalt: '' } })
      .expect(200);
  });

  it('is invisible to other stores', async () => {
    const a = await merchant();
    const b = await merchant();
    await ctx.http().get(base(a.store.id)).set(b.auth).expect(404);
    await ctx
      .http()
      .put(`${base(a.store.id)}/payu`)
      .set(b.auth)
      .send({ mode: 'test', credentials: PAYU })
      .expect(404);
  });

  it('refuses a gateway that cannot charge the store currency', async () => {
    const { store, auth } = await merchant('USD');
    await connectPayu(store.id, auth);
    const res = await ctx
      .http()
      .post(`${base(store.id)}/payu/activate`)
      .set(auth)
      .expect(400);
    expect(res.body.detail).toMatch(/INR/);
  });

  it('takes an order from checkout to paid through PayU, and keeps results to its store', async () => {
    const { store, auth } = await merchant();
    await connectPayu(store.id, auth);
    await ctx
      .http()
      .post(`${base(store.id)}/payu/activate`)
      .set(auth)
      .expect(204);
    const admin = `/api/v1/admin/stores/${store.id}`;

    const overview = await ctx.http().get(`${admin}/payments`).set(auth).expect(200);
    expect(overview.body.acceptingPayments).toBe(true);
    expect(overview.body.activeStoreGateway).toEqual({ label: 'PayU', mode: 'test' });

    const product = await ctx
      .http()
      .post(`${admin}/products`)
      .set(auth)
      .send({
        title: 'Lamp',
        status: 'ACTIVE',
        variants: [{ price: 50000, inventoryQuantity: 5, sku: 'LAMP' }],
      })
      .expect(201);
    const sf = storefrontClient(ctx, `${store.subdomain}.localhost:3200`);
    const cartRes = await sf('post', '/cart').expect(201);
    const cart = cartRes.body.token as string;
    await sf('post', '/cart/lines', { cart })
      .send({ variantId: product.body.variants[0].id, quantity: 1 })
      .expect(201);
    const shippingAddress = {
      name: 'Asha Rao',
      line1: '1 MG Road',
      city: 'Pune',
      postalCode: '411001',
      country: 'in',
    };
    const order = (phone?: string) =>
      sf('post', '/checkout', { cart }).send({
        idempotencyKey: randomUUID(),
        email: 'asha@example.com',
        shippingAddress: { ...shippingAddress, ...(phone ? { phone } : {}) },
      });

    // PayU needs a phone number: asked for before any stock is reserved.
    const noPhone = await order();
    expect(noPhone.status, JSON.stringify(noPhone.body)).toBe(400);
    expect(noPhone.body.detail).toMatch(/phone/i);

    const placed = await order('9876543210');
    expect(placed.status, JSON.stringify(placed.body)).toBeLessThan(300);
    const paymentUrl = new URL(placed.body.paymentUrl as string);
    expect(paymentUrl.pathname).toContain(`/store-gateways/${store.id}/payu/pay/`);
    const txnid = paymentUrl.pathname.split('/').pop() ?? '';

    const payment = await ctx.platform.payment.findFirstOrThrow({
      where: { storeId: store.id, providerRef: txnid },
      include: { order: true },
    });
    expect(payment.provider).toBe('own_payu_test');
    expect(payment.applicationFee).toBe(0);

    // The bridge page posts the signed form to PayU's test host, nothing else.
    const page = await ctx.http().get(paymentUrl.pathname).expect(200);
    expect(page.text).toContain('action="https://test.payu.in/_payment"');
    expect(page.text).toContain(`value="${txnid}"`);
    expect(page.text).not.toContain(PAYU.merchantSalt);

    // A forged result is refused and the order stays unpaid.
    const result = payuResult({
      status: 'success',
      txnid,
      amount: (payment.amount / 100).toFixed(2),
      udf1: payment.orderId,
      email: 'asha@example.com',
      firstname: 'Asha',
      mihpayid: '403993715',
    });
    await ctx
      .http()
      .post(`/api/v1/store-gateways/${store.id}/payu/return`)
      .type('form')
      .send({ ...result, hash: 'forged' })
      .expect(400);
    expect(
      (await ctx.platform.order.findUniqueOrThrow({ where: { id: payment.orderId } })).paidAt,
    ).toBeNull();

    // Another store with its own keys cannot touch this payment.
    const other = await merchant();
    await connectPayu(other.store.id, other.auth);
    await ctx
      .http()
      .post(`/api/v1/webhooks/store-gateways/${other.store.id}/payu`)
      .type('form')
      .send(result)
      .expect(200);
    expect(
      (await ctx.platform.order.findUniqueOrThrow({ where: { id: payment.orderId } })).paidAt,
    ).toBeNull();

    // The signed result from PayU marks it paid and returns the shopper to the order page.
    const back = await ctx
      .http()
      .post(`/api/v1/store-gateways/${store.id}/payu/return`)
      .type('form')
      .send(result)
      .expect(303);
    expect(back.headers.location).toContain('/orders/');
    const paid = await ctx.platform.order.findUniqueOrThrow({ where: { id: payment.orderId } });
    expect(paid.paidAt).not.toBeNull();
    expect(paid.paymentProvider).toBe('own_payu_test');

    // Dashboard counts it as a test order; the keys cannot be deleted while refunds may need them.
    const stats = await ctx.http().get(`${admin}/analytics`).set(auth).expect(200);
    expect(stats.body.testOrderCount).toBe(1);
    await ctx
      .http()
      .delete(`${base(store.id)}/payu`)
      .set(auth)
      .expect(409);

    // A refund goes to PayU on the merchant's keys.
    answer = () => new Response(JSON.stringify({ status: 1, request_id: 'R1', msg: 'queued' }));
    await ctx
      .http()
      .post(`${admin}/orders/${payment.orderId}/refunds`)
      .set(auth)
      .send({ amount: 1000, reason: 'Test', restock: [] })
      .expect((res) => expect(res.status, JSON.stringify(res.body)).toBeLessThan(300));
  });

  it('sells on cash on delivery: confirmed at once when the merchant allows it, a sale only when the cash is in', async () => {
    const { store, auth } = await merchant();
    const admin = `/api/v1/admin/stores/${store.id}`;
    const product = await ctx
      .http()
      .post(`${admin}/products`)
      .set(auth)
      .send({
        title: 'Lamp',
        status: 'ACTIVE',
        variants: [{ price: 50000, inventoryQuantity: 5, sku: 'LAMP' }],
      })
      .expect(201);
    const sf = storefrontClient(ctx, `${store.subdomain}.localhost:3200`);
    const cart = (await sf('post', '/cart').expect(201)).body.token as string;
    await sf('post', '/cart/lines', { cart })
      .send({ variantId: product.body.variants[0].id, quantity: 1 })
      .expect(201);
    const place = (phone?: string) =>
      sf('post', '/checkout', { cart }).send({
        idempotencyKey: randomUUID(),
        email: 'asha@example.com',
        paymentMethod: 'cod',
        shippingAddress: {
          name: 'Asha Rao',
          line1: '1 MG Road',
          city: 'Pune',
          postalCode: '411001',
          country: 'in',
          ...(phone ? { phone } : {}),
        },
      });
    const preview = () => sf('post', '/checkout/preview', { cart }).send({ country: 'IN' });

    // Off by default, and the shopper cannot force it.
    expect((await preview()).body.cashOnDelivery).toBe(false);
    expect((await place('9876543210')).status).toBe(400);

    await ctx
      .http()
      .put(`${base(store.id)}/cod`)
      .set(auth)
      .send({ enabled: true, maxAmount: 1000 })
      .expect(204);
    expect((await preview()).body.cashOnDelivery).toBe(false);
    expect((await place('9876543210')).status).toBe(400);

    await ctx
      .http()
      .put(`${base(store.id)}/cod`)
      .set(auth)
      .send({ enabled: true, maxAmount: null, requireConfirmation: false })
      .expect(204);
    expect((await preview()).body.cashOnDelivery).toBe(true);
    const payments = await ctx.http().get(`${admin}/payments`).set(auth).expect(200);
    expect(payments.body.acceptingPayments).toBe(true);

    // Delivery needs a phone number.
    expect((await place()).status).toBe(400);

    const placed = await place('9876543210');
    expect(placed.status, JSON.stringify(placed.body)).toBeLessThan(300);
    expect(placed.body.paymentUrl).toContain('/orders/');
    const row = await ctx.platform.order.findFirstOrThrow({
      where: { storeId: store.id, number: placed.body.orderNumber },
    });
    expect(row).toMatchObject({
      status: 'OPEN',
      financialStatus: 'PENDING',
      paymentProvider: 'cod',
      expiresAt: null,
      paidAt: null,
    });
    const order = () => ctx.http().get(`${admin}/orders/${row.id}`).set(auth).expect(200);
    expect((await order()).body).toMatchObject({ cashOnDelivery: true, refundableAmount: 0 });

    // Not a sale yet, but it can ship.
    let stats = await ctx.http().get(`${admin}/analytics`).set(auth).expect(200);
    expect(stats.body.grossSales).toBe(0);
    await ctx.http().post(`${admin}/orders/${row.id}/fulfillments`).set(auth).send({}).expect(201);

    await ctx.http().post(`${admin}/orders/${row.id}/cash-collected`).set(auth).expect(200);
    expect((await order()).body).toMatchObject({
      financialStatus: 'PAID',
      refundableAmount: row.total,
    });
    stats = await ctx.http().get(`${admin}/analytics`).set(auth).expect(200);
    expect(stats.body.grossSales).toBe(row.total);
    expect(stats.body.testOrderCount).toBe(0);
    await ctx.http().post(`${admin}/orders/${row.id}/cash-collected`).set(auth).expect(409);
  });
  it('protects cash on delivery from fake orders: email confirmation, expiry, phone limit, quota', async () => {
    const { store, auth } = await merchant();
    const admin = `/api/v1/admin/stores/${store.id}`;
    const product = await ctx
      .http()
      .post(`${admin}/products`)
      .set(auth)
      .send({
        title: 'Kurta',
        status: 'ACTIVE',
        variants: [{ price: 99_900, inventoryQuantity: 20, sku: 'KURTA' }],
      })
      .expect(201);
    // Email confirmation is the default.
    await ctx
      .http()
      .put(`${base(store.id)}/cod`)
      .set(auth)
      .send({ enabled: true, maxAmount: null })
      .expect(204);
    const gateways = await ctx.http().get(base(store.id)).set(auth).expect(200);
    expect(gateways.body.cod).toEqual({
      enabled: true,
      maxAmount: null,
      requireConfirmation: true,
    });

    const sf = storefrontClient(ctx, `${store.subdomain}.localhost:3200`);
    const place = async (email: string, phone: string) => {
      const cart = (await sf('post', '/cart').expect(201)).body.token as string;
      await sf('post', '/cart/lines', { cart })
        .send({ variantId: product.body.variants[0].id, quantity: 1 })
        .expect(201);
      return sf('post', '/checkout', { cart }).send({
        idempotencyKey: randomUUID(),
        email,
        paymentMethod: 'cod',
        shippingAddress: {
          name: 'Ravi',
          line1: '2 Link Road',
          city: 'Mumbai',
          postalCode: '400001',
          country: 'IN',
          phone,
        },
      });
    };
    const orderRow = (number: number) =>
      ctx.platform.order.findFirstOrThrow({ where: { storeId: store.id, number } });

    const placed = await place('ravi@example.com', '+91 98200 11111');
    expect(placed.status, JSON.stringify(placed.body)).toBeLessThan(300);
    const pending = await orderRow(placed.body.orderNumber);
    expect(pending).toMatchObject({ status: 'PENDING_PAYMENT', paymentProvider: 'cod' });
    const hours = (pending.expiresAt!.getTime() - Date.now()) / 3_600_000;
    expect(hours).toBeGreaterThan(11.9);
    expect(hours).toBeLessThanOrEqual(12);
    const emails = await ctx.platform.outboxMessage.findMany({ where: { tenantId: store.id } });
    expect(JSON.stringify(emails.map((e) => e.payload))).toContain(
      'Confirm your cash on delivery order',
    );
    // Not a confirmed order yet: it does not use up the monthly quota.
    const usage = async () =>
      (await ctx.http().get(`${admin}/billing`).set(auth).expect(200)).body.usage.ordersThisMonth;
    expect(await usage()).toBe(0);

    // A forged or wrong token is rejected; the real one confirms once.
    await sf('post', `/orders/confirm/${pending.id}.forged`).expect(404);
    const token = ctx.app.get(StoreUrls).codConfirmationToken(pending.id);
    const confirmed = await sf('post', `/orders/confirm/${token}`).expect(200);
    expect(confirmed.body).toMatchObject({ orderNumber: pending.number, alreadyConfirmed: false });
    expect(await orderRow(pending.number)).toMatchObject({ status: 'OPEN', expiresAt: null });
    expect((await sf('post', `/orders/confirm/${token}`).expect(200)).body.alreadyConfirmed).toBe(
      true,
    );
    expect(await usage()).toBe(1);

    // Unconfirmed orders expire and release their stock.
    const ghost = await place('ghost@example.com', '9000000001');
    const ghostRow = await orderRow(ghost.body.orderNumber);
    await ctx.platform.order.update({
      where: { id: ghostRow.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    await ctx.app.get(OrderLifecycle).expireStaleOrders();
    expect(await orderRow(ghost.body.orderNumber)).toMatchObject({
      status: 'CANCELLED',
      cancelReason: 'cod_not_confirmed',
    });
    await sf(
      'post',
      `/orders/confirm/${ctx.app.get(StoreUrls).codConfirmationToken(ghostRow.id)}`,
    ).expect(404);

    // One phone number can hold at most 3 open cash orders (written any way).
    expect((await place('a1@example.com', '98200 11111')).status).toBeLessThan(300);
    expect((await place('a2@example.com', '+919820011111')).status).toBeLessThan(300);
    const blocked = await place('a3@example.com', '098200-11111');
    expect(blocked.status).toBe(429);
    expect(blocked.body.detail).toMatch(/cash on delivery orders waiting/);
  });
});
