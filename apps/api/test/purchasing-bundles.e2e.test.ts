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

describe('Suppliers, purchase orders, bundles and customizations', () => {
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

  /** Stock of non-bundle variants always equals the sum over locations. */
  async function expectConsistent(storeId: string) {
    const variants = await ctx.platform.productVariant.findMany({
      where: { storeId, trackInventory: true, product: { isBundle: false } },
      include: { levels: true },
    });
    for (const v of variants) {
      expect(
        v.levels.reduce((s, l) => s + l.available, 0),
        v.title,
      ).toBe(v.inventoryQuantity);
    }
  }

  async function stock(variantId: string) {
    const v = await ctx.platform.productVariant.findUniqueOrThrow({ where: { id: variantId } });
    return v.inventoryQuantity;
  }

  it('manages suppliers and receives purchase orders into a location', async () => {
    const m = await merchantWithStore(ctx);
    const admin = `/api/v1/admin/stores/${m.store.id}`;
    const http = () => ctx.http();

    const supplier = (
      await http()
        .post(`${admin}/suppliers`)
        .set(m.auth)
        .send({ name: 'Acme Ceramics', email: 'Orders@Acme.example', leadTimeDays: 7 })
        .expect(201)
    ).body;
    expect(supplier).toMatchObject({
      name: 'Acme Ceramics',
      email: 'orders@acme.example',
      productCount: 0,
      openPurchaseOrders: 0,
    });
    await http().post(`${admin}/suppliers`).set(m.auth).send({ name: 'Acme Ceramics' }).expect(409);
    await http()
      .post(`${admin}/suppliers`)
      .set(m.auth)
      .send({ name: 'Bad', website: 'javascript:alert(1)' })
      .expect(400);

    const mug = (
      await http()
        .post(`${admin}/products`)
        .set(m.auth)
        .send({
          title: 'Mug',
          status: 'ACTIVE',
          supplierId: supplier.id,
          options: [{ name: 'Colour', values: ['White', 'Black'] }],
          variants: [
            { options: ['White'], price: 1200, inventoryQuantity: 2, sku: 'MUG-W' },
            { options: ['Black'], price: 1200, inventoryQuantity: 30, sku: 'MUG-B' },
          ],
        })
        .expect(201)
    ).body;
    expect(mug.supplierId).toBe(supplier.id);
    const [white, black] = mug.variants as { id: string }[];
    const listed = await http()
      .get(`${admin}/products`)
      .query({ supplierId: supplier.id })
      .set(m.auth)
      .expect(200);
    expect(listed.body.items).toEqual([
      expect.objectContaining({ id: mug.id, supplierName: 'Acme Ceramics' }),
    ]);

    // Only the low-stock variant is suggested, topped up to the reorder target (20).
    const reorder = await http()
      .get(`${admin}/suppliers/${supplier.id}/reorder`)
      .set(m.auth)
      .expect(200);
    expect(reorder.body).toEqual([
      expect.objectContaining({
        variantId: white!.id,
        inventoryQuantity: 2,
        suggestedQuantity: 18,
      }),
    ]);

    const locations = (
      await http()
        .post(`${admin}/locations`)
        .set(m.auth)
        .send({ name: 'Warehouse', priority: 1 })
        .expect(201)
    ).body as { id: string; name: string }[];
    const warehouse = locations.find((l) => l.name === 'Warehouse')!.id;

    const draft = await http()
      .post(`${admin}/purchase-orders`)
      .set(m.auth)
      .send({
        supplierId: supplier.id,
        locationId: warehouse,
        expectedAt: '2020-01-01',
        shippingCost: 500,
        lines: [{ variantId: white!.id, quantity: 18, unitCost: 400, supplierSku: 'AC-1' }],
      })
      .expect(201);
    expect(draft.body).toMatchObject({
      name: '#PO1',
      status: 'DRAFT',
      subtotal: 7200,
      total: 7700,
      overdue: false,
      lines: [
        expect.objectContaining({ productTitle: 'Mug', variantTitle: 'White', sku: 'MUG-W' }),
      ],
    });
    const poId = draft.body.id as string;
    const lineId = draft.body.lines[0].id as string;

    // Drafts cannot be received; once ordered the items are fixed.
    await http()
      .post(`${admin}/purchase-orders/${poId}/receive`)
      .set(m.auth)
      .send({ lines: [{ lineId, quantity: 1 }] })
      .expect(409);
    const ordered = await http()
      .post(`${admin}/purchase-orders/${poId}/actions`)
      .set(m.auth)
      .send({ action: 'mark_ordered' })
      .expect(200);
    expect(ordered.body).toMatchObject({ status: 'ORDERED', overdue: true });
    await http()
      .put(`${admin}/purchase-orders/${poId}`)
      .set(m.auth)
      .send({
        supplierId: supplier.id,
        locationId: warehouse,
        lines: [{ variantId: white!.id, quantity: 1, unitCost: 1 }],
      })
      .expect(409);
    expect(
      (await http().get(`${admin}/suppliers/${supplier.id}`).set(m.auth).expect(200)).body,
    ).toMatchObject({ productCount: 1, openPurchaseOrders: 1 });
    // Units on the way are not suggested again.
    expect(
      (await http().get(`${admin}/suppliers/${supplier.id}/reorder`).set(m.auth).expect(200)).body,
    ).toEqual([]);

    // Partial receipt into the warehouse, updating the cost per item.
    const partial = await http()
      .post(`${admin}/purchase-orders/${poId}/receive`)
      .set(m.auth)
      .send({ lines: [{ lineId, quantity: 10 }], updateCost: true })
      .expect(200);
    expect(partial.body).toMatchObject({ status: 'PARTIALLY_RECEIVED', unitsReceived: 10 });
    expect(await stock(white!.id)).toBe(12);
    const level = await ctx.platform.inventoryLevel.findUniqueOrThrow({
      where: { variantId_locationId: { variantId: white!.id, locationId: warehouse } },
    });
    expect(level.available).toBe(10);
    const variant = await ctx.platform.productVariant.findUniqueOrThrow({
      where: { id: white!.id },
    });
    expect(variant.costPerItem).toBe(400);
    const history = await http()
      .get(`${admin}/inventory/${white!.id}/history`)
      .set(m.auth)
      .expect(200);
    expect(history.body[0]).toMatchObject({
      reason: 'PURCHASE_ORDER',
      delta: 10,
      note: 'Received on #PO1',
      locationName: 'Warehouse',
    });

    await http()
      .post(`${admin}/purchase-orders/${poId}/receive`)
      .set(m.auth)
      .send({ lines: [{ lineId, quantity: 9 }] })
      .expect(400);
    await http()
      .post(`${admin}/purchase-orders/${poId}/actions`)
      .set(m.auth)
      .send({ action: 'cancel' })
      .expect(409);
    const done = await http()
      .post(`${admin}/purchase-orders/${poId}/receive`)
      .set(m.auth)
      .send({ lines: [{ lineId, quantity: 8 }] })
      .expect(200);
    expect(done.body).toMatchObject({ status: 'RECEIVED', unitsReceived: 18, overdue: false });
    expect(await stock(white!.id)).toBe(20);
    await expectConsistent(m.store.id);

    // Received orders stay; the supplier cannot be deleted while it has orders.
    await http().delete(`${admin}/purchase-orders/${poId}`).set(m.auth).expect(409);
    await http().delete(`${admin}/suppliers/${supplier.id}`).set(m.auth).expect(409);
    const list = await http()
      .get(`${admin}/purchase-orders`)
      .query({ status: 'RECEIVED' })
      .set(m.auth)
      .expect(200);
    expect(list.body).toMatchObject({
      total: 1,
      items: [expect.objectContaining({ name: '#PO1', supplierName: 'Acme Ceramics' })],
    });

    // A second order is numbered #PO2; cancelling and deleting a draft works.
    const second = await http()
      .post(`${admin}/purchase-orders`)
      .set(m.auth)
      .send({
        supplierId: supplier.id,
        locationId: warehouse,
        lines: [{ variantId: black!.id, quantity: 5, unitCost: 300 }],
      })
      .expect(201);
    expect(second.body.name).toBe('#PO2');
    await http()
      .post(`${admin}/purchase-orders/${second.body.id}/actions`)
      .set(m.auth)
      .send({ action: 'cancel' })
      .expect(200);
    await http().delete(`${admin}/purchase-orders/${second.body.id}`).set(m.auth).expect(204);

    // Other stores see none of it.
    const other = await merchantWithStore(ctx);
    const otherAdmin = `/api/v1/admin/stores/${other.store.id}`;
    await http().get(`${otherAdmin}/purchase-orders/${poId}`).set(other.auth).expect(404);
    await http().get(`${otherAdmin}/suppliers/${supplier.id}`).set(other.auth).expect(404);
    await http()
      .post(`${otherAdmin}/products`)
      .set(other.auth)
      .send({ title: 'X', supplierId: supplier.id, variants: [{ price: 1 }] })
      .expect(400);
    const otherSupplier = (
      await http()
        .post(`${otherAdmin}/suppliers`)
        .set(other.auth)
        .send({ name: 'Mine' })
        .expect(201)
    ).body;
    const otherLocations = (await http().get(`${otherAdmin}/locations`).set(other.auth).expect(200))
      .body as { id: string }[];
    await http()
      .post(`${otherAdmin}/purchase-orders`)
      .set(other.auth)
      .send({
        supplierId: otherSupplier.id,
        locationId: otherLocations[0]!.id,
        lines: [{ variantId: white!.id, quantity: 1, unitCost: 1 }],
      })
      .expect(400);
  });

  it('sells bundles from their components and returns the stock on cancellation', async () => {
    const m = await merchantWithStore(ctx);
    const admin = `/api/v1/admin/stores/${m.store.id}`;
    const http = () => ctx.http();
    const create = async (body: object) =>
      (await http().post(`${admin}/products`).set(m.auth).send(body).expect(201)).body;

    const cup = await create({
      title: 'Cup',
      status: 'ACTIVE',
      variants: [{ price: 800, inventoryQuantity: 10 }],
    });
    const saucer = await create({
      title: 'Saucer',
      status: 'ACTIVE',
      variants: [{ price: 500, inventoryQuantity: 3 }],
    });
    const spoon = await create({
      title: 'Spoon',
      status: 'ACTIVE',
      variants: [{ price: 100, trackInventory: false }],
    });
    const cupId = cup.variants[0].id as string;
    const saucerId = saucer.variants[0].id as string;

    await http()
      .post(`${admin}/products`)
      .set(m.auth)
      .send({ title: 'Empty set', isBundle: true, variants: [{ price: 1 }] })
      .expect(400);

    const set = await create({
      title: 'Tea for two',
      status: 'ACTIVE',
      isBundle: true,
      variants: [
        {
          price: 1800,
          components: [
            { variantId: cupId, quantity: 2 },
            { variantId: saucerId, quantity: 1 },
            { variantId: spoon.variants[0].id, quantity: 2 },
          ],
        },
      ],
    });
    const setId = set.variants[0].id as string;
    // min(10 / 2, 3 / 1); the untracked spoon does not limit it.
    expect(set.variants[0]).toMatchObject({
      inventoryQuantity: 3,
      trackInventory: true,
      allowBackorder: false,
      components: [
        expect.objectContaining({ productTitle: 'Cup', quantity: 2, price: 800 }),
        expect.objectContaining({ productTitle: 'Saucer', quantity: 1 }),
        expect.objectContaining({ productTitle: 'Spoon', quantity: 2 }),
      ],
    });

    // Bundles cannot nest, change kind, hold their own stock or be ordered from suppliers.
    await http()
      .post(`${admin}/products`)
      .set(m.auth)
      .send({
        title: 'Nest',
        isBundle: true,
        variants: [{ price: 1, components: [{ variantId: setId }] }],
      })
      .expect(400);
    await http()
      .put(`${admin}/products/${cup.id}`)
      .set(m.auth)
      .send({
        title: 'Cup',
        isBundle: true,
        variants: [{ id: cupId, price: 800, components: [{ variantId: saucerId }] }],
      })
      .expect(400);
    await http()
      .post(`${admin}/inventory/${setId}/adjust`)
      .set(m.auth)
      .send({ delta: 5 })
      .expect(400);
    const inventory = await http().get(`${admin}/inventory`).set(m.auth).expect(200);
    expect(inventory.body.items.map((i: { variantId: string }) => i.variantId)).not.toContain(
      setId,
    );

    // Restocking a component updates the bundle.
    await http()
      .post(`${admin}/inventory/${saucerId}/adjust`)
      .set(m.auth)
      .send({ delta: 7 })
      .expect(201);
    expect(await stock(setId)).toBe(5);

    const sf = storefrontClient(ctx, `${m.store.subdomain}.localhost:3200`);
    const page = await sf('get', `/products/${set.handle}`).expect(200);
    expect(page.body).toMatchObject({ isBundle: true });
    expect(page.body.variants[0]).toMatchObject({
      available: true,
      componentsPrice: 2300,
      components: [
        { productTitle: 'Cup', variantTitle: 'Default', quantity: 2, productHandle: 'cup' },
        expect.objectContaining({ productTitle: 'Saucer', quantity: 1 }),
        expect.objectContaining({ productTitle: 'Spoon', quantity: 2 }),
      ],
    });

    const cart = (await sf('post', '/cart').expect(201)).body.token as string;
    await sf('post', '/cart/lines', { cart }).send({ variantId: setId, quantity: 6 }).expect(409);
    await sf('post', '/cart/lines', { cart }).send({ variantId: setId, quantity: 2 }).expect(201);
    const placed = await sf('post', '/checkout', { cart })
      .send({ email: 'a@example.com', shippingAddress: address, idempotencyKey: randomUUID() })
      .expect(201);
    expect(await stock(cupId)).toBe(6);
    expect(await stock(saucerId)).toBe(8);
    expect(await stock(setId)).toBe(3);
    await expectConsistent(m.store.id);

    const order = await ctx.platform.order.findFirstOrThrow({
      where: { storeId: m.store.id, number: placed.body.orderNumber },
      include: { lines: true },
    });
    const detail = await http().get(`${admin}/orders/${order.id}`).set(m.auth).expect(200);
    expect(detail.body.lines[0].components).toEqual([
      { title: 'Cup', sku: null, quantity: 2 },
      { title: 'Saucer', sku: null, quantity: 1 },
    ]);

    // The unpaid order expires: the components get their units back.
    await ctx.platform.order.update({
      where: { id: order.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    await lifecycle.expireStaleOrders();
    expect(await stock(cupId)).toBe(10);
    expect(await stock(saucerId)).toBe(10);
    expect(await stock(setId)).toBe(5);
    await expectConsistent(m.store.id);

    // Deleting an item leaves the bundle unsellable rather than selling it short.
    await http().delete(`${admin}/products/${saucer.id}`).set(m.auth).expect(204);
    expect(await stock(setId)).toBe(5); // Cup still limits it...
    const reloaded = await http().get(`${admin}/products/${set.id}`).set(m.auth).expect(200);
    expect(reloaded.body.variants[0].components).toHaveLength(2);
    await http().delete(`${admin}/products/${cup.id}`).set(m.auth).expect(204);
    // ...and with only the untracked spoon left nothing limits it.
    expect(
      (await http().get(`${admin}/products/${set.id}`).set(m.auth).expect(200)).body.variants[0],
    ).toMatchObject({ trackInventory: false });
  });

  it('prices shopper customizations and keeps different answers on separate lines', async () => {
    const m = await merchantWithStore(ctx);
    const admin = `/api/v1/admin/stores/${m.store.id}`;
    const http = () => ctx.http();

    await http()
      .post(`${admin}/products`)
      .set(m.auth)
      .send({
        title: 'Bad',
        customizations: [{ type: 'select', label: 'Font', choices: [{ label: 'Serif' }] }],
        variants: [{ price: 1 }],
      })
      .expect(400);
    await http()
      .post(`${admin}/products`)
      .set(m.auth)
      .send({
        title: 'Bad swatch',
        options: [{ name: 'Colour', values: ['Red'], style: 'swatches', swatches: ['red'] }],
        variants: [{ options: ['Red'], price: 1 }],
      })
      .expect(400);

    const pen = (
      await http()
        .post(`${admin}/products`)
        .set(m.auth)
        .send({
          title: 'Fountain pen',
          status: 'ACTIVE',
          options: [
            {
              name: 'Colour',
              values: ['Ink', 'Gold'],
              style: 'swatches',
              swatches: ['#123', '#D4AF37'],
            },
          ],
          customizations: [
            { type: 'text', label: 'Engraving', required: true, maxLength: 10, price: 500 },
            {
              type: 'select',
              label: 'Box',
              choices: [
                { label: 'Card', price: 0 },
                { label: 'Wood', price: 900 },
              ],
            },
            { type: 'checkbox', label: 'Gift wrap', price: 300 },
          ],
          variants: [
            { options: ['Ink'], price: 4000, inventoryQuantity: 3 },
            { options: ['Gold'], price: 6000, inventoryQuantity: 3 },
          ],
        })
        .expect(201)
    ).body;
    expect(pen.options[0]).toEqual({
      name: 'Colour',
      values: ['Ink', 'Gold'],
      style: 'swatches',
      swatches: ['#112233', '#d4af37'],
    });
    expect(pen.customizations).toHaveLength(3);
    const [engraving, box, wrap] = pen.customizations as { id: string }[];
    const ink = pen.variants[0].id as string;

    // Editing keeps the field ids carts refer to.
    const edited = await http()
      .put(`${admin}/products/${pen.id}`)
      .set(m.auth)
      .send({
        title: 'Fountain pen',
        status: 'ACTIVE',
        options: pen.options,
        customizations: pen.customizations,
        variants: pen.variants.map((v: { id: string; options: string[]; price: number }) => ({
          id: v.id,
          options: v.options,
          price: v.price,
        })),
      })
      .expect(200);
    expect(edited.body.customizations.map((c: { id: string }) => c.id)).toEqual(
      pen.customizations.map((c: { id: string }) => c.id),
    );

    const sf = storefrontClient(ctx, `${m.store.subdomain}.localhost:3200`);
    const page = await sf('get', `/products/${pen.handle}`).expect(200);
    expect(page.body.options[0]).toMatchObject({
      style: 'swatches',
      swatches: ['#112233', '#d4af37'],
    });
    expect(page.body.customizations).toEqual([
      expect.objectContaining({ id: engraving!.id, type: 'text', required: true, price: 500 }),
      expect.objectContaining({
        id: box!.id,
        choices: [
          { label: 'Card', price: 0 },
          { label: 'Wood', price: 900 },
        ],
      }),
      expect.objectContaining({ id: wrap!.id, type: 'checkbox' }),
    ]);

    const cart = (await sf('post', '/cart').expect(201)).body.token as string;
    const add = (customization: { id: string; value: string }[], quantity = 1) =>
      sf('post', '/cart/lines', { cart }).send({ variantId: ink, quantity, customization });
    await add([]).expect(400); // Engraving is required.
    await add([{ id: engraving!.id, value: 'Much too long' }]).expect(400);
    await add([
      { id: engraving!.id, value: 'A.B.' },
      { id: box!.id, value: 'Plastic' },
    ]).expect(400);

    let body = (
      await add(
        [
          { id: engraving!.id, value: '  For Sam ' },
          { id: box!.id, value: 'Wood' },
          { id: wrap!.id, value: 'true' },
        ],
        1,
      ).expect(201)
    ).body;
    expect(body.lines[0]).toMatchObject({
      unitPrice: 4000 + 500 + 900 + 300,
      properties: [
        { label: 'Engraving', value: 'For Sam', price: 500 },
        { label: 'Box', value: 'Wood', price: 900 },
        { label: 'Gift wrap', value: 'Yes', price: 300 },
      ],
    });
    // The same answers add to the line; other answers make a new one.
    body = (
      await add([
        { id: engraving!.id, value: 'For Sam' },
        { id: box!.id, value: 'Wood' },
        { id: wrap!.id, value: 'true' },
      ]).expect(201)
    ).body;
    expect(body.lines).toHaveLength(1);
    expect(body.lines[0].quantity).toBe(2);
    body = (await add([{ id: engraving!.id, value: 'For Alex' }]).expect(201)).body;
    expect(body.lines).toHaveLength(2);
    expect(body.lines[1]).toMatchObject({ unitPrice: 4500, maxQuantity: 1 });
    expect(body.subtotal).toBe(2 * 5700 + 4500);
    // Stock (3) is shared by both lines.
    await add([{ id: engraving!.id, value: 'For Alex' }]).expect(409);

    const placed = await sf('post', '/checkout', { cart })
      .send({ email: 'a@example.com', shippingAddress: address, idempotencyKey: randomUUID() })
      .expect(201);
    expect(await stock(ink)).toBe(0);
    const order = await ctx.platform.order.findFirstOrThrow({
      where: { storeId: m.store.id, number: placed.body.orderNumber },
    });
    expect(order.subtotal).toBe(2 * 5700 + 4500);
    const detail = await http().get(`${admin}/orders/${order.id}`).set(m.auth).expect(200);
    const lines = [...detail.body.lines].sort(
      (a: { unitPrice: number }, b: { unitPrice: number }) => b.unitPrice - a.unitPrice,
    );
    expect(lines[0]).toMatchObject({ unitPrice: 5700, quantity: 2 });
    expect(lines[0].properties).toHaveLength(3);
    expect(lines[1]).toMatchObject({
      unitPrice: 4500,
      quantity: 1,
      properties: [{ label: 'Engraving', value: 'For Alex', price: 500 }],
    });
    await expectConsistent(m.store.id);
  });
});
