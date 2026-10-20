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

const address = (country: string, region?: string) => ({
  name: 'Sam',
  line1: '1 Road',
  city: 'Town',
  postalCode: '00000',
  country,
  ...(region ? { region } : {}),
});

describe('Shipping, taxes, discounts, domains, themes', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp();
    await resetDatabase(ctx.owner);
  });

  afterAll(async () => {
    await ctx?.close();
  });

  async function setup(stock = 20) {
    const merchant = await merchantWithStore(ctx);
    const admin = `/api/v1/admin/stores/${merchant.store.id}`;
    const sf = storefrontClient(ctx, `${merchant.store.subdomain}.localhost:3200`);
    const product = await ctx
      .http()
      .post(`${admin}/products`)
      .set(merchant.auth)
      .send({
        title: 'Kettle',
        status: 'ACTIVE',
        variants: [{ price: 5000, weightGrams: 1500, inventoryQuantity: stock }],
      })
      .expect(201);
    const cart = (await sf('post', '/cart').expect(201)).body.token as string;
    await sf('post', '/cart/lines', { cart })
      .send({ variantId: product.body.variants[0].id, quantity: 1 })
      .expect(201);
    return { merchant, admin, sf, cart, variantId: product.body.variants[0].id as string };
  }

  it('picks shipping rates by country (specific beats rest-of-world) and conditions', async () => {
    const { merchant, admin, sf, cart } = await setup();
    const preview = (country: string) =>
      sf('post', '/checkout/preview', { cart })
        .send({ country })
        .expect(200)
        .then((r) => r.body);

    expect((await preview('US')).shippingOptions).toEqual([
      { id: 'free-standard', name: 'Standard shipping', price: 0 },
    ]);

    const domestic = await ctx
      .http()
      .post(`${admin}/shipping-zones`)
      .set(merchant.auth)
      .send({ name: 'Domestic', countries: ['us'] })
      .expect(201);
    const zoneId = domestic.body[0].id as string;
    await ctx
      .http()
      .post(`${admin}/shipping-zones/${zoneId}/rates`)
      .set(merchant.auth)
      .send({ name: 'Ground', price: 700 })
      .expect(201);
    await ctx
      .http()
      .post(`${admin}/shipping-zones/${zoneId}/rates`)
      .set(merchant.auth)
      .send({ name: 'Free over $100', price: 0, minSubtotal: 10000 })
      .expect(201);
    await ctx
      .http()
      .post(`${admin}/shipping-zones/${zoneId}/rates`)
      .set(merchant.auth)
      .send({ name: 'Light parcel', price: 300, maxWeightGrams: 1000 })
      .expect(201);
    const world = await ctx
      .http()
      .post(`${admin}/shipping-zones`)
      .set(merchant.auth)
      .send({ name: 'World', countries: ['*'] })
      .expect(201);
    await ctx
      .http()
      .post(`${admin}/shipping-zones/${world.body[1].id}/rates`)
      .set(merchant.auth)
      .send({ name: 'International', price: 2500 })
      .expect(201);

    const us = await preview('US');
    expect(us.shippingOptions.map((o: { name: string }) => o.name)).toEqual(['Ground']);
    expect(us).toMatchObject({ shippingTotal: 700, total: 5700 });
    expect((await preview('FR')).shippingOptions.map((o: { name: string }) => o.name)).toEqual([
      'International',
    ]);

    await ctx
      .http()
      .post(`${admin}/shipping-zones`)
      .set(merchant.auth)
      .send({ name: 'Bad', countries: ['USA'] })
      .expect(400);
    await ctx
      .http()
      .post(`${admin}/shipping-zones/${zoneId}/rates`)
      .set(merchant.auth)
      .send({ name: 'Broken', price: 1, minSubtotal: 100, maxSubtotal: 10 })
      .expect(400);
  });

  it('applies country and region tax rates, optionally on shipping', async () => {
    const { merchant, admin, sf, cart } = await setup();
    await ctx
      .http()
      .put(`${admin}/tax-rates`)
      .set(merchant.auth)
      .send({ country: 'US', name: 'Federal-ish', rateBps: 500 })
      .expect(200);
    await ctx
      .http()
      .put(`${admin}/tax-rates`)
      .set(merchant.auth)
      .send({ country: 'US', region: 'ca', name: 'California', rateBps: 825 })
      .expect(200);
    await ctx
      .http()
      .put(`${admin}/tax-rates`)
      .set(merchant.auth)
      .send({ country: 'GB', name: 'VAT', rateBps: 2000, appliesToShipping: true })
      .expect(200);
    await ctx
      .http()
      .post(`${admin}/shipping-zones`)
      .set(merchant.auth)
      .send({ name: 'All', countries: ['*'] })
      .expect(201);
    const zones = await ctx.http().get(`${admin}/shipping-zones`).set(merchant.auth).expect(200);
    await ctx
      .http()
      .post(`${admin}/shipping-zones/${zones.body[0].id}/rates`)
      .set(merchant.auth)
      .send({ name: 'Flat', price: 1000 })
      .expect(201);

    const preview = (country: string, region?: string) =>
      sf('post', '/checkout/preview', { cart })
        .send({ country, region })
        .expect(200)
        .then((r) => r.body);
    expect((await preview('US', 'NY')).taxTotal).toBe(250);
    expect((await preview('US', 'CA')).taxTotal).toBe(413); // 8.25% of 5000 = 412.5 -> 413
    expect((await preview('GB')).taxTotal).toBe(1200); // 20% of (5000 + 1000 shipping)
    expect((await preview('DE')).taxTotal).toBe(0);

    const rates = await ctx.http().get(`${admin}/tax-rates`).set(merchant.auth).expect(200);
    expect(rates.body).toHaveLength(3);
    await ctx
      .http()
      .put(`${admin}/tax-rates`)
      .set(merchant.auth)
      .send({ country: 'US', name: 'Too much', rateBps: 10001 })
      .expect(400);
  });

  it('validates discount codes and records redemptions atomically', async () => {
    const { merchant, admin, sf, cart } = await setup();
    const create = (body: object) =>
      ctx.http().post(`${admin}/discounts`).set(merchant.auth).send(body);
    await create({ code: 'save10', type: 'PERCENTAGE', value: 10 }).expect(201);
    await create({ code: 'SAVE10', type: 'PERCENTAGE', value: 10 }).expect(409);
    await create({ code: 'FIVER', type: 'FIXED_AMOUNT', value: 500, minSubtotal: 10000 }).expect(
      201,
    );
    await create({ code: 'SHIPFREE', type: 'FREE_SHIPPING', value: 0 }).expect(201);
    await create({
      code: 'OLD',
      type: 'PERCENTAGE',
      value: 50,
      endsAt: new Date(Date.now() - 60_000).toISOString(),
    }).expect(201);
    await create({ code: 'ONCE', type: 'PERCENTAGE', value: 20, usageLimit: 1 }).expect(201);
    await create({ code: 'BAD', type: 'PERCENTAGE', value: 150 }).expect(400);

    const preview = (discountCode: string) =>
      sf('post', '/checkout/preview', { cart })
        .send({ country: 'US', discountCode })
        .expect(200)
        .then((r) => r.body);
    expect(await preview('save10')).toMatchObject({
      discountTotal: 500,
      total: 4500,
      discount: { applied: true, code: 'SAVE10' },
    });
    expect((await preview('FIVER')).discount).toMatchObject({
      applied: false,
      message: expect.stringMatching(/minimum/),
    });
    expect((await preview('OLD')).discount).toMatchObject({
      applied: false,
      message: expect.stringMatching(/expired/),
    });
    expect((await preview('NOPE')).discount).toMatchObject({ applied: false });

    // Placing an order with an invalid code is refused, not silently ignored.
    await sf('post', '/checkout', { cart })
      .send({
        email: 'a@example.com',
        shippingAddress: address('US'),
        discountCode: 'OLD',
        idempotencyKey: randomUUID(),
      })
      .expect(400);

    // Usage limit: an unpaid order does not use up ONCE; paying for it does.
    const placed = await sf('post', '/checkout', { cart })
      .send({
        email: 'a@example.com',
        shippingAddress: address('US'),
        discountCode: 'ONCE',
        idempotencyKey: randomUUID(),
      })
      .expect(201);
    expect(placed.body.orderNumber).toBe(1001);
    const order = await ctx.platform.order.findFirstOrThrow({
      where: { storeId: merchant.store.id },
    });
    expect(order).toMatchObject({ discountCode: 'ONCE', discountTotal: 1000, total: 4000 });
    const usedCount = async () =>
      (await ctx.http().get(`${admin}/discounts`).set(merchant.auth).expect(200)).body.find(
        (d: { code: string }) => d.code === 'ONCE',
      ).usedCount as number;
    expect(await usedCount()).toBe(0);
    await payMock(sf, placed.body.paymentUrl);
    expect(await usedCount()).toBe(1);

    const second = (await sf('post', '/cart').expect(201)).body.token as string;
    const variant = await ctx.platform.productVariant.findFirstOrThrow({
      where: { storeId: merchant.store.id },
    });
    await sf('post', '/cart/lines', { cart: second })
      .send({ variantId: variant.id, quantity: 1 })
      .expect(201);
    const refused = await sf('post', '/checkout', { cart: second })
      .send({
        email: 'b@example.com',
        shippingAddress: address('US'),
        discountCode: 'ONCE',
        idempotencyKey: randomUUID(),
      })
      .expect(400);
    expect(refused.body.detail).toMatch(/usage limit/);

    const discounts = await ctx.http().get(`${admin}/discounts`).set(merchant.auth).expect(200);

    const toggled = await ctx
      .http()
      .patch(
        `${admin}/discounts/${discounts.body.find((d: { code: string }) => d.code === 'SAVE10').id}`,
      )
      .set(merchant.auth)
      .send({ active: false })
      .expect(200);
    expect(toggled.body.active).toBe(false);
    // (The first cart was emptied when its order was paid; preview with the second one.)
    const afterToggle = await sf('post', '/checkout/preview', { cart: second })
      .send({ country: 'US', discountCode: 'SAVE10' })
      .expect(200);
    expect(afterToggle.body.discount.applied).toBe(false);
  });

  it('free-shipping codes zero the shipping charge', async () => {
    const { merchant, admin, sf, cart } = await setup();
    await ctx
      .http()
      .post(`${admin}/shipping-zones`)
      .set(merchant.auth)
      .send({ name: 'US', countries: ['US'] })
      .expect(201);
    const zones = await ctx.http().get(`${admin}/shipping-zones`).set(merchant.auth).expect(200);
    await ctx
      .http()
      .post(`${admin}/shipping-zones/${zones.body[0].id}/rates`)
      .set(merchant.auth)
      .send({ name: 'Ground', price: 900 })
      .expect(201);
    await ctx
      .http()
      .post(`${admin}/discounts`)
      .set(merchant.auth)
      .send({ code: 'SHIPFREE', type: 'FREE_SHIPPING', value: 0 })
      .expect(201);
    const result = await sf('post', '/checkout/preview', { cart })
      .send({ country: 'US', discountCode: 'shipfree' })
      .expect(200);
    expect(result.body).toMatchObject({ shippingTotal: 0, discountTotal: 0, total: 5000 });
  });

  it('connects, verifies and routes a custom domain to the right store', async () => {
    const { merchant, admin } = await setup();
    const added = await ctx
      .http()
      .post(`${admin}/domains`)
      .set(merchant.auth)
      .send({ hostname: 'Shop.Example.COM' })
      .expect(201);
    expect(added.body).toMatchObject({
      hostname: 'shop.example.com',
      verified: false,
      verificationRecord: { type: 'TXT', name: '_shop-verification.shop.example.com' },
    });
    const sfDomain = storefrontClient(ctx, 'shop.example.com');
    await sfDomain('get', '/shop').expect(404); // not verified yet

    const verified = await ctx
      .http()
      .post(`${admin}/domains/${added.body.id}/verify`)
      .set(merchant.auth)
      .expect(200);
    expect(verified.body).toMatchObject({ verified: true, isPrimary: true });
    const shop = await sfDomain('get', '/shop').expect(200);
    expect(shop.body.subdomain).toBe(merchant.store.subdomain);

    const other = await merchantWithStore(ctx);
    await ctx
      .http()
      .post(`/api/v1/admin/stores/${other.store.id}/domains`)
      .set(other.auth)
      .send({ hostname: 'shop.example.com' })
      .expect(409);
    await ctx
      .http()
      .post(`/api/v1/admin/stores/${other.store.id}/domains/${added.body.id}/verify`)
      .set(other.auth)
      .expect(404);
    await ctx
      .http()
      .post(`/api/v1/admin/stores/${other.store.id}/domains`)
      .set(other.auth)
      .send({ hostname: 'evil.localhost' })
      .expect(400);
    await ctx
      .http()
      .post(`/api/v1/admin/stores/${other.store.id}/domains`)
      .set(other.auth)
      .send({ hostname: 'not a domain' })
      .expect(400);

    await ctx.http().delete(`${admin}/domains/${added.body.id}`).set(merchant.auth).expect(204);
    await sfDomain('get', '/shop').expect(404);
  });

  it('does not let an unverified claim block or hijack a domain', async () => {
    const { merchant, admin } = await setup();
    const squatter = await merchantWithStore(ctx);
    const squat = await ctx
      .http()
      .post(`/api/v1/admin/stores/${squatter.store.id}/domains`)
      .set(squatter.auth)
      .send({ hostname: 'brand.example.org' })
      .expect(201);

    // The real owner can still add and verify it (their own TXT token).
    const added = await ctx
      .http()
      .post(`${admin}/domains`)
      .set(merchant.auth)
      .send({ hostname: 'brand.example.org' })
      .expect(201);
    expect(added.body.verificationRecord.value).not.toBe(squat.body.verificationRecord.value);
    await ctx
      .http()
      .post(`${admin}/domains`)
      .set(merchant.auth)
      .send({ hostname: 'brand.example.org' })
      .expect(409);
    await ctx
      .http()
      .post(`${admin}/domains/${added.body.id}/verify`)
      .set(merchant.auth)
      .expect(200);

    const late = await ctx
      .http()
      .post(`/api/v1/admin/stores/${squatter.store.id}/domains/${squat.body.id}/verify`)
      .set(squatter.auth)
      .expect(409);
    expect(late.body.detail).toMatch(/another store/);
    const shop = await storefrontClient(ctx, 'brand.example.org')('get', '/shop').expect(200);
    expect(shop.body.subdomain).toBe(merchant.store.subdomain);
  });

  it('stores validated themes and serves them to the storefront', async () => {
    const { merchant, admin, sf } = await setup();
    expect((await sf('get', '/shop').expect(200)).body.theme).toMatchObject({
      preset: 'minimal',
      settings: { brandColor: '#111827' },
    });

    const theme = {
      preset: 'bold',
      settings: {
        brandColor: '#0f766e',
        accentColor: '#f59e0b',
        font: 'serif',
        heroTitle: 'Brew better',
        heroSubtitle: '',
        announcement: 'Free shipping over $100',
      },
    };
    await ctx.http().put(`${admin}/theme`).set(merchant.auth).send(theme).expect(200);
    expect((await sf('get', '/shop').expect(200)).body.theme).toEqual(theme);

    for (const bad of [
      { ...theme, preset: 'custom' },
      {
        ...theme,
        settings: { ...theme.settings, brandColor: 'red; background:url(javascript:alert(1))' },
      },
      { ...theme, settings: { ...theme.settings, css: 'body{}' } },
    ]) {
      await ctx.http().put(`${admin}/theme`).set(merchant.auth).send(bad).expect(400);
    }

    const staff = await merchantWithStore(ctx);
    await ctx.platform.storeMember.create({
      data: {
        storeId: merchant.store.id,
        userId: staff.session.user.id,
        role: 'STAFF',
        permissions: ['settings:read'],
      },
    });
    await ctx.http().get(`${admin}/theme`).set(staff.auth).expect(200);
    await ctx.http().put(`${admin}/theme`).set(staff.auth).send(theme).expect(403);
    await ctx.http().get(`${admin}/discounts`).set(staff.auth).expect(403);
  });

  it('isolates settings between stores', async () => {
    const a = await setup();
    const b = await setup();
    await ctx
      .http()
      .post(`${a.admin}/shipping-zones`)
      .set(a.merchant.auth)
      .send({ name: 'A only', countries: ['US'] })
      .expect(201);
    const zones = await ctx
      .http()
      .get(`${a.admin}/shipping-zones`)
      .set(a.merchant.auth)
      .expect(200);
    const zoneId = zones.body[0].id as string;
    await ctx
      .http()
      .post(`${a.admin}/discounts`)
      .set(a.merchant.auth)
      .send({ code: 'ALICE', type: 'PERCENTAGE', value: 50 })
      .expect(201);

    expect(
      (await ctx.http().get(`${b.admin}/shipping-zones`).set(b.merchant.auth).expect(200)).body,
    ).toEqual([]);
    await ctx.http().delete(`${b.admin}/shipping-zones/${zoneId}`).set(b.merchant.auth).expect(404);
    await ctx
      .http()
      .post(`${b.admin}/shipping-zones/${zoneId}/rates`)
      .set(b.merchant.auth)
      .send({ name: 'x', price: 1 })
      .expect(404);
    const preview = await b
      .sf('post', '/checkout/preview', { cart: b.cart })
      .send({ country: 'US', discountCode: 'ALICE' })
      .expect(200);
    expect(preview.body.discount.applied).toBe(false);
  });
});
