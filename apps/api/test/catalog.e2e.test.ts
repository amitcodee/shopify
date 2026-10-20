import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, merchantWithStore, resetDatabase, type TestContext } from './utils.js';

const tshirt = {
  title: 'Classic Tee',
  description: 'Soft cotton tee.',
  status: 'ACTIVE',
  tags: ['Summer', 'cotton', 'summer'],
  options: [
    { name: 'Size', values: ['S', 'M'] },
    { name: 'Color', values: ['Red', 'Blue'] },
  ],
  variants: [
    { options: ['S', 'Red'], price: 1999, sku: 'TEE-S-RED', inventoryQuantity: 10 },
    { options: ['S', 'Blue'], price: 1999, sku: 'TEE-S-BLUE', inventoryQuantity: 5 },
    { options: ['M', 'Red'], price: 2199, sku: 'TEE-M-RED' },
    { options: ['M', 'Blue'], price: 2199, sku: 'TEE-M-BLUE', trackInventory: false },
  ],
};

describe('Catalog', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp();
    await resetDatabase(ctx.owner);
  });

  afterAll(async () => {
    await ctx?.close();
  });

  describe('products & variants', () => {
    it('creates a product with options, variants, handle, tags and initial stock ledger', async () => {
      const { store, auth } = await merchantWithStore(ctx);
      const res = await ctx
        .http()
        .post(`/api/v1/admin/stores/${store.id}/products`)
        .set(auth)
        .send(tshirt)
        .expect(201);

      expect(res.body).toMatchObject({
        title: 'Classic Tee',
        handle: 'classic-tee',
        status: 'ACTIVE',
        tags: ['summer', 'cotton'],
        options: [{ name: 'Size' }, { name: 'Color' }],
      });
      expect(res.body.variants.map((v: { title: string }) => v.title)).toEqual([
        'S / Red',
        'S / Blue',
        'M / Red',
        'M / Blue',
      ]);
      expect(res.body.variants[0].inventoryQuantity).toBe(10);

      const history = await ctx
        .http()
        .get(`/api/v1/admin/stores/${store.id}/inventory/${res.body.variants[0].id}/history`)
        .set(auth)
        .expect(200);
      expect(history.body).toEqual([expect.objectContaining({ delta: 10, reason: 'INITIAL' })]);

      const second = await ctx
        .http()
        .post(`/api/v1/admin/stores/${store.id}/products`)
        .set(auth)
        .send({
          ...tshirt,
          variants: [{ ...tshirt.variants[0], sku: null }],
          options: [tshirt.options[0], { name: 'Color', values: ['Red'] }],
        })
        .expect(201);
      expect(second.body.handle).toBe('classic-tee-2');
    });

    it('validates variant combinations and option values', async () => {
      const { store, auth } = await merchantWithStore(ctx);
      const url = `/api/v1/admin/stores/${store.id}/products`;

      const wrongValue = await ctx
        .http()
        .post(url)
        .set(auth)
        .send({ ...tshirt, variants: [{ options: ['XL', 'Red'], price: 1 }] })
        .expect(400);
      expect(JSON.stringify(wrongValue.body.errors)).toMatch(/not a value of option Size/);

      await ctx
        .http()
        .post(url)
        .set(auth)
        .send({ ...tshirt, variants: [tshirt.variants[0], { ...tshirt.variants[0], sku: 'X' }] })
        .expect(400);

      await ctx.http().post(url).set(auth).send({ title: 'No variants', variants: [] }).expect(400);

      await ctx
        .http()
        .post(url)
        .set(auth)
        .send({ title: 'Negative', variants: [{ price: -1 }] })
        .expect(400);
    });

    it('rejects duplicate SKUs within a store with 409 but allows them across stores', async () => {
      const a = await merchantWithStore(ctx);
      const b = await merchantWithStore(ctx);
      const body = { title: 'Mug', variants: [{ price: 900, sku: 'MUG-1' }] };

      await ctx
        .http()
        .post(`/api/v1/admin/stores/${a.store.id}/products`)
        .set(a.auth)
        .send(body)
        .expect(201);
      await ctx
        .http()
        .post(`/api/v1/admin/stores/${a.store.id}/products`)
        .set(a.auth)
        .send(body)
        .expect(409);
      await ctx
        .http()
        .post(`/api/v1/admin/stores/${b.store.id}/products`)
        .set(b.auth)
        .send(body)
        .expect(201);
    });

    it('updates a product: keeps, edits, adds and removes variants', async () => {
      const { store, auth } = await merchantWithStore(ctx);
      const base = `/api/v1/admin/stores/${store.id}/products`;
      const created = await ctx.http().post(base).set(auth).send(tshirt).expect(201);
      const [sRed, sBlue] = created.body.variants;

      const updated = await ctx
        .http()
        .put(`${base}/${created.body.id}`)
        .set(auth)
        .send({
          ...tshirt,
          title: 'Classic Tee v2',
          handle: 'classic-tee-v2',
          options: [
            { name: 'Size', values: ['S', 'L'] },
            { name: 'Color', values: ['Red', 'Blue'] },
          ],
          variants: [
            {
              id: sRed.id,
              options: ['S', 'Red'],
              price: 2500,
              sku: 'TEE-S-RED',
              inventoryQuantity: 999,
            },
            { options: ['L', 'Red'], price: 2600, sku: 'TEE-L-RED', inventoryQuantity: 3 },
          ],
        })
        .expect(200);

      expect(updated.body.handle).toBe('classic-tee-v2');
      expect(updated.body.variants).toHaveLength(2);
      const kept = updated.body.variants.find((v: { id: string }) => v.id === sRed.id);
      expect(kept).toMatchObject({ price: 2500, inventoryQuantity: 10 }); // stock not overwritten
      expect(updated.body.variants.some((v: { id: string }) => v.id === sBlue.id)).toBe(false);

      const foreign = await merchantWithStore(ctx);
      const foreignProduct = await ctx
        .http()
        .post(`/api/v1/admin/stores/${foreign.store.id}/products`)
        .set(foreign.auth)
        .send({ title: 'Other', variants: [{ price: 1 }] })
        .expect(201);
      // A variant id from another product/store cannot be smuggled in.
      await ctx
        .http()
        .put(`${base}/${created.body.id}`)
        .set(auth)
        .send({ title: 'x', variants: [{ id: foreignProduct.body.variants[0].id, price: 1 }] })
        .expect(400);
    });

    it('lists with search and status filters, then deletes', async () => {
      const { store, auth } = await merchantWithStore(ctx);
      const base = `/api/v1/admin/stores/${store.id}/products`;
      await ctx.http().post(base).set(auth).send(tshirt).expect(201);
      const draft = await ctx
        .http()
        .post(base)
        .set(auth)
        .send({ title: 'Hidden Hat', variants: [{ price: 500 }] })
        .expect(201);

      const all = await ctx.http().get(base).set(auth).expect(200);
      expect(all.body.total).toBe(2);
      const tee = all.body.items.find((p: { title: string }) => p.title === 'Classic Tee');
      expect(tee).toMatchObject({
        variantCount: 4,
        totalInventory: 15,
        minPrice: 1999,
        maxPrice: 2199,
      });

      const drafts = await ctx.http().get(base).query({ status: 'DRAFT' }).set(auth).expect(200);
      expect(drafts.body.items.map((p: { id: string }) => p.id)).toEqual([draft.body.id]);

      const bySku = await ctx.http().get(base).query({ q: 'tee-m-red' }).set(auth).expect(200);
      expect(bySku.body.total).toBe(1);

      await ctx.http().delete(`${base}/${draft.body.id}`).set(auth).expect(204);
      await ctx.http().get(`${base}/${draft.body.id}`).set(auth).expect(404);
    });
  });

  describe('images', () => {
    it('accepts real images, re-encodes to WebP, serves them, and rejects SVG', async () => {
      const { store, auth } = await merchantWithStore(ctx);
      const product = await ctx
        .http()
        .post(`/api/v1/admin/stores/${store.id}/products`)
        .set(auth)
        .send({ title: 'Poster', variants: [{ price: 1000 }] })
        .expect(201);
      const url = `/api/v1/admin/stores/${store.id}/products/${product.body.id}/images`;

      const png = await sharp({
        create: { width: 40, height: 20, channels: 3, background: '#ff0000' },
      })
        .png()
        .toBuffer();
      const res = await ctx
        .http()
        .post(url)
        .set(auth)
        .field('alt', 'Red poster')
        .attach('file', png, { filename: 'poster.png', contentType: 'image/png' })
        .expect(201);
      const image = res.body.images[0];
      expect(image).toMatchObject({ alt: 'Red poster', width: 40, height: 20 });

      const mediaPath = new URL(image.url).pathname;
      const media = await ctx.http().get(mediaPath).expect(200);
      expect(media.headers['content-type']).toBe('image/webp');
      expect(media.headers['content-security-policy']).toMatch(/sandbox/);

      const svg = Buffer.from(
        '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><script>alert(1)</script></svg>',
      );
      await ctx
        .http()
        .post(url)
        .set(auth)
        .attach('file', svg, { filename: 'evil.png', contentType: 'image/png' })
        .expect(415);

      await ctx.http().get('/api/v1/media/../../package.json').expect(404);

      await ctx.http().delete(`${url}/${image.id}`).set(auth).expect(200);
      await ctx.http().get(mediaPath).expect(404);
    });
  });

  describe('inventory', () => {
    it('adjusts stock by delta or count, blocks negatives, and records history', async () => {
      const { store, auth } = await merchantWithStore(ctx);
      const product = await ctx
        .http()
        .post(`/api/v1/admin/stores/${store.id}/products`)
        .set(auth)
        .send({ title: 'Candle', variants: [{ price: 1500, inventoryQuantity: 4 }] })
        .expect(201);
      const variantId = product.body.variants[0].id;
      const url = `/api/v1/admin/stores/${store.id}/inventory/${variantId}`;

      const restock = await ctx
        .http()
        .post(`${url}/adjust`)
        .set(auth)
        .send({ delta: 6, reason: 'RESTOCK' })
        .expect(201);
      expect(restock.body.inventoryQuantity).toBe(10);

      const counted = await ctx
        .http()
        .post(`${url}/adjust`)
        .set(auth)
        .send({ setTo: 7, reason: 'CORRECTION', note: 'cycle count' })
        .expect(201);
      expect(counted.body.inventoryQuantity).toBe(7);

      await ctx.http().post(`${url}/adjust`).set(auth).send({ delta: -8 }).expect(409);
      await ctx.http().post(`${url}/adjust`).set(auth).send({ delta: 1, setTo: 2 }).expect(400);

      const history = await ctx.http().get(`${url}/history`).set(auth).expect(200);
      expect(history.body.map((h: { delta: number }) => h.delta)).toEqual([-3, 6, 4]);

      const low = await ctx
        .http()
        .get(`/api/v1/admin/stores/${store.id}/inventory`)
        .query({ lowStock: 'true' })
        .set(auth)
        .expect(200);
      expect(low.body.total).toBe(0);

      // Deleting the product cascades through the append-only ledger (FK actions run as owner).
      await ctx
        .http()
        .delete(`/api/v1/admin/stores/${store.id}/products/${product.body.id}`)
        .set(auth)
        .expect(204);
      expect(await ctx.platform.inventoryAdjustment.count({ where: { variantId } })).toBe(0);
    });

    it('serializes concurrent adjustments without losing updates', async () => {
      const { store, auth } = await merchantWithStore(ctx);
      const product = await ctx
        .http()
        .post(`/api/v1/admin/stores/${store.id}/products`)
        .set(auth)
        .send({ title: 'Popular', variants: [{ price: 100, inventoryQuantity: 0 }] })
        .expect(201);
      const url = `/api/v1/admin/stores/${store.id}/inventory/${product.body.variants[0].id}/adjust`;

      await Promise.all(
        Array.from({ length: 10 }, () =>
          ctx.http().post(url).set(auth).send({ delta: 1 }).expect(201),
        ),
      );
      const variant = await ctx.platform.productVariant.findUniqueOrThrow({
        where: { id: product.body.variants[0].id },
      });
      expect(variant.inventoryQuantity).toBe(10);
    });
  });

  describe('collections', () => {
    it('supports manual and tag-based collections', async () => {
      const { store, auth } = await merchantWithStore(ctx);
      const products = `/api/v1/admin/stores/${store.id}/products`;
      const collections = `/api/v1/admin/stores/${store.id}/collections`;
      const tee = await ctx.http().post(products).set(auth).send(tshirt).expect(201);
      const hat = await ctx
        .http()
        .post(products)
        .set(auth)
        .send({ title: 'Hat', status: 'ACTIVE', tags: ['summer'], variants: [{ price: 1 }] })
        .expect(201);

      const manual = await ctx
        .http()
        .post(collections)
        .set(auth)
        .send({ title: 'Staff Picks' })
        .expect(201);
      const filled = await ctx
        .http()
        .put(`${collections}/${manual.body.id}/products`)
        .set(auth)
        .send({ productIds: [hat.body.id, tee.body.id] })
        .expect(200);
      expect(filled.body.productIds).toEqual([hat.body.id, tee.body.id]);

      const auto = await ctx
        .http()
        .post(collections)
        .set(auth)
        .send({ title: 'Summer', ruleTag: 'Summer' })
        .expect(201);
      expect(auto.body.productCount).toBe(2);
      await ctx
        .http()
        .put(`${collections}/${auto.body.id}/products`)
        .set(auth)
        .send({ productIds: [] })
        .expect(400);

      const detail = await ctx.http().get(`${products}/${tee.body.id}`).set(auth).expect(200);
      expect(detail.body.collectionIds).toEqual([manual.body.id]);

      await ctx.http().delete(`${collections}/${manual.body.id}`).set(auth).expect(204);
    });
  });

  describe('tenant isolation', () => {
    it("never exposes or mutates another store's catalog", async () => {
      const alice = await merchantWithStore(ctx);
      const bob = await merchantWithStore(ctx);
      const product = await ctx
        .http()
        .post(`/api/v1/admin/stores/${alice.store.id}/products`)
        .set(alice.auth)
        .send(tshirt)
        .expect(201);
      const productId = product.body.id;
      const variantId = product.body.variants[0].id;

      // Bob addresses Alice's store directly: 404.
      await ctx
        .http()
        .get(`/api/v1/admin/stores/${alice.store.id}/products/${productId}`)
        .set(bob.auth)
        .expect(404);

      // Bob uses his own store id with Alice's resource ids: still 404.
      const bobBase = `/api/v1/admin/stores/${bob.store.id}`;
      await ctx.http().get(`${bobBase}/products/${productId}`).set(bob.auth).expect(404);
      await ctx
        .http()
        .put(`${bobBase}/products/${productId}`)
        .set(bob.auth)
        .send(tshirt)
        .expect(404);
      await ctx.http().delete(`${bobBase}/products/${productId}`).set(bob.auth).expect(404);
      await ctx
        .http()
        .post(`${bobBase}/inventory/${variantId}/adjust`)
        .set(bob.auth)
        .send({ delta: -5 })
        .expect(404);
      await ctx
        .http()
        .get(`${bobBase}/inventory/${variantId}/history`)
        .set(bob.auth)
        .expect(200)
        .expect([]);

      const list = await ctx.http().get(`${bobBase}/products`).set(bob.auth).expect(200);
      expect(list.body.total).toBe(0);

      // Bob cannot put Alice's product into his collection.
      const collection = await ctx
        .http()
        .post(`${bobBase}/collections`)
        .set(bob.auth)
        .send({ title: 'Steal' })
        .expect(201);
      await ctx
        .http()
        .put(`${bobBase}/collections/${collection.body.id}/products`)
        .set(bob.auth)
        .send({ productIds: [productId] })
        .expect(400);

      const untouched = await ctx.platform.productVariant.findUniqueOrThrow({
        where: { id: variantId },
      });
      expect(untouched.inventoryQuantity).toBe(10);
    });

    it('enforces products permissions for staff', async () => {
      const owner = await merchantWithStore(ctx);
      const viewer = await merchantWithStore(ctx);
      await ctx.platform.storeMember.create({
        data: {
          storeId: owner.store.id,
          userId: viewer.session.user.id,
          role: 'STAFF',
          permissions: ['products:read'],
        },
      });
      const base = `/api/v1/admin/stores/${owner.store.id}/products`;
      await ctx.http().get(base).set(viewer.auth).expect(200);
      await ctx.http().post(base).set(viewer.auth).send(tshirt).expect(403);
    });
  });
});
