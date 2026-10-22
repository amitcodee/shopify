import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  createTestApp,
  merchantWithStore,
  payMock,
  resetDatabase,
  storefrontClient,
  type TestContext,
} from './utils.js';

const address = { name: 'A', line1: '1 Way', city: 'Paris', postalCode: '75001', country: 'FR' };

describe('Presentment currencies', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp();
    await resetDatabase(ctx.owner);
  });

  afterAll(async () => {
    await ctx?.close();
  });

  it('shows and charges converted prices, and reports sales in the store currency', async () => {
    const m = await merchantWithStore(ctx); // USD
    const admin = `/api/v1/admin/stores/${m.store.id}`;
    const sf = storefrontClient(ctx, `${m.store.subdomain}.localhost:3200`);
    const product = await ctx
      .http()
      .post(`${admin}/products`)
      .set(m.auth)
      .send({ title: 'Lamp', status: 'ACTIVE', variants: [{ price: 1999, inventoryQuantity: 9 }] })
      .expect(201);
    const zone = await ctx
      .http()
      .post(`${admin}/shipping-zones`)
      .set(m.auth)
      .send({ name: 'France', countries: ['FR'] })
      .expect(201);
    await ctx
      .http()
      .post(`${admin}/shipping-zones/${zone.body[0].id}/rates`)
      .set(m.auth)
      .send({ name: 'Standard', price: 1000 })
      .expect(201);

    await ctx
      .http()
      .put(`${admin}/currencies`)
      .set(m.auth)
      .send({ currencies: [{ currency: 'USD', rate: 1 }] })
      .expect(400); // the store currency itself
    const saved = await ctx
      .http()
      .put(`${admin}/currencies`)
      .set(m.auth)
      .send({ currencies: [{ currency: 'EUR', rate: 0.5, rounding: 'WHOLE' }] })
      .expect(200);
    expect(saved.body).toEqual([{ currency: 'EUR', rate: 0.5, rounding: 'WHOLE' }]);

    const shop = await sf('get', '/shop', { currency: 'EUR' }).expect(200);
    expect(shop.body).toMatchObject({
      currency: 'EUR',
      baseCurrency: 'USD',
      currencies: ['USD', 'EUR'],
    });
    // Unknown or disabled currencies fall back to the store currency.
    expect((await sf('get', '/shop', { currency: 'GBP' }).expect(200)).body.currency).toBe('USD');

    // 19.99 USD × 0.5 = 9.995 EUR, rounded up to a whole 10.00.
    const page = await sf('get', '/products/lamp', { currency: 'EUR' }).expect(200);
    expect(page.body.variants[0].price).toBe(1000);
    const cards = await sf('get', '/products', { currency: 'EUR' }).expect(200);
    expect(cards.body.items[0].minPrice).toBe(1000);

    const cart = (await sf('post', '/cart').expect(201)).body.token as string;
    await sf('post', '/cart/lines', { cart, currency: 'EUR' })
      .send({ variantId: product.body.variants[0].id, quantity: 2 })
      .expect(201);
    const eurCart = await sf('get', '/cart', { cart, currency: 'EUR' }).expect(200);
    expect(eurCart.body).toMatchObject({ currency: 'EUR', subtotal: 2000 });

    const preview = await sf('post', '/checkout/preview', { cart, currency: 'EUR' })
      .send({ country: 'FR' })
      .expect(200);
    // Shipping 10.00 USD converts exactly: 5.00 EUR.
    expect(preview.body).toMatchObject({
      currency: 'EUR',
      subtotal: 2000,
      shippingTotal: 500,
      total: 2500,
    });

    // Gift cards are tied to the store currency.
    const card = await ctx
      .http()
      .post(`${admin}/gift-cards`)
      .set(m.auth)
      .send({ initialValue: 500 })
      .expect(201);
    const withCard = await sf('post', '/checkout/preview', { cart, currency: 'EUR' })
      .send({ country: 'FR', giftCardCode: card.body.code })
      .expect(200);
    expect(withCard.body.giftCardError).toBe('This gift card is not valid.');

    const placed = await sf('post', '/checkout', { cart, currency: 'EUR' })
      .send({ email: 'eu@example.com', shippingAddress: address, idempotencyKey: randomUUID() })
      .expect(201);
    const order = await ctx.platform.order.findFirstOrThrow({
      where: { storeId: m.store.id, number: placed.body.orderNumber },
      include: { payments: true },
    });
    expect(order).toMatchObject({ currency: 'EUR', total: 2500, exchangeRate: 0.5 });
    expect(order.payments[0]).toMatchObject({ currency: 'EUR', amount: 2500 });
    await payMock(sf, placed.body.paymentUrl);

    // 25.00 EUR at 0.5 is 50.00 USD in the store's reports.
    const analytics = await ctx.http().get(`${admin}/analytics`).set(m.auth).expect(200);
    expect(analytics.body).toMatchObject({ currency: 'USD', grossSales: 5000, orderCount: 1 });
    const customers = await ctx.http().get(`${admin}/customers`).set(m.auth).expect(200);
    expect(customers.body.items[0]).toMatchObject({ email: 'eu@example.com', totalSpent: 5000 });

    // The same store still sells in USD to everyone else.
    const usd = await sf('get', '/products/lamp').expect(200);
    expect(usd.body.variants[0].price).toBe(1999);
  });
});
