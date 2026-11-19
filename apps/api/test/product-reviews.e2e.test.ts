import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
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
});
