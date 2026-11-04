import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  createStore,
  createTestApp,
  merchantWithStore,
  resetDatabase,
  signup,
  type TestContext,
} from './utils.js';

describe('Stores (merchant onboarding)', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp();
    await resetDatabase(ctx.owner);
  });

  afterAll(async () => {
    await ctx?.close();
  });

  it('creates a store with the creator as OWNER and records an audit entry', async () => {
    const session = await signup(ctx);
    const store = await createStore(ctx, session.token, {
      subdomain: 'Acme-Shop',
      name: 'Acme',
      payments: false,
    });

    expect(store).toMatchObject({ name: 'Acme', subdomain: 'acme-shop', role: 'OWNER' });

    const detail = await ctx
      .http()
      .get(`/api/v1/admin/stores/${store.id}`)
      .set('Authorization', `Bearer ${session.token}`)
      .expect(200);
    expect(detail.body.permissions).toContain('billing:manage');
    expect(detail.body.currency).toBe('USD');

    const audit = await ctx
      .http()
      .get(`/api/v1/admin/stores/${store.id}/audit-logs`)
      .set('Authorization', `Bearer ${session.token}`)
      .expect(200);
    expect(audit.body.items[0]).toMatchObject({
      action: 'store.created',
      actor: { id: session.user.id },
    });
  });

  it('rejects reserved and duplicate subdomains', async () => {
    const session = await signup(ctx);
    const auth = { Authorization: `Bearer ${session.token}` };
    const body = { name: 'X', contactEmail: 'x@example.com' };

    await ctx
      .http()
      .post('/api/v1/admin/stores')
      .set(auth)
      .send({ ...body, subdomain: 'admin' })
      .expect(400);

    await createStore(ctx, session.token, { subdomain: 'taken-name' });
    const dup = await ctx
      .http()
      .post('/api/v1/admin/stores')
      .set(auth)
      .send({ ...body, subdomain: 'taken-name' })
      .expect(409);
    expect(dup.body.detail).toMatch(/already taken/);
  });

  it('lists only the stores the user belongs to', async () => {
    const a = await merchantWithStore(ctx);
    await merchantWithStore(ctx);
    const second = await createStore(ctx, a.token);

    const res = await ctx.http().get('/api/v1/admin/stores').set(a.auth).expect(200);
    expect(res.body.map((s: { id: string }) => s.id)).toEqual([a.store.id, second.id]);
  });

  it('gives the store picker its details, limited by what each member may see', async () => {
    const owner = await merchantWithStore(ctx);
    await merchantWithStore(ctx);

    const mine = await ctx.http().get('/api/v1/admin/stores/overview').set(owner.auth).expect(200);
    expect(mine.body).toHaveLength(1);
    expect(mine.body[0]).toMatchObject({
      id: owner.store.id,
      role: 'OWNER',
      passwordProtected: false,
      photos: [],
      metrics: { products: 0, customers: 0, orders: 0, lastOrderAt: null, sales30d: 0 },
      team: { count: 1, members: [{ role: 'OWNER' }] },
    });
    expect(Date.parse(mine.body[0].createdAt)).not.toBeNaN();
    expect(mine.body[0].theme.settings.brandColor).toMatch(/^#/);
    expect(mine.body[0].plan.name).toEqual(expect.any(String));

    // A staff member with no extra permissions sees the store, but none of its numbers or people.
    const staff = await signup(ctx);
    await ctx.owner.storeMember.create({
      data: { storeId: owner.store.id, userId: staff.user.id, role: 'STAFF', permissions: [] },
    });
    const limited = await ctx
      .http()
      .get('/api/v1/admin/stores/overview')
      .set('Authorization', `Bearer ${staff.token}`)
      .expect(200);
    expect(limited.body[0]).toMatchObject({
      role: 'STAFF',
      metrics: { products: null, customers: null, orders: null, lastOrderAt: null, sales30d: null },
      team: null,
      plan: null,
    });
  });

  it('updates settings, audits the diff, and ignores no-op changes', async () => {
    const { store, auth } = await merchantWithStore(ctx);

    const res = await ctx
      .http()
      .patch(`/api/v1/admin/stores/${store.id}`)
      .set(auth)
      .send({ name: 'Renamed', currency: 'EUR' })
      .expect(200);
    expect(res.body).toMatchObject({ name: 'Renamed', currency: 'EUR' });

    await ctx
      .http()
      .patch(`/api/v1/admin/stores/${store.id}`)
      .set(auth)
      .send({ name: 'Renamed' })
      .expect(200);

    const audit = await ctx
      .http()
      .get(`/api/v1/admin/stores/${store.id}/audit-logs`)
      .set(auth)
      .expect(200);
    const updates = audit.body.items.filter(
      (i: { action: string }) => i.action === 'store.updated',
    );
    expect(updates).toHaveLength(1);
    expect(updates[0].data.changes.currency).toEqual({ from: 'USD', to: 'EUR' });
  });
});
