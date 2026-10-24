import type { INestApplication } from '@nestjs/common';
import type { Product, ProductListItem } from '@repo/contracts';
import sharp from 'sharp';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { RemoteImageFetcher } from '../src/catalog/image-fetcher.js';
import {
  createTestApp,
  merchantWithStore,
  resetDatabase,
  storefrontClient,
  type TestContext,
} from './utils.js';

type Merchant = Awaited<ReturnType<typeof merchantWithStore>>;

function png(width: number, height: number, background = '#3366ff') {
  return sharp({ create: { width, height, channels: 3, background } })
    .png()
    .toBuffer();
}

describe('Product media, fields, scheduling, list and bulk actions', () => {
  let ctx: TestContext;
  let fetcher: RemoteImageFetcher;

  beforeAll(async () => {
    ctx = await createTestApp();
    await resetDatabase(ctx.owner);
    fetcher = (ctx.app as INestApplication).get(RemoteImageFetcher);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await ctx?.close();
  });

  const base = (m: Merchant) => `/api/v1/admin/stores/${m.store.id}/products`;
  const sfFor = (m: Merchant) => storefrontClient(ctx, `${m.store.subdomain}.localhost:3200`);

  async function createProduct(m: Merchant, body: Record<string, unknown>): Promise<Product> {
    const res = await ctx
      .http()
      .post(base(m))
      .set(m.auth)
      .send({ variants: [{ price: 1000 }], ...body });
    expect(res.status, JSON.stringify(res.body)).toBe(201);
    return res.body as Product;
  }

  function upload(m: Merchant, productId: string, images: Buffer[], alt?: string) {
    const req = ctx
      .http()
      .post(`${base(m)}/${productId}/images`)
      .set(m.auth);
    if (alt) void req.field('alt', alt);
    for (const [i, image] of images.entries()) {
      void req.attach('files', image, { filename: `image-${i}.png`, contentType: 'image/png' });
    }
    return req;
  }

  describe('uploads and renditions', () => {
    it('uploads several images at once with renditions, and keeps the single-file field', async () => {
      const m = await merchantWithStore(ctx);
      const product = await createProduct(m, { title: 'Lamp' });

      const res = await upload(
        m,
        product.id,
        [await png(1500, 1000), await png(300, 300, '#00ff00'), await png(40, 20)],
        'Lamp photo',
      );
      expect(res.status, JSON.stringify(res.body)).toBe(201);
      const images = (res.body as Product).images;
      expect(images.map((i) => [i.position, i.width, i.height, i.alt])).toEqual([
        [0, 1500, 1000, 'Lamp photo'],
        [1, 300, 300, 'Lamp photo'],
        [2, 40, 20, 'Lamp photo'],
      ]);
      expect(images[0]!.renditions.map((r) => r.width)).toEqual([200, 600, 1200]);
      expect(images[1]!.renditions.map((r) => r.width)).toEqual([200]);
      expect(images[2]!.renditions).toEqual([]);

      const rendition = await ctx
        .http()
        .get(new URL(images[0]!.renditions[1]!.url).pathname)
        .buffer(true)
        .parse((response, done) => {
          const chunks: Buffer[] = [];
          response.on('data', (c: Buffer) => chunks.push(c));
          response.on('end', () => done(null, Buffer.concat(chunks)));
        })
        .expect(200);
      expect(rendition.headers['content-type']).toBe('image/webp');
      const meta = await sharp(rendition.body as Buffer).metadata();
      expect([meta.format, meta.width, meta.height]).toEqual(['webp', 600, 400]);

      // The original single-file field still works and appends.
      const single = await ctx
        .http()
        .post(`${base(m)}/${product.id}/images`)
        .set(m.auth)
        .attach('file', await png(10, 10), { filename: 'a.png', contentType: 'image/png' })
        .expect(201);
      expect(single.body.images).toHaveLength(4);

      // Storefront exposes ids and renditions too.
      await ctx
        .http()
        .put(`${base(m)}/${product.id}`)
        .set(m.auth)
        .send({
          title: 'Lamp',
          status: 'ACTIVE',
          variants: [{ id: product.variants[0]!.id, price: 1000 }],
        })
        .expect(200);
      const sf = sfFor(m);
      const page = await sf('get', `/products/${product.handle}`).expect(200);
      expect(page.body.images[0]).toMatchObject({ id: images[0]!.id, width: 1500 });
      expect(page.body.images[0].renditions.map((r: { width: number }) => r.width)).toEqual([
        200, 600, 1200,
      ]);
      const cards = await sf('get', '/products').expect(200);
      expect(cards.body.items[0].imageRenditions).toHaveLength(3);
      expect(cards.body.items[0].secondImageRenditions).toHaveLength(1);
    });

    it('auto-rotates by EXIF, strips metadata, and rejects bad uploads without side effects', async () => {
      const m = await merchantWithStore(ctx);
      const product = await createProduct(m, { title: 'Photo' });

      const rotated = await sharp({
        create: { width: 40, height: 20, channels: 3, background: '#ff0000' },
      })
        .jpeg()
        .withMetadata({ orientation: 6 })
        .toBuffer();
      const res = await upload(m, product.id, [rotated]).expect(201);
      const image = res.body.images[0];
      expect([image.width, image.height]).toEqual([20, 40]);
      const stored = await ctx
        .http()
        .get(new URL(image.url).pathname)
        .buffer(true)
        .parse((response, done) => {
          const chunks: Buffer[] = [];
          response.on('data', (c: Buffer) => chunks.push(c));
          response.on('end', () => done(null, Buffer.concat(chunks)));
        })
        .expect(200);
      const meta = await sharp(stored.body as Buffer).metadata();
      expect(meta.exif).toBeUndefined();
      expect(meta.orientation).toBeUndefined();

      // A truncated file is recognized as PNG but cannot be decoded: nothing is saved, even
      // for the valid image sent alongside it.
      const good = await png(30, 30);
      const broken = (await png(300, 300)).subarray(0, 120);
      await upload(m, product.id, [good, broken]).expect(422);
      await upload(m, product.id, [Buffer.from('not an image')]).expect(415);

      const tooMany = await Promise.all(Array.from({ length: 11 }, () => png(5, 5)));
      await upload(m, product.id, tooMany).expect(400);
      await ctx
        .http()
        .post(`${base(m)}/${product.id}/images`)
        .set(m.auth)
        .expect(400);

      const after = await ctx
        .http()
        .get(`${base(m)}/${product.id}`)
        .set(m.auth)
        .expect(200);
      expect(after.body.images).toHaveLength(1);
    });

    it('caps a product at 50 images', async () => {
      const m = await merchantWithStore(ctx);
      const product = await createProduct(m, { title: 'Gallery' });
      await ctx.platform.productImage.createMany({
        data: Array.from({ length: 48 }, (_, i) => ({
          storeId: m.store.id,
          productId: product.id,
          storageKey: `stores/${m.store.id}/products/00000000-0000-0000-0000-${String(i).padStart(12, '0')}.webp`,
          width: 10,
          height: 10,
          position: i,
        })),
      });
      const three = await upload(m, product.id, [
        await png(5, 5),
        await png(5, 5),
        await png(5, 5),
      ]);
      expect(three.status).toBe(409);
      expect(three.body.detail).toMatch(/at most 50 images/);
      await upload(m, product.id, [await png(5, 5), await png(5, 5)]).expect(201);

      const spy = vi.spyOn(fetcher, 'fetch').mockResolvedValue(await png(5, 5));
      await ctx
        .http()
        .post(`${base(m)}/${product.id}/images/import`)
        .set(m.auth)
        .send({ url: 'https://images.example.com/a.png' })
        .expect(409);
      expect(spy).not.toHaveBeenCalled();
    });

    it('deletes stored files with the image and with the product', async () => {
      const m = await merchantWithStore(ctx);
      const product = await createProduct(m, { title: 'Chair' });
      const res = await upload(m, product.id, [await png(700, 700), await png(700, 700)]).expect(
        201,
      );
      const [first, second] = res.body.images as Product['images'];
      const paths = (image: Product['images'][number]) =>
        [image.url, ...image.renditions.map((r) => r.url)].map((u) => new URL(u).pathname);
      for (const path of [...paths(first!), ...paths(second!)]) {
        await ctx.http().get(path).expect(200);
      }

      const afterDelete = await ctx
        .http()
        .delete(`${base(m)}/${product.id}/images/${first!.id}`)
        .set(m.auth)
        .expect(200);
      expect(
        afterDelete.body.images.map((i: { id: string; position: number }) => [i.id, i.position]),
      ).toEqual([[second!.id, 0]]);
      for (const path of paths(first!)) await ctx.http().get(path).expect(404);

      await ctx
        .http()
        .delete(`${base(m)}/${product.id}`)
        .set(m.auth)
        .expect(204);
      for (const path of paths(second!)) await ctx.http().get(path).expect(404);
    });
  });

  describe('import by URL', () => {
    it('refuses non-https, private, loopback and link-local URLs', async () => {
      const m = await merchantWithStore(ctx);
      const product = await createProduct(m, { title: 'Imported' });
      const url = `${base(m)}/${product.id}/images/import`;

      await ctx.http().post(url).set(m.auth).send({ url: 'http://example.com/a.png' }).expect(400);
      await ctx.http().post(url).set(m.auth).send({ url: 'ftp://example.com/a.png' }).expect(400);
      for (const target of [
        'https://127.0.0.1/a.png',
        'https://localhost/a.png',
        'https://169.254.169.254/latest/meta-data',
        'https://10.0.0.5/a.png',
        'https://[::1]/a.png',
        'https://user:pass@example.com/a.png',
      ]) {
        const res = await ctx.http().post(url).set(m.auth).send({ url: target });
        expect(res.status, target).toBe(400);
        expect(res.body.detail, target).toMatch(/public https/);
      }
      const after = await ctx
        .http()
        .get(`${base(m)}/${product.id}`)
        .set(m.auth)
        .expect(200);
      expect(after.body.images).toEqual([]);
    });

    it('imports a downloaded image through the same processing, and rejects non-images', async () => {
      const m = await merchantWithStore(ctx);
      const product = await createProduct(m, { title: 'Imported' });
      const url = `${base(m)}/${product.id}/images/import`;

      const spy = vi.spyOn(fetcher, 'fetch').mockResolvedValue(await png(800, 400));
      const res = await ctx
        .http()
        .post(url)
        .set(m.auth)
        .send({ url: 'https://cdn.example.com/hero.png', alt: 'Hero shot' })
        .expect(201);
      expect(spy).toHaveBeenCalledWith('https://cdn.example.com/hero.png');
      expect(res.body.images[0]).toMatchObject({ alt: 'Hero shot', width: 800, height: 400 });
      expect(res.body.images[0].renditions.map((r: { width: number }) => r.width)).toEqual([
        200, 600,
      ]);
      const audit = await ctx.platform.auditLog.findFirstOrThrow({
        where: { storeId: m.store.id, action: 'product.image_added' },
      });
      expect(audit.data).toMatchObject({ source: 'url', url: 'https://cdn.example.com/hero.png' });

      spy.mockResolvedValue(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'));
      await ctx
        .http()
        .post(url)
        .set(m.auth)
        .send({ url: 'https://cdn.example.com/x.svg' })
        .expect(415);
    });
  });

  describe('ordering and alt text', () => {
    it('reorders with the full id list only, moves single images, and validates alt text', async () => {
      const m = await merchantWithStore(ctx);
      const other = await createProduct(m, { title: 'Other' });
      const otherImages = await upload(m, other.id, [await png(5, 5)]).expect(201);
      const product = await createProduct(m, { title: 'Ordered' });
      const res = await upload(m, product.id, [
        await png(5, 5),
        await png(6, 6),
        await png(7, 7),
      ]).expect(201);
      const [a, b, c] = (res.body.images as Product['images']).map((i) => i.id);
      const order = `${base(m)}/${product.id}/images/order`;

      const reordered = await ctx
        .http()
        .put(order)
        .set(m.auth)
        .send({ imageIds: [c, a, b] })
        .expect(200);
      expect(reordered.body.images.map((i: { id: string }) => i.id)).toEqual([c, a, b]);

      for (const imageIds of [
        [c, a],
        [c, a, b, otherImages.body.images[0].id],
        [c, a, a],
      ]) {
        await ctx.http().put(order).set(m.auth).send({ imageIds }).expect(400);
      }

      const moved = await ctx
        .http()
        .patch(`${base(m)}/${product.id}/images/${b}`)
        .set(m.auth)
        .send({ position: 0, alt: 'Front view' })
        .expect(200);
      expect(
        moved.body.images.map((i: { id: string; position: number }) => [i.id, i.position]),
      ).toEqual([
        [b, 0],
        [c, 1],
        [a, 2],
      ]);
      expect(moved.body.images[0].alt).toBe('Front view');

      await ctx
        .http()
        .patch(`${base(m)}/${product.id}/images/${b}`)
        .set(m.auth)
        .send({ alt: 'x'.repeat(513) })
        .expect(400);
      await ctx
        .http()
        .patch(`${base(m)}/${product.id}/images/${b}`)
        .set(m.auth)
        .send({ alt: 'x'.repeat(512) })
        .expect(200);
      const audits = await ctx.platform.auditLog.findMany({
        where: {
          storeId: m.store.id,
          action: { in: ['product.image_updated', 'product.images_reordered'] },
        },
      });
      expect(audits.map((x) => x.action).sort()).toEqual([
        'product.image_updated',
        'product.image_updated',
        'product.images_reordered',
      ]);
    });
  });

  describe('variant images', () => {
    it('sets, clears and validates variant images; deleting the image clears the variant', async () => {
      const m = await merchantWithStore(ctx);
      const other = await createProduct(m, { title: 'Other' });
      const otherImage = (await upload(m, other.id, [await png(5, 5)]).expect(201)).body.images[0];

      const input = {
        title: 'Mug',
        status: 'ACTIVE',
        options: [{ name: 'Color', values: ['Red', 'Blue'] }],
        variants: [
          { options: ['Red'], price: 1500, inventoryQuantity: 3 },
          { options: ['Blue'], price: 1500, inventoryQuantity: 3 },
        ],
      };
      await ctx
        .http()
        .post(base(m))
        .set(m.auth)
        .send({
          ...input,
          variants: [{ ...input.variants[0], imageId: otherImage.id }, input.variants[1]],
        })
        .expect(400);
      const product = await createProduct(m, input);
      const images = (
        await upload(m, product.id, [await png(5, 5, '#f00'), await png(5, 5, '#00f')]).expect(201)
      ).body.images as Product['images'];
      const [red, blue] = product.variants;

      // Through the product update...
      const updated = await ctx
        .http()
        .put(`${base(m)}/${product.id}`)
        .set(m.auth)
        .send({
          ...input,
          variants: [
            { ...input.variants[0], id: red!.id, imageId: images[0]!.id },
            { ...input.variants[1], id: blue!.id },
          ],
        })
        .expect(200);
      expect(updated.body.variants.map((v: { imageId: string | null }) => v.imageId)).toEqual([
        images[0]!.id,
        null,
      ]);
      await ctx
        .http()
        .put(`${base(m)}/${product.id}`)
        .set(m.auth)
        .send({
          ...input,
          variants: [
            { ...input.variants[0], id: red!.id, imageId: otherImage.id },
            { ...input.variants[1], id: blue!.id },
          ],
        })
        .expect(400);

      // ...or the variant endpoint.
      const variantUrl = `${base(m)}/${product.id}/variants/${blue!.id}`;
      await ctx.http().patch(variantUrl).set(m.auth).send({ imageId: otherImage.id }).expect(400);
      const patched = await ctx
        .http()
        .patch(variantUrl)
        .set(m.auth)
        .send({ imageId: images[1]!.id })
        .expect(200);
      expect(patched.body.variants[1].imageId).toBe(images[1]!.id);
      await ctx
        .http()
        .patch(`${base(m)}/${other.id}/variants/${blue!.id}`)
        .set(m.auth)
        .send({ imageId: null })
        .expect(404);

      // A product update that omits imageId keeps it.
      const kept = await ctx
        .http()
        .put(`${base(m)}/${product.id}`)
        .set(m.auth)
        .send({
          ...input,
          variants: [
            { ...input.variants[0], id: red!.id },
            { ...input.variants[1], id: blue!.id },
          ],
        })
        .expect(200);
      expect(kept.body.variants.map((v: { imageId: string | null }) => v.imageId)).toEqual([
        images[0]!.id,
        images[1]!.id,
      ]);

      const sf = sfFor(m);
      const page = await sf('get', `/products/${product.handle}`).expect(200);
      expect(page.body.variants.map((v: { imageId: string }) => v.imageId)).toEqual([
        images[0]!.id,
        images[1]!.id,
      ]);
      expect(page.body.images.map((i: { id: string }) => i.id)).toEqual(images.map((i) => i.id));

      // The cart shows the variant's own image.
      const cart = await sf('post', '/cart').expect(201);
      const line = await sf('post', '/cart/lines', { cart: cart.body.token })
        .send({ variantId: blue!.id, quantity: 1 })
        .expect(201);
      expect(line.body.lines[0].imageUrl).toBe(images[1]!.url);

      // The database refuses another product's image even without the API's checks.
      await expect(
        ctx.platform.productVariant.update({
          where: { id: red!.id },
          data: { imageId: otherImage.id },
        }),
      ).rejects.toThrow();

      await ctx
        .http()
        .delete(`${base(m)}/${product.id}/images/${images[1]!.id}`)
        .set(m.auth)
        .expect(200);
      const after = await ctx
        .http()
        .get(`${base(m)}/${product.id}`)
        .set(m.auth)
        .expect(200);
      expect(after.body.variants.map((v: { imageId: string | null }) => v.imageId)).toEqual([
        images[0]!.id,
        null,
      ]);
    });
  });

  describe('cost, profit and customs fields', () => {
    it('computes profit and margin for admins and never shows cost to shoppers', async () => {
      const m = await merchantWithStore(ctx);
      const input = {
        title: 'Tee',
        status: 'ACTIVE',
        options: [{ name: 'Size', values: ['S', 'M', 'L'] }],
        variants: [
          {
            options: ['S'],
            price: 2000,
            costPerItem: 1234,
            countryOfOrigin: 'in',
            hsCode: '6109.10',
            inventoryQuantity: 5,
          },
          { options: ['M'], price: 0, costPerItem: 500 },
          { options: ['L'], price: 2500 },
        ],
      };
      const product = await createProduct(m, input);
      expect(
        product.variants.map((v) => [
          v.costPerItem,
          v.profit,
          v.margin,
          v.countryOfOrigin,
          v.hsCode,
        ]),
      ).toEqual([
        [1234, 766, 38.3, 'IN', '610910'],
        [500, -500, null, null, null],
        [null, null, null, null, null],
      ]);

      for (const bad of [
        { countryOfOrigin: 'IND' },
        { hsCode: '12345' },
        { hsCode: '12345678901' },
        { costPerItem: -1 },
      ]) {
        await ctx
          .http()
          .post(base(m))
          .set(m.auth)
          .send({ title: 'Bad', variants: [{ price: 100, ...bad }] })
          .expect(400);
      }

      // Omitted on update keeps; null clears.
      const ids = product.variants.map((v) => v.id);
      const kept = await ctx
        .http()
        .put(`${base(m)}/${product.id}`)
        .set(m.auth)
        .send({
          ...input,
          variants: [
            { options: ['S'], price: 3000, id: ids[0] },
            { options: ['M'], price: 1000, id: ids[1], costPerItem: null },
            { options: ['L'], price: 2500, id: ids[2], costPerItem: 2500 },
          ],
        })
        .expect(200);
      expect(
        kept.body.variants.map((v: Product['variants'][number]) => [
          v.costPerItem,
          v.profit,
          v.margin,
          v.hsCode,
        ]),
      ).toEqual([
        [1234, 1766, 58.9, '610910'],
        [null, null, null, null],
        [2500, 0, 0, null],
      ]);

      const sf = sfFor(m);
      const page = await sf('get', `/products/${product.handle}`).expect(200);
      const cart = await sf('post', '/cart').expect(201);
      const withLine = await sf('post', '/cart/lines', { cart: cart.body.token })
        .send({ variantId: ids[0], quantity: 1 })
        .expect(201);
      const list = await sf('get', '/products').expect(200);
      for (const body of [page.body, withLine.body, list.body]) {
        const json = JSON.stringify(body);
        for (const field of ['costPerItem', 'profit', 'margin', 'hsCode', 'countryOfOrigin']) {
          expect(json).not.toContain(`"${field}"`);
        }
      }
    });
  });

  describe('custom fields (metafields)', () => {
    it('validates and normalizes typed values, replaces on save and shows chosen specs', async () => {
      const m = await merchantWithStore(ctx);
      const metafields = [
        {
          key: 'material',
          type: 'single_line_text',
          value: ' Organic cotton ',
          showOnStorefront: true,
        },
        { key: 'care_notes', type: 'multi_line_text', value: 'Wash cold\r\nDry flat' },
        { key: 'thread_count', type: 'number_integer', value: '0300', showOnStorefront: true },
        { key: 'weight_kg', type: 'number_decimal', value: 1.5 },
        { key: 'vegan', type: 'boolean', value: 'TRUE', showOnStorefront: true },
        { key: 'size_guide', type: 'url', value: 'https://example.com/guide' },
        { namespace: 'erp', key: 'launch_date', type: 'date', value: '2026-11-01' },
      ];
      const product = await createProduct(m, { title: 'Sheet', status: 'ACTIVE', metafields });
      expect(
        product.metafields.map((f) => [f.namespace, f.key, f.value, f.showOnStorefront]),
      ).toEqual([
        ['custom', 'material', 'Organic cotton', true],
        ['custom', 'care_notes', 'Wash cold\nDry flat', false],
        ['custom', 'thread_count', '300', true],
        ['custom', 'weight_kg', '1.5', false],
        ['custom', 'vegan', 'true', true],
        ['custom', 'size_guide', 'https://example.com/guide', false],
        ['erp', 'launch_date', '2026-11-01', false],
      ]);

      const invalid: Record<string, unknown>[] = [
        { key: 'n', type: 'number_integer', value: '1.5' },
        { key: 'd', type: 'number_decimal', value: 'abc' },
        { key: 'b', type: 'boolean', value: 'yes' },
        { key: 'u', type: 'url', value: 'http://example.com' },
        { key: 'u', type: 'url', value: 'javascript:alert(1)' },
        { key: 'dt', type: 'date', value: '2026-02-30' },
        { key: 's', type: 'single_line_text', value: 'two\nlines' },
        { key: 's', type: 'single_line_text', value: '   ' },
        { key: 'Bad-Key', type: 'single_line_text', value: 'x' },
        { key: 'x', type: 'color', value: '#fff' },
      ];
      for (const field of invalid) {
        const res = await ctx
          .http()
          .post(base(m))
          .set(m.auth)
          .send({ title: 'Bad', variants: [{ price: 1 }], metafields: [field] });
        expect(res.status, JSON.stringify(field)).toBe(400);
      }
      const duplicate = [
        { key: 'a', type: 'boolean', value: true },
        { key: 'a', type: 'boolean', value: false },
      ];
      const tooMany = Array.from({ length: 31 }, (_, i) => ({
        key: `k${i}`,
        type: 'boolean',
        value: true,
      }));
      for (const fields of [duplicate, tooMany]) {
        await ctx
          .http()
          .post(base(m))
          .set(m.auth)
          .send({ title: 'Bad', variants: [{ price: 1 }], metafields: fields })
          .expect(400);
      }

      const update = {
        title: 'Sheet',
        status: 'ACTIVE',
        variants: [{ id: product.variants[0]!.id, price: 1000 }],
      };
      const kept = await ctx
        .http()
        .put(`${base(m)}/${product.id}`)
        .set(m.auth)
        .send(update)
        .expect(200);
      expect(kept.body.metafields).toHaveLength(7);

      const sf = sfFor(m);
      const page = await sf('get', `/products/${product.handle}`).expect(200);
      expect(page.body.specs).toEqual([
        { key: 'material', label: 'Material', type: 'single_line_text', value: 'Organic cotton' },
        { key: 'thread_count', label: 'Thread count', type: 'number_integer', value: '300' },
        { key: 'vegan', label: 'Vegan', type: 'boolean', value: 'true' },
      ]);

      const replaced = await ctx
        .http()
        .put(`${base(m)}/${product.id}`)
        .set(m.auth)
        .send({
          ...update,
          metafields: [{ key: 'fit', type: 'single_line_text', value: 'Relaxed' }],
        })
        .expect(200);
      expect(replaced.body.metafields.map((f: { key: string }) => f.key)).toEqual(['fit']);
      const hidden = await sf('get', `/products/${product.handle}`).expect(200);
      expect(hidden.body.specs).toEqual([]);
    });
  });

  describe('scheduled publishing', () => {
    it('hides a scheduled product everywhere on the storefront until its publish time', async () => {
      const m = await merchantWithStore(ctx);
      const tomorrow = new Date(Date.now() + 86_400_000).toISOString();
      const collection = await ctx
        .http()
        .post(`/api/v1/admin/stores/${m.store.id}/collections`)
        .set(m.auth)
        .send({ title: 'Drops', ruleTag: 'drop' })
        .expect(201);
      const product = await createProduct(m, {
        title: 'Limited Drop Jacket',
        status: 'ACTIVE',
        tags: ['drop'],
        publishAt: tomorrow,
        variants: [{ price: 5000, inventoryQuantity: 5 }],
      });
      expect(product.scheduled).toBe(true);
      expect(product.publishedAt).toBe(tomorrow);
      const listed = await ctx.http().get(base(m)).set(m.auth).expect(200);
      expect(listed.body.items[0]).toMatchObject({ scheduled: true, publishedAt: tomorrow });

      const sf = sfFor(m);
      const variantId = product.variants[0]!.id;
      const cart = await sf('post', '/cart').expect(201);
      const hiddenChecks = async () => {
        await sf('get', `/products/${product.handle}`).expect(404);
        expect((await sf('get', '/products').expect(200)).body.total).toBe(0);
        expect((await sf('get', '/products?q=jacket').expect(200)).body.total).toBe(0);
        expect(
          (await sf('get', `/products?collection=${collection.body.handle}`).expect(200)).body
            .total,
        ).toBe(0);
        expect((await sf('get', '/sitemap').expect(200)).body.products).toEqual([]);
        await sf('post', '/cart/lines', { cart: cart.body.token })
          .send({ variantId, quantity: 1 })
          .expect(404);
      };
      await hiddenChecks();

      // Time passes.
      await ctx.platform.product.update({
        where: { id: product.id },
        data: { publishedAt: new Date(Date.now() - 1000) },
      });
      await sf('get', `/products/${product.handle}`).expect(200);
      expect((await sf('get', '/products?q=jacket').expect(200)).body.total).toBe(1);
      expect(
        (await sf('get', `/products?collection=${collection.body.handle}`).expect(200)).body.total,
      ).toBe(1);
      expect((await sf('get', '/sitemap').expect(200)).body.products).toHaveLength(1);
      const added = await sf('post', '/cart/lines', { cart: cart.body.token })
        .send({ variantId, quantity: 1 })
        .expect(201);
      expect(added.body.lines[0].available).toBe(true);

      // Rescheduling makes the line in the cart unavailable (so checkout refuses it).
      const update = {
        title: 'Limited Drop Jacket',
        status: 'ACTIVE',
        tags: ['drop'],
        variants: [{ id: variantId, price: 5000 }],
      };
      const rescheduled = await ctx
        .http()
        .put(`${base(m)}/${product.id}`)
        .set(m.auth)
        .send({ ...update, publishAt: tomorrow })
        .expect(200);
      expect(rescheduled.body.scheduled).toBe(true);
      const stale = await sf('get', '/cart', { cart: cart.body.token }).expect(200);
      expect(stale.body.lines[0].available).toBe(false);
      await hiddenChecks();

      // An update that omits publishAt keeps the schedule; null publishes now.
      const keeps = await ctx
        .http()
        .put(`${base(m)}/${product.id}`)
        .set(m.auth)
        .send(update)
        .expect(200);
      expect(keeps.body.scheduled).toBe(true);
      const now = await ctx
        .http()
        .put(`${base(m)}/${product.id}`)
        .set(m.auth)
        .send({ ...update, publishAt: null })
        .expect(200);
      expect(now.body.scheduled).toBe(false);
      expect(new Date(now.body.publishedAt).getTime()).toBeLessThanOrEqual(Date.now());
      await sf('get', `/products/${product.handle}`).expect(200);
    });
  });

  describe('admin list', () => {
    let m: Merchant;
    let products: Record<string, Product>;

    beforeAll(async () => {
      m = await merchantWithStore(ctx);
      products = {};
      const specs = [
        {
          title: 'Alpine Boot',
          vendor: 'Peak',
          productType: 'Shoes',
          tags: ['winter', 'outdoor'],
          price: 12000,
          qty: 3,
          sku: 'BOOT-1',
        },
        {
          title: 'beach Sandal',
          vendor: 'Coast',
          productType: 'Shoes',
          tags: ['summer'],
          price: 3000,
          qty: 50,
          sku: 'SAND-1',
        },
        {
          title: 'Cotton 100% Tee',
          vendor: 'Peak',
          productType: 'Shirts',
          tags: ['summer', 'basics'],
          price: 2000,
          qty: 10,
          sku: 'TEE-1',
          status: 'DRAFT',
        },
        {
          title: 'Down Jacket',
          vendor: null,
          productType: null,
          tags: [],
          price: 25000,
          qty: 0,
          sku: 'JKT-1',
        },
      ];
      for (const s of specs) {
        products[s.title] = await createProduct(m, {
          title: s.title,
          status: s.status ?? 'ACTIVE',
          vendor: s.vendor,
          productType: s.productType,
          tags: s.tags,
          variants: [{ price: s.price, inventoryQuantity: s.qty, sku: s.sku }],
        });
      }
    });

    const titles = async (query: string) => {
      const res = await ctx
        .http()
        .get(`${base(m)}?${query}`)
        .set(m.auth);
      expect(res.status, JSON.stringify(res.body)).toBe(200);
      return (res.body.items as ProductListItem[]).map((i) => i.title);
    };

    it('filters by vendor, type, tag, status, collection and free text', async () => {
      expect(await titles('vendor=peak&sort=title')).toEqual(['Alpine Boot', 'Cotton 100% Tee']);
      expect(await titles('productType=Shoes&sort=title')).toEqual(['Alpine Boot', 'beach Sandal']);
      expect(await titles('tag=Summer&sort=title')).toEqual(['beach Sandal', 'Cotton 100% Tee']);
      expect(await titles('status=DRAFT')).toEqual(['Cotton 100% Tee']);
      expect(await titles('q=boot')).toEqual(['Alpine Boot']);
      expect(await titles('q=sand-')).toEqual(['beach Sandal']); // SKU prefix
      expect(await titles('q=coast')).toEqual(['beach Sandal']); // vendor
      expect(await titles('q=basics')).toEqual(['Cotton 100% Tee']); // tag
      expect(await titles('q=100%25')).toEqual(['Cotton 100% Tee']); // literal %
      expect(await titles('q=_')).toEqual([]);
      expect(await titles('vendor=&status=&q=&sort=title')).toHaveLength(4);

      const manual = await ctx
        .http()
        .post(`/api/v1/admin/stores/${m.store.id}/collections`)
        .set(m.auth)
        .send({ title: 'Picks' })
        .expect(201);
      await ctx
        .http()
        .put(`/api/v1/admin/stores/${m.store.id}/collections/${manual.body.id}/products`)
        .set(m.auth)
        .send({ productIds: [products['Down Jacket']!.id] })
        .expect(200);
      expect(await titles(`collectionId=${manual.body.id}`)).toEqual(['Down Jacket']);
      const rule = await ctx
        .http()
        .post(`/api/v1/admin/stores/${m.store.id}/collections`)
        .set(m.auth)
        .send({ title: 'Summer', ruleTag: 'summer' })
        .expect(201);
      // Rule collections hold ACTIVE tagged products (the draft tee is not in it).
      expect(await titles(`collectionId=${rule.body.id}`)).toEqual(['beach Sandal']);
      expect(await titles('collectionId=00000000-0000-4000-8000-000000000000')).toEqual([]);
      await ctx
        .http()
        .get(`${base(m)}?sort=random`)
        .set(m.auth)
        .expect(400);
    });

    it('sorts by title, price, inventory and dates', async () => {
      expect(await titles('sort=title')).toEqual([
        'Alpine Boot',
        'beach Sandal',
        'Cotton 100% Tee',
        'Down Jacket',
      ]);
      expect(await titles('sort=title&direction=desc')).toEqual([
        'Down Jacket',
        'Cotton 100% Tee',
        'beach Sandal',
        'Alpine Boot',
      ]);
      expect(await titles('sort=price')).toEqual([
        'Cotton 100% Tee',
        'beach Sandal',
        'Alpine Boot',
        'Down Jacket',
      ]);
      expect(await titles('sort=price&direction=desc')).toEqual([
        'Down Jacket',
        'Alpine Boot',
        'beach Sandal',
        'Cotton 100% Tee',
      ]);
      expect(await titles('sort=inventory')).toEqual([
        'Down Jacket',
        'Alpine Boot',
        'Cotton 100% Tee',
        'beach Sandal',
      ]);
      expect(await titles('sort=created')).toEqual([
        'Down Jacket',
        'Cotton 100% Tee',
        'beach Sandal',
        'Alpine Boot',
      ]);
      expect(await titles('sort=created&direction=asc&pageSize=2&page=2')).toEqual([
        'Cotton 100% Tee',
        'Down Jacket',
      ]);
      const page = await ctx
        .http()
        .get(`${base(m)}?pageSize=1`)
        .set(m.auth)
        .expect(200);
      expect(page.body.total).toBe(4);
      expect(Object.keys(page.body.items[0])).toEqual(
        expect.arrayContaining([
          'productType',
          'tags',
          'thumbnailUrl',
          'scheduled',
          'publishedAt',
          'createdAt',
        ]),
      );
    });

    it('returns facets for the filter dropdowns', async () => {
      const facets = await ctx
        .http()
        .get(`${base(m)}/facets`)
        .set(m.auth)
        .expect(200);
      expect(facets.body).toEqual({
        vendors: ['Coast', 'Peak'],
        productTypes: ['Shirts', 'Shoes'],
        tags: ['basics', 'outdoor', 'summer', 'winter'],
      });
      const stranger = await merchantWithStore(ctx);
      await ctx
        .http()
        .get(`${base(m)}/facets`)
        .set(stranger.auth)
        .expect(404);
    });
  });

  describe('bulk actions', () => {
    it('applies status and tag actions in one go, with audit entries and webhooks', async () => {
      const m = await merchantWithStore(ctx);
      await ctx.platform.webhookSubscription.createMany({
        data: ['products/updated', 'products/deleted'].map((topic) => ({
          storeId: m.store.id,
          topic,
          url: 'https://hooks.example.com/products',
          secretEncrypted: 'unused',
        })),
      });
      const a = await createProduct(m, { title: 'A', tags: ['old'] });
      const b = await createProduct(m, { title: 'B', tags: ['old', 'keep'] });
      const c = await createProduct(m, { title: 'C', status: 'ACTIVE' });
      const bulk = (body: Record<string, unknown>) =>
        ctx
          .http()
          .post(`${base(m)}/bulk`)
          .set(m.auth)
          .send(body);

      const activated = await bulk({ productIds: [a.id, b.id], action: 'activate' }).expect(200);
      expect(activated.body).toEqual({ action: 'activate', count: 2 });
      const rows = await ctx.platform.product.findMany({
        where: { storeId: m.store.id },
        orderBy: { title: 'asc' },
      });
      expect(rows.map((p) => [p.title, p.status, p.publishedAt !== null])).toEqual([
        ['A', 'ACTIVE', true],
        ['B', 'ACTIVE', true],
        ['C', 'ACTIVE', true],
      ]);
      expect((await sfFor(m)('get', '/products').expect(200)).body.total).toBe(3);

      await bulk({
        productIds: [a.id, b.id, c.id],
        action: 'add_tags',
        tags: ['Sale', 'old'],
      }).expect(200);
      await bulk({ productIds: [a.id, b.id], action: 'remove_tags', tags: ['old'] }).expect(200);
      await bulk({ productIds: [c.id], action: 'archive' }).expect(200);
      await bulk({ productIds: [b.id], action: 'draft' }).expect(200);
      const after = await ctx.platform.product.findMany({
        where: { storeId: m.store.id },
        orderBy: { title: 'asc' },
      });
      expect(after.map((p) => [p.title, p.status, p.tags])).toEqual([
        ['A', 'ACTIVE', ['sale']],
        ['B', 'DRAFT', ['keep', 'sale']],
        ['C', 'ARCHIVED', ['sale', 'old']],
      ]);

      await bulk({ productIds: [a.id], action: 'add_tags' }).expect(400);
      await bulk({ productIds: [], action: 'archive' }).expect(400);
      await bulk({ productIds: [a.id], action: 'explode' }).expect(400);
      const ids = Array.from(
        { length: 101 },
        (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
      );
      await bulk({ productIds: ids, action: 'archive' }).expect(400);

      const image = await upload(m, a.id, [await png(300, 300)]).expect(201);
      const imagePath = new URL(image.body.images[0].renditions[0].url).pathname;
      await bulk({ productIds: [a.id, b.id], action: 'delete' }).expect(200);
      expect(await ctx.platform.product.count({ where: { storeId: m.store.id } })).toBe(1);
      await ctx.http().get(imagePath).expect(404);

      const audits = await ctx.platform.auditLog.groupBy({
        by: ['action'],
        where: { storeId: m.store.id, action: { in: ['product.updated', 'product.deleted'] } },
        _count: true,
      });
      expect(Object.fromEntries(audits.map((x) => [x.action, x._count]))).toEqual({
        'product.updated': 2 + 3 + 2 + 1 + 1,
        'product.deleted': 2,
      });
      const deliveries = await ctx.platform.webhookDelivery.groupBy({
        by: ['topic'],
        where: { storeId: m.store.id },
        _count: true,
      });
      expect(Object.fromEntries(deliveries.map((x) => [x.topic, x._count]))).toEqual({
        'products/updated': 9,
        'products/deleted': 2,
      });
    });

    it("rejects other stores' products and staff without products:write, changing nothing", async () => {
      const owner = await merchantWithStore(ctx);
      const other = await merchantWithStore(ctx);
      const mine = await createProduct(owner, { title: 'Mine' });
      const theirs = await createProduct(other, { title: 'Theirs' });

      const res = await ctx
        .http()
        .post(`${base(owner)}/bulk`)
        .set(owner.auth)
        .send({ productIds: [mine.id, theirs.id], action: 'delete' });
      expect(res.status).toBe(400);
      expect(
        await ctx.platform.product.count({ where: { id: { in: [mine.id, theirs.id] } } }),
      ).toBe(2);

      // Acting on another store through its URL is not possible at all.
      await ctx
        .http()
        .post(`${base(other)}/bulk`)
        .set(owner.auth)
        .send({ productIds: [theirs.id], action: 'archive' })
        .expect(404);

      await ctx.platform.storeMember.create({
        data: {
          storeId: owner.store.id,
          userId: other.session.user.id,
          role: 'STAFF',
          permissions: ['products:read'],
        },
      });
      await ctx
        .http()
        .post(`${base(owner)}/bulk`)
        .set(other.auth)
        .send({ productIds: [mine.id], action: 'archive' })
        .expect(403);
      await ctx
        .http()
        .get(`${base(owner)}/facets`)
        .set(other.auth)
        .expect(200);
      await ctx
        .http()
        .put(`${base(owner)}/${mine.id}/images/order`)
        .set(other.auth)
        .send({ imageIds: [] })
        .expect(403);
      await ctx
        .http()
        .post(`${base(owner)}/${mine.id}/images/import`)
        .set(other.auth)
        .send({ url: 'https://example.com/a.png' })
        .expect(403);
      const unchanged = await ctx.platform.product.findUniqueOrThrow({ where: { id: mine.id } });
      expect(unchanged.status).toBe('DRAFT');
    });
  });
});
