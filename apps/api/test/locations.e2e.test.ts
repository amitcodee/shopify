import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { OrderLifecycle } from '../src/orders/order-lifecycle.service.js';
import {
  createTestApp,
  merchantWithStore,
  resetDatabase,
  storefrontClient,
  type TestContext,
} from './utils.js';

const address = { name: 'A', line1: '1 Way', city: 'Town', postalCode: '1', country: 'GB' };

describe('Inventory locations', () => {
  let ctx: TestContext;
  let lifecycle: OrderLifecycle;

  beforeAll(async () => {
    ctx = await createTestApp();
    await resetDatabase(ctx.owner);
    lifecycle = (ctx.app as INestApplication).get(OrderLifecycle);
  });

  afterAll(async () => {
    await ctx?.close();
  });

  /** Total stock always equals the sum over locations. */
  async function expectConsistent(storeId: string) {
    const variants = await ctx.platform.productVariant.findMany({
      where: { storeId, trackInventory: true },
      include: { levels: true },
    });
    for (const v of variants) {
      expect(
        v.levels.reduce((s, l) => s + l.available, 0),
        v.title,
      ).toBe(v.inventoryQuantity);
    }
  }

  it('keeps stock per location, sells from the highest-priority location and restocks there', async () => {
    const m = await merchantWithStore(ctx);
    const admin = `/api/v1/admin/stores/${m.store.id}`;
    const product = await ctx
      .http()
      .post(`${admin}/products`)
      .set(m.auth)
      .send({ title: 'Lamp', status: 'ACTIVE', variants: [{ price: 1000, inventoryQuantity: 4 }] })
      .expect(201);
    const variantId = product.body.variants[0].id as string;

    let locations = (await ctx.http().get(`${admin}/locations`).set(m.auth).expect(200)).body;
    expect(locations).toEqual([
      expect.objectContaining({ name: 'Main location', isDefault: true, unitsOnHand: 4 }),
    ]);
    const main = locations[0].id as string;

    // A warehouse that ships first.
    locations = (
      await ctx
        .http()
        .post(`${admin}/locations`)
        .set(m.auth)
        .send({ name: 'Warehouse', address: '9 Dock Rd', priority: 0 })
        .expect(201)
    ).body;
    await ctx
      .http()
      .put(`${admin}/locations/${main}`)
      .set(m.auth)
      .send({ name: 'Main location', isDefault: true, priority: 5 })
      .expect(200);
    const warehouse = locations.find((l: { name: string }) => l.name === 'Warehouse').id as string;

    const adjusted = await ctx
      .http()
      .post(`${admin}/inventory/${variantId}/adjust`)
      .set(m.auth)
      .send({ delta: 3, reason: 'RESTOCK', locationId: warehouse })
      .expect(201);
    expect(adjusted.body.inventoryQuantity).toBe(7);
    expect(adjusted.body.levels).toEqual(
      expect.arrayContaining([
        { locationId: main, available: 4 },
        { locationId: warehouse, available: 3 },
      ]),
    );
    // "Set to" counts one location.
    const counted = await ctx
      .http()
      .post(`${admin}/inventory/${variantId}/adjust`)
      .set(m.auth)
      .send({ setTo: 2, reason: 'CORRECTION', locationId: main })
      .expect(201);
    expect(counted.body.inventoryQuantity).toBe(5);

    // Buying 4: 3 from the warehouse (priority 0), 1 from main.
    const sf = storefrontClient(ctx, `${m.store.subdomain}.localhost:3200`);
    const cart = (await sf('post', '/cart').expect(201)).body.token as string;
    await sf('post', '/cart/lines', { cart }).send({ variantId, quantity: 4 }).expect(201);
    const placed = await sf('post', '/checkout', { cart })
      .send({ email: 'a@example.com', shippingAddress: address, idempotencyKey: randomUUID() })
      .expect(201);
    const levels = async () =>
      Object.fromEntries(
        (await ctx.platform.inventoryLevel.findMany({ where: { variantId } })).map((l) => [
          l.locationId,
          l.available,
        ]),
      );
    expect(await levels()).toEqual({ [warehouse]: 0, [main]: 1 });
    const order = await ctx.platform.order.findFirstOrThrow({
      where: { storeId: m.store.id, number: placed.body.orderNumber },
      include: { lines: true },
    });
    expect(order.lines[0]?.locationId).toBe(warehouse);
    await expectConsistent(m.store.id);

    // The unpaid order expires: its 4 units go back to the warehouse it shipped from.
    await ctx.platform.order.update({
      where: { id: order.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    await lifecycle.expireStaleOrders();
    expect(await levels()).toEqual({ [warehouse]: 4, [main]: 1 });
    await expectConsistent(m.store.id);

    // Transfers move stock without changing the total.
    const moved = await ctx
      .http()
      .post(`${admin}/inventory/${variantId}/transfer`)
      .set(m.auth)
      .send({ fromLocationId: warehouse, toLocationId: main, quantity: 2 })
      .expect(201);
    expect(moved.body.inventoryQuantity).toBe(5);
    expect(await levels()).toEqual({ [warehouse]: 2, [main]: 3 });
    await ctx
      .http()
      .post(`${admin}/inventory/${variantId}/transfer`)
      .set(m.auth)
      .send({ fromLocationId: warehouse, toLocationId: main, quantity: 9 })
      .expect(409);
    const history = await ctx
      .http()
      .get(`${admin}/inventory/${variantId}/history`)
      .set(m.auth)
      .expect(200);
    expect(history.body[0]).toMatchObject({ reason: 'TRANSFER', locationName: expect.any(String) });
    await expectConsistent(m.store.id);

    // Locations with stock cannot be deleted; the default never can.
    await ctx.http().delete(`${admin}/locations/${warehouse}`).set(m.auth).expect(409);
    await ctx.http().delete(`${admin}/locations/${main}`).set(m.auth).expect(400);
    await ctx
      .http()
      .post(`${admin}/inventory/${variantId}/transfer`)
      .set(m.auth)
      .send({ fromLocationId: warehouse, toLocationId: main, quantity: 2 })
      .expect(201);
    await ctx.http().delete(`${admin}/locations/${warehouse}`).set(m.auth).expect(204);
    await expectConsistent(m.store.id);

    // Another store cannot use these locations.
    const other = await merchantWithStore(ctx);
    await ctx
      .http()
      .put(`/api/v1/admin/stores/${other.store.id}/locations/${main}`)
      .set(other.auth)
      .send({ name: 'Mine', isDefault: true })
      .expect(404);
  });
});
