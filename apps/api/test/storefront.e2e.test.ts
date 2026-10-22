import { STOREFRONT_HEADERS } from '@repo/contracts';
import type { Test as SuperTest } from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { signStorefrontRequest } from '../src/storefront/storefront.guard.js';
import { createTestApp, merchantWithStore, resetDatabase, type TestContext } from './utils.js';

const SECRET = process.env.STOREFRONT_SHARED_SECRET ?? '';

function signed(req: SuperTest, host: string, cartToken?: string): SuperTest {
  const ts = String(Date.now());
  req
    .set(STOREFRONT_HEADERS.host, host)
    .set(STOREFRONT_HEADERS.timestamp, ts)
    .set(STOREFRONT_HEADERS.signature, signStorefrontRequest(SECRET, host, ts));
  if (cartToken) req.set(STOREFRONT_HEADERS.cart, cartToken);
  return req;
}

describe('Storefront', () => {
  let ctx: TestContext;
  let shop: Awaited<ReturnType<typeof merchantWithStore>>;
  let host: string;
  let tee: { id: string; variants: { id: string; title: string }[] };

  const sf = {
    get: (path: string, cart?: string) =>
      signed(ctx.http().get(`/api/v1/storefront${path}`), host, cart),
    post: (path: string, cart?: string) =>
      signed(ctx.http().post(`/api/v1/storefront${path}`), host, cart),
    patch: (path: string, cart?: string) =>
      signed(ctx.http().patch(`/api/v1/storefront${path}`), host, cart),
  };

  beforeAll(async () => {
    ctx = await createTestApp();
    await resetDatabase(ctx.owner);
    shop = await merchantWithStore(ctx);
    host = `${shop.store.subdomain}.localhost:3200`;
    const base = `/api/v1/admin/stores/${shop.store.id}`;

    const created = await ctx
      .http()
      .post(`${base}/products`)
      .set(shop.auth)
      .send({
        title: 'Blue Running Shoe',
        description: 'Lightweight trail runner',
        status: 'ACTIVE',
        tags: ['running', 'summer'],
        options: [{ name: 'Size', values: ['9', '10'] }],
        variants: [
          { options: ['9'], price: 9000, inventoryQuantity: 2 },
          { options: ['10'], price: 9500, inventoryQuantity: 0 },
        ],
      })
      .expect(201);
    tee = created.body;
    await ctx
      .http()
      .post(`${base}/products`)
      .set(shop.auth)
      .send({
        title: 'Cheap Socks',
        status: 'ACTIVE',
        tags: ['summer'],
        variants: [{ price: 500, trackInventory: false }],
      })
      .expect(201);
    await ctx
      .http()
      .post(`${base}/products`)
      .set(shop.auth)
      .send({ title: 'Secret Draft Shoe', status: 'DRAFT', variants: [{ price: 1 }] })
      .expect(201);
    await ctx
      .http()
      .post(`${base}/collections`)
      .set(shop.auth)
      .send({ title: 'Summer', ruleTag: 'summer' })
      .expect(201);
    await ctx
      .http()
      .post(`${base}/collections`)
      .set(shop.auth)
      .send({ title: 'Hidden', published: false })
      .expect(201);
  });

  afterAll(async () => {
    await ctx?.close();
  });

  describe('request signing & store resolution', () => {
    it('rejects unsigned, tampered, and stale requests', async () => {
      await ctx.http().get('/api/v1/storefront/shop').expect(401);

      const ts = String(Date.now());
      await ctx
        .http()
        .get('/api/v1/storefront/shop')
        .set(STOREFRONT_HEADERS.host, 'other-store.localhost')
        .set(STOREFRONT_HEADERS.timestamp, ts)
        .set(STOREFRONT_HEADERS.signature, signStorefrontRequest(SECRET, host, ts))
        .expect(401);

      const old = String(Date.now() - 10 * 60 * 1000);
      await ctx
        .http()
        .get('/api/v1/storefront/shop')
        .set(STOREFRONT_HEADERS.host, host)
        .set(STOREFRONT_HEADERS.timestamp, old)
        .set(STOREFRONT_HEADERS.signature, signStorefrontRequest(SECRET, host, old))
        .expect(401);

      const forged = String(Date.now());
      await ctx
        .http()
        .get('/api/v1/storefront/shop')
        .set(STOREFRONT_HEADERS.host, host)
        .set(STOREFRONT_HEADERS.timestamp, forged)
        .set(
          STOREFRONT_HEADERS.signature,
          signStorefrontRequest('wrong-secret-wrong-secret-wrong-secret', host, forged),
        )
        .expect(401);
    });

    it('resolves the store from the host and 404s unknown hosts', async () => {
      const res = await sf.get('/shop').expect(200);
      expect(res.body).toMatchObject({
        name: 'Test Store',
        currency: 'USD',
        collections: [{ handle: 'summer' }],
      });

      for (const unknown of ['nope.localhost', 'localhost', 'a.b.localhost', 'evil.com']) {
        await signed(ctx.http().get('/api/v1/storefront/shop'), unknown).expect(404);
      }
    });
  });

  describe('catalog', () => {
    it('only shows ACTIVE products, with availability but not stock counts', async () => {
      const list = await sf.get('/products').expect(200);
      expect(list.body.items.map((p: { title: string }) => p.title).sort()).toEqual([
        'Blue Running Shoe',
        'Cheap Socks',
      ]);
      await sf.get('/products/secret-draft-shoe').expect(404);

      const product = await sf.get('/products/blue-running-shoe').expect(200);
      expect(product.body.variants.map((v: { available: boolean }) => v.available)).toEqual([
        true,
        false,
      ]);
      expect(JSON.stringify(product.body)).not.toContain('inventoryQuantity');
    });

    it('searches by prefix across title, tags and description', async () => {
      const shoes = await sf.get('/products').query({ q: 'runn sho' }).expect(200);
      expect(shoes.body.items.map((p: { handle: string }) => p.handle)).toEqual([
        'blue-running-shoe',
      ]);
      // Plurals find the singular, and a word inside the title matches ("unning" in "Running").
      for (const q of ['shoes', 'blue unning']) {
        const found = await sf.get('/products').query({ q }).expect(200);
        expect(found.body.items.map((p: { handle: string }) => p.handle)).toEqual([
          'blue-running-shoe',
        ]);
      }
      const byDescription = await sf.get('/products').query({ q: 'trail' }).expect(200);
      expect(byDescription.body.total).toBe(1);
      const none = await sf.get('/products').query({ q: "'; DROP TABLE" }).expect(200);
      expect(none.body.total).toBe(0);
      const draft = await sf.get('/products').query({ q: 'secret' }).expect(200);
      expect(draft.body.total).toBe(0);
    });

    it('sorts by price and filters by collection; hides unpublished collections', async () => {
      const asc = await sf.get('/products').query({ sort: 'price-asc' }).expect(200);
      expect(asc.body.items.map((p: { minPrice: number }) => p.minPrice)).toEqual([500, 9000]);

      const summer = await sf.get('/products').query({ collection: 'summer' }).expect(200);
      expect(summer.body.total).toBe(2);
      await sf.get('/collections/hidden').expect(404);
      await sf.get('/products').query({ collection: 'hidden' }).expect(404);
    });
  });

  describe('cart', () => {
    it('creates a cart, adds and updates lines, and enforces stock', async () => {
      const created = await sf.post('/cart').expect(201);
      const token = created.body.token as string;
      expect(created.body.cart.lines).toEqual([]);

      const [size9, size10] = tee.variants;
      const added = await sf
        .post('/cart/lines', token)
        .send({ variantId: size9?.id, quantity: 1 })
        .expect(201);
      expect(added.body).toMatchObject({ itemCount: 1, subtotal: 9000 });

      // Same variant again merges; 3 exceeds the 2 in stock.
      const tooMany = await sf
        .post('/cart/lines', token)
        .send({ variantId: size9?.id, quantity: 2 })
        .expect(409);
      expect(tooMany.body.detail).toBe('Only 2 left in stock.');
      await sf.post('/cart/lines', token).send({ variantId: size10?.id, quantity: 1 }).expect(409);

      const lineId = added.body.lines[0].id as string;
      const updated = await sf
        .patch(`/cart/lines/${lineId}`, token)
        .send({ quantity: 2 })
        .expect(200);
      expect(updated.body.subtotal).toBe(18000);

      // Stock drops below the cart quantity: the cart warns and excludes it from the subtotal.
      await ctx
        .http()
        .post(`/api/v1/admin/stores/${shop.store.id}/inventory/${size9?.id}/adjust`)
        .set(shop.auth)
        .send({ setTo: 1, reason: 'CORRECTION' })
        .expect(201);
      const warned = await sf.get('/cart', token).expect(200);
      expect(warned.body.warnings).toEqual(['Only 1 of Blue Running Shoe (9) left in stock.']);
      expect(warned.body.subtotal).toBe(0);

      const removed = await signed(
        ctx.http().delete(`/api/v1/storefront/cart/lines/${lineId}`),
        host,
        token,
      ).expect(200);
      expect(removed.body.lines).toEqual([]);
    });

    it('rejects invalid tokens, foreign variants, and cross-store carts', async () => {
      await sf.get('/cart', 'not-a-real-token').expect(404);
      await sf.get('/cart').expect(404);

      const other = await merchantWithStore(ctx);
      const otherHost = `${other.store.subdomain}.localhost`;
      const otherProduct = await ctx
        .http()
        .post(`/api/v1/admin/stores/${other.store.id}/products`)
        .set(other.auth)
        .send({
          title: 'Foreign',
          status: 'ACTIVE',
          variants: [{ price: 1, trackInventory: false }],
        })
        .expect(201);

      const token = (await sf.post('/cart').expect(201)).body.token as string;
      // Variant from another store cannot be added to this store's cart.
      await sf
        .post('/cart/lines', token)
        .send({ variantId: otherProduct.body.variants[0].id })
        .expect(404);
      // This store's cart token is useless on another store's host.
      await signed(ctx.http().get('/api/v1/storefront/cart'), otherHost, token).expect(404);
    });

    it('hides suspended stores from the storefront', async () => {
      const suspended = await merchantWithStore(ctx);
      await ctx.platform.store.update({
        where: { id: suspended.store.id },
        data: { status: 'SUSPENDED' },
      });
      await signed(
        ctx.http().get('/api/v1/storefront/shop'),
        `${suspended.store.subdomain}.localhost`,
      ).expect(404);
    });
  });
});
