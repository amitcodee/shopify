import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { BillingService } from '../src/platform/billing.service.js';
import { StoreResolver } from '../src/storefront/store-resolver.js';
import { StoreClosureService } from '../src/stores/store-closure.service.js';
import {
  createTestApp,
  merchantWithStore,
  payMock,
  resetDatabase,
  signup,
  storefrontClient,
  type TestContext,
  uniqueEmail,
} from './utils.js';

describe('Plans, billing, limits and platform admin', () => {
  let ctx: TestContext;
  let admin: { Authorization: string };
  let support: { Authorization: string };

  beforeAll(async () => {
    ctx = await createTestApp();
    await resetDatabase(ctx.owner);
    const superAdmin = await signup(ctx);
    await ctx.platform.user.update({
      where: { id: superAdmin.user.id },
      data: { platformRole: 'SUPER_ADMIN' },
    });
    admin = { Authorization: `Bearer ${superAdmin.token}` };
    const supportUser = await signup(ctx);
    await ctx.platform.user.update({
      where: { id: supportUser.user.id },
      data: { platformRole: 'SUPPORT' },
    });
    support = { Authorization: `Bearer ${supportUser.token}` };
  });

  afterAll(async () => {
    await ctx?.close();
  });

  /** The default plan plus a bigger test-only plan to switch between. */
  async function plans() {
    let res = await ctx.http().get('/api/v1/platform/plans').set(admin).expect(200);
    const find = (code: string) =>
      res.body.find((p: { code: string }) => p.code === code) as { id: string } | undefined;
    if (!find('scale')) {
      await ctx
        .http()
        .post('/api/v1/platform/plans')
        .set(admin)
        .send({
          code: 'scale',
          name: 'Scale',
          priceMonthly: 199_900,
          maxProducts: null,
          maxStaff: null,
          maxOrdersPerMonth: null,
          sortOrder: 2,
        })
        .expect(201);
      res = await ctx.http().get('/api/v1/platform/plans').set(admin).expect(200);
    }
    return { standard: find('standard')!, scale: find('scale')! };
  }

  it('starts every new store on a 7-day trial of the INR plan with the launch offer', async () => {
    const { store, auth } = await merchantWithStore(ctx);
    const billing = await ctx
      .http()
      .get(`/api/v1/admin/stores/${store.id}/billing`)
      .set(auth)
      .expect(200);
    expect(billing.body).toMatchObject({
      plan: {
        code: 'standard',
        priceMonthly: 79_900,
        currency: 'INR',
        trialDays: 7,
        introPrice: 9_900,
        introCycles: 3,
        transactionFeeBps: 0,
        maxProducts: null,
      },
      status: 'TRIALING',
      provider: 'none',
      locked: false,
      action: 'subscribe',
      introAvailable: true,
      usage: { products: 0, staff: 1, ordersThisMonth: 0 },
    });
    const days = (Date.parse(billing.body.trialEndsAt) - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(6.9);
    expect(days).toBeLessThanOrEqual(7);
  });

  it('enforces product and staff limits with 402 and lifts them on upgrade', async () => {
    const { store, auth } = await merchantWithStore(ctx);
    const base = `/api/v1/admin/stores/${store.id}`;
    const { scale, standard } = await plans();
    await ctx.platform.plan.update({
      where: { id: standard.id },
      data: { maxProducts: 2, maxStaff: 2 },
    });
    try {
      for (const title of ['A', 'B']) {
        await ctx
          .http()
          .post(`${base}/products`)
          .set(auth)
          .send({ title, variants: [{ price: 100 }] })
          .expect(201);
      }
      const blocked = await ctx
        .http()
        .post(`${base}/products`)
        .set(auth)
        .send({ title: 'C', variants: [{ price: 100 }] })
        .expect(402);
      expect(blocked.body).toMatchObject({
        title: 'Plan limit reached',
        detail: expect.stringMatching(/up to 2 products/),
      });

      await ctx
        .http()
        .post(`${base}/staff/invitations`)
        .set(auth)
        .send({ email: uniqueEmail(), role: 'STAFF' })
        .expect(201);
      await ctx
        .http()
        .post(`${base}/staff/invitations`)
        .set(auth)
        .send({ email: uniqueEmail(), role: 'STAFF' })
        .expect(402);

      const upgraded = await ctx
        .http()
        .post(`${base}/billing/plan`)
        .set(auth)
        .send({ planId: scale.id })
        .expect(200);
      expect(upgraded.body).toMatchObject({
        checkoutUrl: null,
        checkout: null,
        billing: {
          plan: { code: 'scale' },
          status: 'ACTIVE',
          invoices: [{ amount: 199_900, currency: 'INR', status: 'PAID', planName: 'Scale' }],
        },
      });
      await ctx
        .http()
        .post(`${base}/products`)
        .set(auth)
        .send({ title: 'C', variants: [{ price: 100 }] })
        .expect(201);

      // Downgrading back is blocked while usage exceeds the smaller plan.
      const downgrade = await ctx
        .http()
        .post(`${base}/billing/plan`)
        .set(auth)
        .send({ planId: standard.id })
        .expect(402);
      expect(downgrade.body.detail).toMatch(/Reduce your catalog to 2 products/);
    } finally {
      await ctx.platform.plan.update({
        where: { id: standard.id },
        data: { maxProducts: null, maxStaff: 5 },
      });
    }
  });

  it('caps monthly orders on the storefront', async () => {
    const { store, auth } = await merchantWithStore(ctx);
    const { standard } = await plans();
    await ctx.platform.plan.update({ where: { id: standard.id }, data: { maxOrdersPerMonth: 1 } });
    try {
      const sf = storefrontClient(ctx, `${store.subdomain}.localhost`);
      const product = await ctx
        .http()
        .post(`/api/v1/admin/stores/${store.id}/products`)
        .set(auth)
        .send({
          title: 'Thing',
          status: 'ACTIVE',
          variants: [{ price: 100, trackInventory: false }],
        })
        .expect(201);
      const order = async () => {
        const cart = (await sf('post', '/cart').expect(201)).body.token as string;
        await sf('post', '/cart/lines', { cart })
          .send({ variantId: product.body.variants[0].id })
          .expect(201);
        return sf('post', '/checkout', { cart }).send({
          email: 'x@example.com',
          idempotencyKey: randomUUID(),
          shippingAddress: { name: 'X', line1: '1', city: 'C', postalCode: '1', country: 'US' },
        });
      };
      // Unpaid checkouts do not count towards the quota; paid orders do.
      const first = await order();
      expect(first.status).toBe(201);
      expect((await order()).status).toBe(201);
      await payMock(sf, first.body.paymentUrl);
      const second = await order();
      expect(second.status).toBe(402);
      expect(second.body.detail).toMatch(/cannot accept new orders/);
    } finally {
      await ctx.platform.plan.update({
        where: { id: standard.id },
        data: { maxOrdersPerMonth: null },
      });
    }
  });

  it('only owners subscribe; the intro price covers the first 3 months, then the full price', async () => {
    const { store, auth } = await merchantWithStore(ctx);
    const adminMember = await signup(ctx);
    await ctx.platform.storeMember.create({
      data: { storeId: store.id, userId: adminMember.user.id, role: 'ADMIN' },
    });
    const { standard } = await plans();
    await ctx
      .http()
      .post(`/api/v1/admin/stores/${store.id}/billing/plan`)
      .set('Authorization', `Bearer ${adminMember.token}`)
      .send({ planId: standard.id })
      .expect(403);

    const subscribed = await ctx
      .http()
      .post(`/api/v1/admin/stores/${store.id}/billing/plan`)
      .set(auth)
      .send({ planId: standard.id })
      .expect(200);
    expect(subscribed.body.billing).toMatchObject({
      status: 'ACTIVE',
      action: null,
      introAvailable: false,
      invoices: [{ amount: 9_900 }],
    });
    // Already subscribed: a second click is refused.
    await ctx
      .http()
      .post(`/api/v1/admin/stores/${store.id}/billing/plan`)
      .set(auth)
      .send({ planId: standard.id })
      .expect(400);

    for (let month = 2; month <= 4; month++) {
      await ctx.platform.subscription.update({
        where: { storeId: store.id },
        data: { currentPeriodEnd: new Date(Date.now() - 1000) },
      });
      expect(await ctx.app.get(BillingService).renewDue()).toBeGreaterThanOrEqual(1);
    }
    const billing = await ctx
      .http()
      .get(`/api/v1/admin/stores/${store.id}/billing`)
      .set(auth)
      .expect(200);
    // Newest first: month 4 at the full price, months 1–3 at the intro price.
    expect(billing.body.invoices.map((i: { amount: number }) => i.amount)).toEqual([
      79_900, 9_900, 9_900, 9_900,
    ]);
    expect(new Date(billing.body.currentPeriodEnd).getTime()).toBeGreaterThan(Date.now());
  });

  it('pauses a store whose trial ended unpaid and reopens it the moment it subscribes', async () => {
    const { store, auth } = await merchantWithStore(ctx);
    const { standard } = await plans();
    const sf = storefrontClient(ctx, `${store.subdomain}.localhost`);
    await sf('get', '/shop').expect(200);

    await ctx.platform.subscription.update({
      where: { storeId: store.id },
      data: { trialEndsAt: new Date(Date.now() - 1000) },
    });
    await ctx.app.get(BillingService).renewDue();
    const sub = await ctx.platform.subscription.findUniqueOrThrow({ where: { storeId: store.id } });
    expect(sub.status).toBe('EXPIRED');
    ctx.app.get(StoreResolver).invalidate();
    await sf('get', '/shop').expect(404);

    const blocked = await ctx
      .http()
      .post(`/api/v1/admin/stores/${store.id}/products`)
      .set(auth)
      .send({ title: 'X', variants: [{ price: 100 }] })
      .expect(402);
    expect(blocked.body).toMatchObject({ code: 'billing_required' });
    const detail = await ctx.http().get(`/api/v1/admin/stores/${store.id}`).set(auth).expect(200);
    expect(detail.body).toMatchObject({ billingLocked: true, billingAction: 'subscribe' });
    // Data stays exportable while paused.
    await ctx.http().get(`/api/v1/admin/stores/${store.id}/orders/export`).set(auth).expect(200);

    await ctx
      .http()
      .post(`/api/v1/admin/stores/${store.id}/billing/plan`)
      .set(auth)
      .send({ planId: standard.id })
      .expect(200);
    ctx.app.get(StoreResolver).invalidate();
    await sf('get', '/shop').expect(200);
    await ctx
      .http()
      .post(`/api/v1/admin/stores/${store.id}/products`)
      .set(auth)
      .send({ title: 'X', variants: [{ price: 100 }] })
      .expect(201);
  });

  it('closes a store, lets the owner reopen it, and erases it after the grace period', async () => {
    const { store, auth } = await merchantWithStore(ctx);
    const { standard } = await plans();
    const base = `/api/v1/admin/stores/${store.id}`;
    await ctx
      .http()
      .post(`${base}/billing/plan`)
      .set(auth)
      .send({ planId: standard.id })
      .expect(200);
    const sf = storefrontClient(ctx, `${store.subdomain}.localhost`);

    await ctx.http().post(`${base}/close`).set(auth).send({ confirmSubdomain: 'nope' }).expect(400);
    const closed = await ctx
      .http()
      .post(`${base}/close`)
      .set(auth)
      .send({ confirmSubdomain: store.subdomain })
      .expect(200);
    expect(closed.body.status).toBe('CLOSED');
    const days = (Date.parse(closed.body.deletionScheduledAt) - Date.now()) / 86_400_000;
    expect(Math.round(days)).toBe(30);
    await sf('get', '/shop').expect(404);
    await ctx.http().patch(base).set(auth).send({ name: 'x' }).expect(403);

    await ctx.http().post(`${base}/reopen`).set(auth).expect(200);
    await sf('get', '/shop').expect(200);

    await ctx
      .http()
      .post(`${base}/close`)
      .set(auth)
      .send({ confirmSubdomain: store.subdomain })
      .expect(200);
    await ctx.platform.store.update({
      where: { id: store.id },
      data: { deletionScheduledAt: new Date(Date.now() - 1000) },
    });
    expect(await ctx.app.get(StoreClosureService).purgeDue()).toBe(1);
    expect(await ctx.platform.store.findUnique({ where: { id: store.id } })).toBeNull();
    // Our invoices to the merchant are kept for tax records.
    expect(await ctx.platform.platformInvoice.count({ where: { storeId: store.id } })).toBe(1);
  });

  describe('platform admin', () => {
    it('is restricted to platform roles; support is read-only', async () => {
      const merchant = await merchantWithStore(ctx);
      await ctx.http().get('/api/v1/platform/overview').set(merchant.auth).expect(403);
      await ctx.http().get('/api/v1/platform/overview').set(support).expect(200);
      await ctx
        .http()
        .put('/api/v1/platform/settings')
        .set(support)
        .send({ signupsEnabled: false })
        .expect(403);
      await ctx.http().get('/api/v1/platform/overview').expect(401);
    });

    it('lists stores with usage and reports MRR and plan breakdown', async () => {
      const merchant = await merchantWithStore(ctx);
      const list = await ctx
        .http()
        .get('/api/v1/platform/stores')
        .query({ q: merchant.store.subdomain })
        .set(admin)
        .expect(200);
      expect(list.body.items[0]).toMatchObject({
        id: merchant.store.id,
        ownerEmail: merchant.session.user.email,
        plan: 'Standard',
        usage: { products: 0, staff: 1 },
      });
      const overview = await ctx.http().get('/api/v1/platform/overview').set(admin).expect(200);
      expect(overview.body.stores.total).toBeGreaterThan(0);
      expect(overview.body.mrr).toBeGreaterThanOrEqual(199_900); // the Scale store above
      expect(overview.body.mrrCurrency).toBe('INR');
      expect(overview.body.planBreakdown.map((p: { plan: string }) => p.plan)).toEqual(
        expect.arrayContaining(['Standard']),
      );
    });

    it('suspends a store (storefront down, admin read-only) and reactivates it, with an audit trail', async () => {
      const merchant = await merchantWithStore(ctx);
      const sf = storefrontClient(ctx, `${merchant.store.subdomain}.localhost`);
      await sf('get', '/shop').expect(200);

      await ctx
        .http()
        .post(`/api/v1/platform/stores/${merchant.store.id}/suspend`)
        .set(admin)
        .send({ reason: 'Chargeback fraud investigation' })
        .expect(204);
      await sf('get', '/shop').expect(404);
      await ctx
        .http()
        .patch(`/api/v1/admin/stores/${merchant.store.id}`)
        .set(merchant.auth)
        .send({ name: 'x' })
        .expect(403);
      await ctx
        .http()
        .get(`/api/v1/admin/stores/${merchant.store.id}/billing`)
        .set(merchant.auth)
        .expect(200);

      await ctx
        .http()
        .post(`/api/v1/platform/stores/${merchant.store.id}/reactivate`)
        .set(admin)
        .expect(204);
      await sf('get', '/shop').expect(200);

      const audit = await ctx.http().get('/api/v1/platform/audit-logs').set(admin).expect(200);
      expect(audit.body.items.slice(0, 2).map((e: { action: string }) => e.action)).toEqual([
        'store.reactivated',
        'store.suspended',
      ]);
    });

    it('comps a store onto a plan, manages plans, disables users, and closes sign-ups', async () => {
      const merchant = await merchantWithStore(ctx);
      const { scale } = await plans();
      await ctx
        .http()
        .put(`/api/v1/platform/stores/${merchant.store.id}/plan`)
        .set(admin)
        .send({ planId: scale.id })
        .expect(204);
      const billing = await ctx
        .http()
        .get(`/api/v1/admin/stores/${merchant.store.id}/billing`)
        .set(merchant.auth)
        .expect(200);
      expect(billing.body).toMatchObject({
        plan: { code: 'scale' },
        status: 'ACTIVE',
        provider: 'manual',
        locked: false,
      });

      const created = await ctx
        .http()
        .post('/api/v1/platform/plans')
        .set(admin)
        .send({
          code: 'enterprise',
          name: 'Enterprise',
          priceMonthly: 49900,
          maxProducts: null,
          maxStaff: null,
          maxOrdersPerMonth: null,
          sortOrder: 4,
        })
        .expect(201);
      expect(created.body).toMatchObject({ code: 'enterprise', isDefault: false });
      await ctx
        .http()
        .post('/api/v1/platform/plans')
        .set(admin)
        .send({
          code: 'enterprise',
          name: 'Dup',
          priceMonthly: 1,
          maxProducts: null,
          maxStaff: null,
          maxOrdersPerMonth: null,
        })
        .expect(409);

      await ctx
        .http()
        .post(`/api/v1/platform/users/${merchant.session.user.id}/disable`)
        .set(admin)
        .expect(204);
      await ctx.http().get('/api/v1/auth/me').set(merchant.auth).expect(401);
      await ctx
        .http()
        .post(`/api/v1/platform/users/${merchant.session.user.id}/enable`)
        .set(admin)
        .expect(204);

      await ctx
        .http()
        .put('/api/v1/platform/settings')
        .set(admin)
        .send({ signupsEnabled: false, supportEmail: 'help@example.com' })
        .expect(200);
      const closed = await ctx
        .http()
        .post('/api/v1/auth/signup')
        .send({ name: 'Late', email: uniqueEmail(), password: 'long-enough-password' })
        .expect(403);
      expect(closed.body.detail).toBe('Sign-ups are currently closed.');
      await ctx
        .http()
        .put('/api/v1/platform/settings')
        .set(admin)
        .send({ signupsEnabled: true, supportEmail: 'help@example.com' })
        .expect(200);
    });

    it('keeps the platform audit log append-only even for the platform role', async () => {
      await expect(ctx.platform.platformAuditLog.deleteMany({})).rejects.toThrow(
        /permission denied/,
      );
    });
  });
});
