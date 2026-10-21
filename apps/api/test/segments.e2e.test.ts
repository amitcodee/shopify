import { randomUUID } from 'node:crypto';
import { parseCsv } from '@repo/contracts';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  createTestApp,
  merchantWithStore,
  payMock,
  resetDatabase,
  storefrontClient,
  type TestContext,
} from './utils.js';

const address = { name: 'A', line1: '1 Way', city: 'Town', postalCode: '1', country: 'GB' };

describe('Customer segments', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp();
    await resetDatabase(ctx.owner);
  });

  afterAll(async () => {
    await ctx?.close();
  });

  it('matches customers by paid orders, spend, recency and consent', async () => {
    const m = await merchantWithStore(ctx);
    const admin = `/api/v1/admin/stores/${m.store.id}`;
    const sf = storefrontClient(ctx, `${m.store.subdomain}.localhost:3200`);
    const product = await ctx
      .http()
      .post(`${admin}/products`)
      .set(m.auth)
      .send({ title: 'Mug', status: 'ACTIVE', variants: [{ price: 1000, inventoryQuantity: 50 }] })
      .expect(201);
    const buy = async (email: string, quantity: number, pay = true) => {
      const cart = (await sf('post', '/cart').expect(201)).body.token as string;
      await sf('post', '/cart/lines', { cart })
        .send({ variantId: product.body.variants[0].id, quantity })
        .expect(201);
      const placed = await sf('post', '/checkout', { cart })
        .send({ email, shippingAddress: address, idempotencyKey: randomUUID() })
        .expect(201);
      if (pay) await payMock(sf, placed.body.paymentUrl);
    };
    await buy('loyal@example.com', 3);
    await buy('loyal@example.com', 2);
    await buy('once@example.com', 1);
    await buy('unpaid@example.com', 9, false); // never paid: 0 orders
    await ctx.platform.customer.updateMany({
      where: { storeId: m.store.id, email: 'loyal@example.com' },
      data: { acceptsMarketing: true },
    });
    // "once" ordered long ago.
    await ctx.platform.order.updateMany({
      where: { storeId: m.store.id, email: 'once@example.com' },
      data: { paidAt: new Date(Date.now() - 200 * 86_400_000) },
    });

    const preview = (conditions: object[]) =>
      ctx
        .http()
        .post(`${admin}/segments/preview`)
        .set(m.auth)
        .send({ conditions })
        .expect(200)
        .then((r) => r.body.customerCount as number);
    expect(await preview([])).toBe(3);
    expect(await preview([{ field: 'ordersCount', op: 'gte', value: 2 }])).toBe(1);
    expect(await preview([{ field: 'ordersCount', op: 'eq', value: 0 }])).toBe(1);
    expect(await preview([{ field: 'totalSpent', op: 'gte', value: 1000 }])).toBe(2);
    expect(await preview([{ field: 'lastOrderDaysAgo', op: 'gte', value: 90 }])).toBe(1); // lapsed
    expect(await preview([{ field: 'lastOrderDaysAgo', op: 'lte', value: 30 }])).toBe(1);
    expect(await preview([{ field: 'createdDaysAgo', op: 'lte', value: 7 }])).toBe(3);
    expect(
      await preview([
        { field: 'acceptsMarketing', value: true },
        { field: 'totalSpent', op: 'gte', value: 5000 },
      ]),
    ).toBe(1);

    const vip = await ctx
      .http()
      .post(`${admin}/segments`)
      .set(m.auth)
      .send({ name: 'VIP', conditions: [{ field: 'totalSpent', op: 'gte', value: 4000 }] })
      .expect(201);
    expect(vip.body.customerCount).toBe(1);
    const members = await ctx
      .http()
      .get(`${admin}/segments/${vip.body.id}/customers`)
      .set(m.auth)
      .expect(200);
    expect(members.body.items).toEqual([
      expect.objectContaining({ email: 'loyal@example.com', ordersCount: 2, totalSpent: 5000 }),
    ]);
    const exported = await ctx
      .http()
      .get(`${admin}/segments/${vip.body.id}/export`)
      .set(m.auth)
      .expect(200);
    expect(parseCsv(exported.body.csv)[1]?.slice(0, 4)).toEqual([
      'loyal@example.com',
      'A',
      'yes',
      '2',
    ]);

    await ctx
      .http()
      .post(`${admin}/segments`)
      .set(m.auth)
      .send({ name: 'Bad', conditions: [{ field: 'password', op: 'eq', value: 1 }] })
      .expect(400);
    const listed = await ctx.http().get(`${admin}/segments`).set(m.auth).expect(200);
    expect(listed.body).toEqual([expect.objectContaining({ name: 'VIP', customerCount: 1 })]);

    const other = await merchantWithStore(ctx);
    await ctx
      .http()
      .get(`/api/v1/admin/stores/${other.store.id}/segments/${vip.body.id}/customers`)
      .set(other.auth)
      .expect(404);
    expect(
      (
        await ctx
          .http()
          .post(`/api/v1/admin/stores/${other.store.id}/segments/preview`)
          .set(other.auth)
          .send({ conditions: [] })
          .expect(200)
      ).body.customerCount,
    ).toBe(0);
  });
});
