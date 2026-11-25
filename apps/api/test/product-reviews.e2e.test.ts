import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ReviewRequestsService } from '../src/catalog/review-requests.service.js';
import { EMAIL_SENDER, type MemoryEmailSender } from '../src/email/email.js';
import { OutboxProcessor } from '../src/outbox/outbox.service.js';
import {
  createStore,
  createTestApp,
  payMock,
  resetDatabase,
  signup,
  storefrontClient,
  type TestContext,
} from './utils.js';

const address = { name: 'Grace', line1: '1 Way', city: 'Town', postalCode: '1', country: 'GB' };

describe('Product reviews', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp();
    await resetDatabase(ctx.owner);
  });

  afterAll(async () => {
    await ctx?.close();
  });

  it('lets buyers review, the merchant moderate, and shows ratings on the storefront', async () => {
    const session = await signup(ctx);
    const store = await createStore(ctx, session.token);
    const auth = { Authorization: `Bearer ${session.token}` };
    const admin = `/api/v1/admin/stores/${store.id}`;
    const sf = storefrontClient(ctx, `${store.subdomain}.localhost:3200`);
    const product = await ctx
      .http()
      .post(`${admin}/products`)
      .set(auth)
      .send({
        title: 'Linen shirt',
        handle: 'linen-shirt',
        status: 'ACTIVE',
        variants: [{ price: 4500, inventoryQuantity: 10 }],
      })
      .expect(201);
    const variantId = product.body.variants[0].id as string;

    async function register(name: string) {
      return (
        await sf('post', '/customers/register')
          .send({
            name,
            email: `${name.split(' ')[0]!.toLowerCase()}-${randomUUID().slice(0, 6)}@example.com`,
            password: 'review-password-123',
          })
          .expect(201)
      ).body.session.token as string;
    }
    async function buy(customer: string) {
      const cart = (await sf('post', '/cart').expect(201)).body.token as string;
      await sf('post', '/cart/lines', { cart }).send({ variantId, quantity: 1 }).expect(201);
      const placed = await sf('post', '/checkout', { cart, customer })
        .send({ email: 'x@example.com', shippingAddress: address, idempotencyKey: randomUUID() })
        .expect(201);
      return placed.body.paymentUrl as string;
    }
    const review = { rating: 4, title: 'Lovely fabric', body: 'Soft and cool in summer.' };

    // The app is off: no reviews endpoint, no rating on the product.
    await sf('get', '/products/linen-shirt/reviews').expect(404);
    expect((await sf('get', '/products/linen-shirt').expect(200)).body.rating).toBeNull();

    const apps = (await ctx.http().get(`${admin}/apps`).set(auth).expect(200)).body;
    await ctx
      .http()
      .put(`${admin}/apps`)
      .set(auth)
      .send({ ...apps, productReviews: { enabled: true, autoPublish: false } })
      .expect(200);

    // Signed out, or signed in without buying: not allowed.
    expect((await sf('get', '/products/linen-shirt/reviews/mine').expect(200)).body).toMatchObject({
      canReview: false,
      reason: expect.stringMatching(/Sign in/),
    });
    const grace = await register('Grace Hopper');
    const mine = await sf('get', '/products/linen-shirt/reviews/mine', { customer: grace }).expect(
      200,
    );
    expect(mine.body).toMatchObject({ canReview: false, suggestedName: 'Grace H.' });
    await sf('put', '/products/linen-shirt/reviews/mine', { customer: grace })
      .send({ ...review, authorName: 'Grace H.' })
      .expect(403);

    // An unpaid order is not a purchase yet; paying it is.
    const paymentUrl = await buy(grace);
    await sf('put', '/products/linen-shirt/reviews/mine', { customer: grace })
      .send({ ...review, authorName: 'Grace H.' })
      .expect(403);
    await payMock(sf, paymentUrl);
    await sf('put', '/products/linen-shirt/reviews/mine', { customer: grace })
      .send({ ...review, rating: 6, authorName: 'Grace H.' })
      .expect(400);
    const saved = await sf('put', '/products/linen-shirt/reviews/mine', { customer: grace })
      .send({ ...review, authorName: 'Grace H.' })
      .expect(200);
    expect(saved.body).toMatchObject({ canReview: true, review: { status: 'PENDING', rating: 4 } });

    // Pending reviews are not public.
    expect((await sf('get', '/products/linen-shirt/reviews').expect(200)).body).toMatchObject({
      rating: null,
      items: [],
    });

    const queue = await ctx
      .http()
      .get(`${admin}/reviews`)
      .query({ status: 'PENDING' })
      .set(auth)
      .expect(200);
    expect(queue.body.total).toBe(1);
    const id = queue.body.items[0].id as string;
    expect(queue.body.items[0]).toMatchObject({
      product: { title: 'Linen shirt' },
      order: { number: expect.any(Number) },
    });
    await ctx.http().post(`${admin}/reviews/${id}/publish`).set(auth).expect(200);
    await ctx
      .http()
      .put(`${admin}/reviews/${id}/reply`)
      .set(auth)
      .send({ reply: 'Thank you, Grace!' })
      .expect(200);

    // A second buyer, with the store publishing automatically.
    await ctx
      .http()
      .put(`${admin}/apps`)
      .set(auth)
      .send({ ...apps, productReviews: { enabled: true, autoPublish: true } })
      .expect(200);
    const ada = await register('Ada');
    await payMock(sf, await buy(ada));
    await sf('put', '/products/linen-shirt/reviews/mine', { customer: ada })
      .send({ rating: 5, body: 'Best shirt I own, fits well.', authorName: 'Ada' })
      .expect(200);

    const list = await sf('get', '/products/linen-shirt/reviews').expect(200);
    expect(list.body).toMatchObject({
      rating: { average: 4.5, count: 2 },
      distribution: [1, 1, 0, 0, 0],
      pageCount: 1,
    });
    expect(list.body.items).toEqual([
      expect.objectContaining({ authorName: 'Ada', rating: 5, title: null }),
      expect.objectContaining({ authorName: 'Grace H.', reply: 'Thank you, Grace!' }),
    ]);
    expect((await sf('get', '/products/linen-shirt').expect(200)).body.rating).toEqual({
      average: 4.5,
      count: 2,
    });

    // Helpful marks: signed in, once per customer, never on your own review.
    const adaId = list.body.items[0].id as string;
    const graceId = list.body.items[1].id as string;
    await sf('put', `/products/linen-shirt/reviews/${adaId}/helpful`)
      .send({ helpful: true })
      .expect(401);
    await sf('put', `/products/linen-shirt/reviews/${adaId}/helpful`, { customer: ada })
      .send({ helpful: true })
      .expect(403);
    for (let i = 0; i < 2; i++) {
      const marked = await sf('put', `/products/linen-shirt/reviews/${graceId}/helpful`, {
        customer: ada,
      })
        .send({ helpful: true })
        .expect(200);
      expect(marked.body).toEqual({ helpfulCount: 1, helpful: true });
    }
    expect(
      (await sf('get', '/products/linen-shirt/reviews/mine', { customer: ada }).expect(200)).body
        .helpfulReviewIds,
    ).toEqual([graceId]);

    // Sorting and filtering by stars.
    const names = async (query: object) => {
      const res = await sf('get', '/products/linen-shirt/reviews').query(query).expect(200);
      return {
        names: (res.body.items as { authorName: string }[]).map((r) => r.authorName),
        total: res.body.total as number,
        sort: res.body.sort as string,
      };
    };
    expect(await names({ sort: 'helpful' })).toMatchObject({ names: ['Grace H.', 'Ada'] });
    expect(await names({ sort: 'lowest' })).toMatchObject({ names: ['Grace H.', 'Ada'] });
    expect(await names({ sort: 'highest' })).toMatchObject({ names: ['Ada', 'Grace H.'] });
    expect(await names({ stars: 4 })).toMatchObject({ names: ['Grace H.'], total: 1 });
    expect(await names({ stars: 2 })).toMatchObject({ names: [], total: 0 });
    expect(await names({ sort: 'bogus', stars: 9 })).toMatchObject({ sort: 'newest', total: 2 });

    await sf('put', `/products/linen-shirt/reviews/${graceId}/helpful`, { customer: ada })
      .send({ helpful: false })
      .expect(200)
      .expect(({ body }) => expect(body.helpfulCount).toBe(0));
    const cards = await sf('get', '/products').expect(200);
    expect(cards.body.items[0].rating).toEqual({ average: 4.5, count: 2 });

    // Rejecting takes it off the page and out of the rating; the author cannot resubmit it.
    await ctx.http().post(`${admin}/reviews/${id}/reject`).set(auth).expect(200);
    expect((await sf('get', '/products/linen-shirt').expect(200)).body.rating).toEqual({
      average: 5,
      count: 1,
    });
    await sf('put', '/products/linen-shirt/reviews/mine', { customer: grace })
      .send({ ...review, authorName: 'Grace H.' })
      .expect(409);

    // Deleting removes it for good; another store's staff cannot even see it.
    const other = await signup(ctx);
    const adaReview = (
      await ctx.http().get(`${admin}/reviews`).query({ status: 'PUBLISHED' }).set(auth).expect(200)
    ).body.items[0].id as string;
    await ctx
      .http()
      .delete(`${admin}/reviews/${adaReview}`)
      .set({ Authorization: `Bearer ${other.token}` })
      .expect(404);
    await ctx.http().delete(`${admin}/reviews/${adaReview}`).set(auth).expect(204);
    expect((await sf('get', '/products/linen-shirt').expect(200)).body.rating).toBeNull();
  });

  it('takes up to three photos per review, re-checks them, and erases reviews with the customer', async () => {
    const session = await signup(ctx);
    const store = await createStore(ctx, session.token);
    const auth = { Authorization: `Bearer ${session.token}` };
    const admin = `/api/v1/admin/stores/${store.id}`;
    const sf = storefrontClient(ctx, `${store.subdomain}.localhost:3200`);
    const variantId = (
      await ctx
        .http()
        .post(`${admin}/products`)
        .set(auth)
        .send({
          title: 'Cane chair',
          handle: 'cane-chair',
          status: 'ACTIVE',
          variants: [{ price: 9000, inventoryQuantity: 10 }],
        })
        .expect(201)
    ).body.variants[0].id as string;
    const apps = (await ctx.http().get(`${admin}/apps`).set(auth).expect(200)).body;
    await ctx
      .http()
      .put(`${admin}/apps`)
      .set(auth)
      .send({ ...apps, productReviews: { enabled: true, autoPublish: false } })
      .expect(200);
    const email = `meera-${randomUUID().slice(0, 6)}@example.com`;
    const customer = (
      await sf('post', '/customers/register')
        .send({ name: 'Meera Nair', email, password: 'review-password-123' })
        .expect(201)
    ).body.session.token as string;
    const cart = (await sf('post', '/cart').expect(201)).body.token as string;
    await sf('post', '/cart/lines', { cart }).send({ variantId, quantity: 1 }).expect(201);
    const placed = await sf('post', '/checkout', { cart, customer })
      .send({ email, shippingAddress: address, idempotencyKey: randomUUID() })
      .expect(201);
    await payMock(sf, placed.body.paymentUrl);

    const photo = (color: string) =>
      sharp({ create: { width: 1600, height: 1200, channels: 3, background: color } })
        .jpeg()
        .toBuffer();
    const upload = (files: Buffer[]) => {
      const req = sf('post', '/products/cane-chair/reviews/mine/photos', { customer });
      for (const [i, f] of files.entries()) req.attach('files', f, `p${i}.jpg`);
      return req;
    };

    // Photos need a review first.
    await upload([await photo('#c00')]).expect(409);
    await sf('put', '/products/cane-chair/reviews/mine', { customer })
      .send({ rating: 5, body: 'Sturdy and light, great finish.', authorName: 'Meera N.' })
      .expect(200);
    const queue = await ctx.http().get(`${admin}/reviews`).set(auth).expect(200);
    const reviewId = queue.body.items[0].id as string;
    await ctx.http().post(`${admin}/reviews/${reviewId}/publish`).set(auth).expect(200);

    const added = await upload([await photo('#c00'), await photo('#0c0')]).expect(201);
    expect(added.body.review.photos).toHaveLength(2);
    expect(added.body.review.photos[0]).toMatchObject({ width: 1200, height: 900 });
    expect(added.body.review.photos[0].thumbUrl).toMatch(/_w600\.webp$/);
    // New photos go back to the store before they are shown.
    expect(added.body.review.status).toBe('PENDING');
    await upload([await photo('#00c'), await photo('#ccc')]).expect(400);
    await upload([Buffer.from('not an image')]).expect(415);

    const mine = added.body.review.photos as { id: string; url: string }[];
    const media = await ctx.http().get(new URL(mine[0]!.url).pathname).expect(200);
    expect(media.headers['content-type']).toMatch(/image\/webp/);
    const afterRemove = await sf(
      'delete',
      `/products/cane-chair/reviews/mine/photos/${mine[0]!.id}`,
      { customer },
    ).expect(200);
    expect(afterRemove.body.review.photos.map((p: { id: string }) => p.id)).toEqual([mine[1]!.id]);
    await ctx.http().get(new URL(mine[0]!.url).pathname).expect(404);

    await ctx.http().post(`${admin}/reviews/${reviewId}/publish`).set(auth).expect(200);
    const listed = await sf('get', '/products/cane-chair/reviews').expect(200);
    expect(listed.body.items[0].photos).toHaveLength(1);
    const moderated = await ctx
      .http()
      .delete(`${admin}/reviews/${reviewId}/photos/${mine[1]!.id}`)
      .set(auth)
      .expect(200);
    expect(moderated.body.photos).toEqual([]);

    // Erasing the customer's data removes their review and the product's rating with it.
    await upload([await photo('#0cc')]).expect(201);
    const customerId = (await ctx.platform.customer.findFirstOrThrow({ where: { email } })).id;
    const order = await ctx.platform.order.findFirstOrThrow({ where: { customerId } });
    await ctx
      .http()
      .post(`${admin}/orders/${order.id}/fulfillments`)
      .set(auth)
      .send({})
      .expect(201);
    await ctx.http().post(`${admin}/customers/${customerId}/redact`).set(auth).expect(204);
    expect(await ctx.platform.productReview.count({ where: { customerId } })).toBe(0);
    expect(await ctx.platform.productReviewPhoto.count({ where: { storeId: store.id } })).toBe(0);
    expect((await sf('get', '/products/cane-chair').expect(200)).body.rating).toBeNull();
  });

  it('emails buyers once, after the order ships and the delay passes, for unreviewed products', async () => {
    const app = ctx.app as INestApplication;
    const mailbox = app.get<MemoryEmailSender>(EMAIL_SENDER);
    const outbox = app.get(OutboxProcessor);
    const requests = app.get(ReviewRequestsService);
    const session = await signup(ctx);
    const store = await createStore(ctx, session.token);
    const auth = { Authorization: `Bearer ${session.token}` };
    const admin = `/api/v1/admin/stores/${store.id}`;
    const sf = storefrontClient(ctx, `${store.subdomain}.localhost:3200`);
    const variant = async (title: string, handle: string) =>
      (
        await ctx
          .http()
          .post(`${admin}/products`)
          .set(auth)
          .send({
            title,
            handle,
            status: 'ACTIVE',
            variants: [{ price: 2500, inventoryQuantity: 10 }],
          })
          .expect(201)
      ).body.variants[0].id as string;
    const mug = await variant('Clay mug', 'clay-mug');
    const bowl = await variant('Clay bowl', 'clay-bowl');
    const apps = (await ctx.http().get(`${admin}/apps`).set(auth).expect(200)).body;
    await ctx
      .http()
      .put(`${admin}/apps`)
      .set(auth)
      .send({ ...apps, productReviews: { enabled: true, autoPublish: true, requestAfterDays: 5 } })
      .expect(200);

    const email = `lin-${randomUUID().slice(0, 6)}@example.com`;
    const customer = (
      await sf('post', '/customers/register')
        .send({ name: 'Lin Wu', email, password: 'review-password-123' })
        .expect(201)
    ).body.session.token as string;
    const cart = (await sf('post', '/cart').expect(201)).body.token as string;
    await sf('post', '/cart/lines', { cart }).send({ variantId: mug, quantity: 1 }).expect(201);
    await sf('post', '/cart/lines', { cart }).send({ variantId: bowl, quantity: 2 }).expect(201);
    const placed = await sf('post', '/checkout', { cart, customer })
      .send({ email, shippingAddress: address, idempotencyKey: randomUUID() })
      .expect(201);
    await payMock(sf, placed.body.paymentUrl);
    const order = await ctx.platform.order.findFirstOrThrow({
      where: { storeId: store.id, number: placed.body.orderNumber },
    });
    // Already reviewed the mug: the email only asks about the bowl.
    await sf('put', '/products/clay-mug/reviews/mine', { customer })
      .send({ rating: 5, body: 'Holds heat well, lovely glaze.', authorName: 'Lin W.' })
      .expect(200);

    const sendAndRead = async () => {
      while ((await outbox.processBatch()) > 0);
      mailbox.sent.length = 0;
      await requests.sendDue();
      while ((await outbox.processBatch()) > 0);
      return mailbox.sent.filter((m) => m.to === email && /How was your order/.test(m.subject));
    };

    // Not shipped yet: nothing.
    expect(await sendAndRead()).toEqual([]);
    await ctx
      .http()
      .post(`${admin}/orders/${order.id}/fulfillments`)
      .set(auth)
      .send({})
      .expect(201);
    // Shipped today: the 5-day delay has not passed.
    expect(await sendAndRead()).toEqual([]);

    // Shipped 6 days ago: one email, about the bowl only.
    await ctx.platform.fulfillment.updateMany({
      where: { orderId: order.id },
      data: { createdAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000) },
    });
    const [message, ...rest] = await sendAndRead();
    expect(rest).toEqual([]);
    expect(message?.text).toContain(`#${placed.body.orderNumber}`);
    expect(message?.text).toContain('/products/clay-bowl#reviews');
    expect(message?.text).not.toContain('clay-mug');
    // Never twice.
    expect(await sendAndRead()).toEqual([]);
    // The link in the email turns them off (a POST from the page); forged links do nothing.
    const token = /\/reviews\/emails-off\/([^\s]+)/.exec(message?.text ?? '')?.[1];
    expect(token).toBeTruthy();
    const forged = `${token!.slice(0, -1)}${token!.endsWith('A') ? 'B' : 'A'}`;
    await sf('post', `/review-emails/off/${forged}`).expect(404);
    await sf('post', `/review-emails/off/${token}`).expect(204);
    await sf('post', `/review-emails/off/${token}`).expect(204);
    const cart2 = (await sf('post', '/cart').expect(201)).body.token as string;
    await sf('post', '/cart/lines', { cart: cart2 })
      .send({ variantId: bowl, quantity: 1 })
      .expect(201);
    const placed2 = await sf('post', '/checkout', { cart: cart2, customer })
      .send({ email, shippingAddress: address, idempotencyKey: randomUUID() })
      .expect(201);
    await payMock(sf, placed2.body.paymentUrl);
    const order2 = await ctx.platform.order.findFirstOrThrow({
      where: { storeId: store.id, number: placed2.body.orderNumber },
    });
    await ctx
      .http()
      .post(`${admin}/orders/${order2.id}/fulfillments`)
      .set(auth)
      .send({})
      .expect(201);
    await ctx.platform.fulfillment.updateMany({
      where: { orderId: order2.id },
      data: { createdAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000) },
    });
    expect(await sendAndRead()).toEqual([]);

    // The merchant sees the choice; only the customer can turn the emails back on.
    const detail = await ctx
      .http()
      .get(`${admin}/customers/${order.customerId}`)
      .set(auth)
      .expect(200);
    expect(detail.body.reviewEmailsOptOutAt).toEqual(expect.any(String));
    expect((await sf('get', '/customers/me', { customer }).expect(200)).body.reviewEmails).toBe(
      false,
    );
    await sf('put', '/customers/me/review-emails').send({ enabled: true }).expect(401);
    await sf('put', '/customers/me/review-emails', { customer })
      .send({ enabled: true })
      .expect(204);
    expect((await sf('get', '/customers/me', { customer }).expect(200)).body.reviewEmails).toBe(
      true,
    );

    const timeline = await ctx.platform.orderEvent.findMany({ where: { orderId: order.id } });
    expect(timeline.map((e) => e.type)).toContain('review_request_sent');
  });
});
