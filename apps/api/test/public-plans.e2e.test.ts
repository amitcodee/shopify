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

  it('lists the default plans without auth, exposing only public fields', async () => {
    const res = await ctx.http().get('/api/v1/public/plans').expect(200);
    expect(res.body).toEqual([
      {
        code: 'starter',
        name: 'Starter',
        priceMonthly: 0,
        maxProducts: 25,
        maxStaff: 2,
        maxOrdersPerMonth: 100,
        transactionFeeBps: 200,
      },
      {
        code: 'growth',
        name: 'Growth',
        priceMonthly: 2900,
        maxProducts: 1000,
        maxStaff: 10,
        maxOrdersPerMonth: null,
        transactionFeeBps: 100,
      },
      {
        code: 'pro',
        name: 'Pro',
        priceMonthly: 9900,
        maxProducts: null,
        maxStaff: null,
        maxOrdersPerMonth: null,
        transactionFeeBps: 50,
      },
    ]);
    expect(res.headers['cache-control']).toContain('max-age');
  });

  it('hides inactive plans and follows sortOrder', async () => {
    await ctx.platform.plan.update({ where: { code: 'growth' }, data: { active: false } });
    await ctx.platform.plan.update({ where: { code: 'pro' }, data: { sortOrder: 0 } });
    const res = await ctx.http().get('/api/v1/public/plans').expect(200);
    expect(res.body.map((p: { code: string }) => p.code)).toEqual(['pro', 'starter']);

    await ctx.platform.plan.update({ where: { code: 'growth' }, data: { active: true } });
    await ctx.platform.plan.update({ where: { code: 'pro' }, data: { sortOrder: 3 } });
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
