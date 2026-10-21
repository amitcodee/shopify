import { parseCsv } from '@repo/contracts';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, merchantWithStore, resetDatabase, type TestContext } from './utils.js';

describe('Product CSV import/export', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp();
    await resetDatabase(ctx.owner);
  });

  afterAll(async () => {
    await ctx?.close();
  });

  it('exports a catalog that imports into another store unchanged', async () => {
    const a = await merchantWithStore(ctx);
    const adminA = `/api/v1/admin/stores/${a.store.id}`;
    await ctx
      .http()
      .post(`${adminA}/products`)
      .set(a.auth)
      .send({
        title: 'Rain Jacket',
        status: 'ACTIVE',
        description: 'Waterproof, "really".',
        tags: ['outdoor'],
        options: [{ name: 'Size', values: ['M', 'L'] }],
        variants: [
          { options: ['M'], price: 8950, sku: 'RJ-M', inventoryQuantity: 4 },
          { options: ['L'], price: 9950, sku: 'RJ-L', compareAtPrice: 12000, inventoryQuantity: 2 },
        ],
      })
      .expect(201);
    await ctx
      .http()
      .post(`${adminA}/products`)
      .set(a.auth)
      .send({ title: '=cmd|calc', variants: [{ price: 100, trackInventory: false }] })
      .expect(201);

    const exported = await ctx.http().get(`${adminA}/product-csv/export`).set(a.auth).expect(200);
    expect(exported.body.filename).toMatch(/^products-\d{4}-\d{2}-\d{2}\.csv$/);
    const rows = parseCsv(exported.body.csv);
    expect(rows).toHaveLength(4); // header + 2 variants + 1
    expect(rows[3]?.[1]).toBe("'=cmd|calc"); // formula neutralized for spreadsheets

    const b = await merchantWithStore(ctx);
    const adminB = `/api/v1/admin/stores/${b.store.id}`;
    const upload = () =>
      ctx
        .http()
        .post(`${adminB}/product-csv/import`)
        .set(b.auth)
        .attach('file', Buffer.from(exported.body.csv), {
          filename: 'products.csv',
          contentType: 'text/csv',
        });
    const imported = await upload().expect(200);
    expect(imported.body.errors).toEqual([]);
    expect(imported.body.created.map((c: { handle: string }) => c.handle)).toEqual([
      'rain-jacket',
      'cmd-calc',
    ]);

    const list = await ctx.http().get(`${adminB}/products`).set(b.auth).expect(200);
    const jacketId = list.body.items.find((p: { handle: string }) => p.handle === 'rain-jacket').id;
    const jacket = await ctx.http().get(`${adminB}/products/${jacketId}`).set(b.auth).expect(200);
    expect(jacket.body).toMatchObject({
      status: 'ACTIVE',
      description: 'Waterproof, "really".',
      tags: ['outdoor'],
    });
    expect(
      jacket.body.variants.map(
        (v: {
          sku: string;
          price: number;
          compareAtPrice: number | null;
          inventoryQuantity: number;
        }) => [v.sku, v.price, v.compareAtPrice, v.inventoryQuantity],
      ),
    ).toEqual([
      ['RJ-M', 8950, null, 4],
      ['RJ-L', 9950, 12000, 2],
    ]);

    // Importing again never overwrites: existing handles are skipped.
    const again = await upload().expect(200);
    expect(again.body.created).toEqual([]);
    expect(again.body.skipped.map((s: { handle: string }) => s.handle)).toEqual([
      'rain-jacket',
      'cmd-calc',
    ]);
  });

  it('reports invalid rows and still imports the valid products', async () => {
    const m = await merchantWithStore(ctx);
    const admin = `/api/v1/admin/stores/${m.store.id}`;
    const csv = [
      'Handle,Title,Option1 Name,Option1 Value,Variant Price,Variant SKU',
      'mug,Mug,,,12.00,MUG-1',
      'shirt,Shirt,Size,S,20.00,SH-S',
      'shirt,,,S,21.00,SH-S2',
      'cheap,,,,abc,',
    ].join('\n');
    const res = await ctx
      .http()
      .post(`${admin}/product-csv/import`)
      .set(m.auth)
      .attach('file', Buffer.from(csv), { filename: 'p.csv', contentType: 'text/csv' })
      .expect(200);
    expect(res.body.created).toEqual([{ handle: 'mug', title: 'Mug' }]);
    expect(res.body.errors).toEqual(
      expect.arrayContaining([
        { row: 5, message: 'Variant Price "abc" is not a price.' },
        expect.objectContaining({
          row: 3,
          message: expect.stringContaining('shirt: Duplicate variant'),
        }),
      ]),
    );

    await ctx
      .http()
      .post(`${admin}/product-csv/import`)
      .set(m.auth)
      .attach('file', Buffer.from('Handle,Title,Variant Price\n"open,x,1'), {
        filename: 'p.csv',
        contentType: 'text/csv',
      })
      .expect(400);
    // Another merchant cannot read this store's catalog.
    const other = await merchantWithStore(ctx);
    await ctx.http().get(`${admin}/product-csv/export`).set(other.auth).expect(404);
  });
});
