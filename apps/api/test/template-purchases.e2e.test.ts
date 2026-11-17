import { createHmac } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { findThemeTemplate } from '@repo/contracts';
import { RAZORPAY_BILLING, RazorpayBilling } from '../src/platform/razorpay-billing.js';
import { FakeRazorpay, RAZORPAY_TEST_SECRET, razorpayWebhook } from './fake-razorpay.js';
import { createTestApp, merchantWithStore, resetDatabase, type TestContext } from './utils.js';

const KEY_SECRET = 'rzp-billing-key-secret';

function themeFor(templateId: string) {
  const template = findThemeTemplate(templateId);
  if (!template) throw new Error(`No template ${templateId}`);
  return { preset: template.preset, settings: template.settings };
}

describe('Premium templates: development provider', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp();
    await resetDatabase(ctx.owner);
  });
  afterAll(async () => {
    await ctx?.close();
  });

  it('blocks applying a premium template until it is bought, then allows it', async () => {
    const m = await merchantWithStore(ctx);
    const admin = `/api/v1/admin/stores/${m.store.id}`;

    const list = await ctx.http().get(`${admin}/premium-templates`).set(m.auth).expect(200);
    expect(list.body.map((t: { styleId: string; price: number }) => [t.styleId, t.price])).toEqual([
      ['atelier', 149_900],
      ['gallery', 99_900],
      ['cinema', 199_900],
      ['magazine', 249_900],
      ['studio', 299_900],
    ]);
    expect(list.body.every((t: { owned: boolean }) => !t.owned)).toBe(true);

    // Free templates apply as before; a premium one is refused with a 402 and a code.
    await ctx.http().put(`${admin}/theme`).set(m.auth).send(themeFor('fashion-luxe')).expect(200);
    const refused = await ctx
      .http()
      .put(`${admin}/theme`)
      .set(m.auth)
      .send(themeFor('fashion-atelier'))
      .expect(402);
    expect(refused.body.code).toBe('template_not_owned');

    // Publishing a draft that uses it is refused too.
    await ctx
      .http()
      .put(`${admin}/theme/draft`)
      .set(m.auth)
      .send(themeFor('home-atelier'))
      .expect(200);
    await ctx.http().post(`${admin}/theme/draft/publish`).set(m.auth).expect(402);

    // The development provider completes the purchase at once; buying again is a no-op.
    const bought = await ctx
      .http()
      .post(`${admin}/premium-templates/purchases`)
      .set(m.auth)
      .send({ styleId: 'atelier' })
      .expect(200);
    expect(bought.body).toEqual({ status: 'owned' });
    await ctx
      .http()
      .post(`${admin}/premium-templates/purchases`)
      .set(m.auth)
      .send({ styleId: 'atelier' })
      .expect(200);
    const history = await ctx
      .http()
      .get(`${admin}/premium-templates/purchases`)
      .set(m.auth)
      .expect(200);
    expect(history.body).toHaveLength(1);
    expect(history.body[0]).toMatchObject({ styleId: 'atelier', amount: 149_900, status: 'PAID' });

    // Every industry in the bought style is unlocked; other premium styles are not.
    await ctx
      .http()
      .put(`${admin}/theme`)
      .set(m.auth)
      .send(themeFor('fashion-atelier'))
      .expect(200);
    await ctx.http().post(`${admin}/theme/draft/publish`).set(m.auth).expect(200);
    await ctx.http().put(`${admin}/theme`).set(m.auth).send(themeFor('home-gallery')).expect(402);

    // Ownership belongs to the store that paid.
    const other = await merchantWithStore(ctx);
    await ctx
      .http()
      .put(`/api/v1/admin/stores/${other.store.id}/theme`)
      .set(other.auth)
      .send(themeFor('fashion-atelier'))
      .expect(402);
  });

  it('rejects unknown styles', async () => {
    const m = await merchantWithStore(ctx);
    await ctx
      .http()
      .post(`/api/v1/admin/stores/${m.store.id}/premium-templates/purchases`)
      .set(m.auth)
      .send({ styleId: 'minimal' })
      .expect(400);
  });
});

