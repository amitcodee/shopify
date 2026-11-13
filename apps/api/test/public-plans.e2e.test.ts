import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, resetDatabase, type TestContext } from './utils.js';

describe('Public plans', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp();
    await resetDatabase(ctx.owner);
  });

  afterAll(async () => {
    await ctx?.close();
  });

  it('lists the default plan without auth, exposing only public fields', async () => {
    const res = await ctx.http().get('/api/v1/public/plans').expect(200);
    expect(res.body).toEqual([
      {
        code: 'standard',
        name: 'Standard',
        priceMonthly: 79_900,
        currency: 'INR',
        trialDays: 7,
        introPrice: 9_900,
        introCycles: 3,
        introUpiOnly: false,
        maxProducts: null,
        maxStaff: 5,
        maxOrdersPerMonth: null,
        transactionFeeBps: 0,
      },
    ]);
    expect(res.headers['cache-control']).toContain('max-age');
  });

  it('hides inactive plans and follows sortOrder', async () => {
    const extra = await ctx.platform.plan.create({
      data: { code: 'scale', name: 'Scale', priceMonthly: 199_900, sortOrder: 0 },
    });
    let res = await ctx.http().get('/api/v1/public/plans').expect(200);
    expect(res.body.map((p: { code: string }) => p.code)).toEqual(['scale', 'standard']);
    await ctx.platform.plan.update({ where: { id: extra.id }, data: { active: false } });
    res = await ctx.http().get('/api/v1/public/plans').expect(200);
    expect(res.body.map((p: { code: string }) => p.code)).toEqual(['standard']);
    await ctx.platform.plan.delete({ where: { id: extra.id } });
  });

  it('shares only the support email for the contact page, hiding the placeholder', async () => {
    const before = await ctx.http().get('/api/v1/public/contact').expect(200);
    expect(before.body).toEqual({ supportEmail: null });

    await ctx.platform.platformSetting.upsert({
      where: { key: 'platform' },
      update: { value: { supportEmail: 'help@shops.test' } },
      create: { key: 'platform', value: { supportEmail: 'help@shops.test' } },
    });
    const after = await ctx.http().get('/api/v1/public/contact').expect(200);
    expect(after.body).toEqual({ supportEmail: 'help@shops.test' });
    await ctx.platform.platformSetting.deleteMany({ where: { key: 'platform' } });
  });
});