describe('Premium templates: Razorpay', () => {
  let ctx: TestContext;
  const fake = new FakeRazorpay();

  beforeAll(async () => {
    ctx = await createTestApp({
      overrides: [
        {
          provide: RAZORPAY_BILLING,
          useValue: new RazorpayBilling(
            'rzp_test_billing',
            KEY_SECRET,
            RAZORPAY_TEST_SECRET,
            fake.fetch,
            'https://api.razorpay.test',
          ),
        },
      ],
    });
    await resetDatabase(ctx.owner);
  });
  afterAll(async () => {
    await ctx?.close();
  });

  it('opens Checkout for an order, and only a correctly signed payment unlocks the style', async () => {
    const m = await merchantWithStore(ctx);
    const admin = `/api/v1/admin/stores/${m.store.id}`;
    const started = await ctx
      .http()
      .post(`${admin}/premium-templates/purchases`)
      .set(m.auth)
      .send({ styleId: 'cinema' })
      .expect(200);
    expect(started.body.status).toBe('checkout');
    const { orderId, amount, keyId } = started.body.checkout;
    expect({ amount, keyId }).toEqual({ amount: 199_900, keyId: 'rzp_test_billing' });
    expect(fake.last('POST', /^\/v1\/orders$/)?.body).toMatchObject({
      amount: 199_900,
      currency: 'INR',
      notes: { kind: 'template', storeId: m.store.id, styleId: 'cinema' },
    });

    // A forged signature is refused and nothing unlocks.
    await ctx
      .http()
      .post(`${admin}/premium-templates/purchases/confirm`)
      .set(m.auth)
      .send({ orderId, paymentId: 'pay_1', signature: 'a'.repeat(64) })
      .expect(400);
    await ctx.http().put(`${admin}/theme`).set(m.auth).send(themeFor('food-cinema')).expect(402);

    const signature = createHmac('sha256', KEY_SECRET).update(`${orderId}|pay_1`).digest('hex');
    const confirmed = await ctx
      .http()
      .post(`${admin}/premium-templates/purchases/confirm`)
      .set(m.auth)
      .send({ orderId, paymentId: 'pay_1', signature })
      .expect(200);
    expect(confirmed.body.find((t: { styleId: string }) => t.styleId === 'cinema').owned).toBe(
      true,
    );
    await ctx.http().put(`${admin}/theme`).set(m.auth).send(themeFor('food-cinema')).expect(200);
  });

  it('unlocks from the order.paid webhook after re-reading the order', async () => {
    const m = await merchantWithStore(ctx);
    const admin = `/api/v1/admin/stores/${m.store.id}`;
    const started = await ctx
      .http()
      .post(`${admin}/premium-templates/purchases`)
      .set(m.auth)
      .send({ styleId: 'gallery' })
      .expect(200);
    const { orderId } = started.body.checkout;

    // Razorpay says the order is not paid yet: the webhook changes nothing.
    fake.orderStatus = 'attempted';
    const early = razorpayWebhook({
      event: 'order.paid',
      payload: { order: { entity: { id: orderId } }, payment: { entity: { id: 'pay_2' } } },
    });
    await ctx
      .http()
      .post('/api/v1/webhooks/billing/razorpay')
      .set(early.headers)
      .send(early.body)
      .expect(200);
    await ctx.http().put(`${admin}/theme`).set(m.auth).send(themeFor('art-gallery')).expect(402);

    fake.orderStatus = 'paid';
    const paid = razorpayWebhook({
      event: 'order.paid',
      payload: { order: { entity: { id: orderId } }, payment: { entity: { id: 'pay_2' } } },
    });
    await ctx
      .http()
      .post('/api/v1/webhooks/billing/razorpay')
      .set(paid.headers)
      .send(paid.body)
      .expect(200);
    await ctx.http().put(`${admin}/theme`).set(m.auth).send(themeFor('art-gallery')).expect(200);
  });
});
