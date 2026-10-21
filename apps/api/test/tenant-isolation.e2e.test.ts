import { randomUUID } from 'node:crypto';
import { createPrismaClient, type PrismaClient, withTenant } from '@repo/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, merchantWithStore, resetDatabase, type TestContext } from './utils.js';

describe('Tenant isolation', () => {
  let ctx: TestContext;
  let appDb: PrismaClient;

  beforeAll(async () => {
    ctx = await createTestApp();
    await resetDatabase(ctx.owner);
    appDb = createPrismaClient(process.env.DATABASE_URL ?? '');
  });

  afterAll(async () => {
    await appDb?.$disconnect();
    await ctx?.close();
  });

  describe('API layer', () => {
    it("returns 404 for another merchant's store on every store-scoped route", async () => {
      const alice = await merchantWithStore(ctx);
      const bob = await merchantWithStore(ctx);
      const base = `/api/v1/admin/stores/${alice.store.id}`;

      await ctx.http().get(base).set(bob.auth).expect(404);
      await ctx.http().patch(base).set(bob.auth).send({ name: 'pwned' }).expect(404);
      await ctx.http().get(`${base}/audit-logs`).set(bob.auth).expect(404);

      const store = await ctx.platform.store.findUniqueOrThrow({ where: { id: alice.store.id } });
      expect(store.name).not.toBe('pwned');
    });

    it('returns 404 for unknown and malformed store ids', async () => {
      const { auth } = await merchantWithStore(ctx);
      await ctx.http().get(`/api/v1/admin/stores/${randomUUID()}`).set(auth).expect(404);
      await ctx.http().get('/api/v1/admin/stores/not-a-uuid').set(auth).expect(404);
    });

    it('enforces role permissions for STAFF members', async () => {
      const owner = await merchantWithStore(ctx);
      const staff = await merchantWithStore(ctx);
      await ctx.platform.storeMember.create({
        data: {
          storeId: owner.store.id,
          userId: staff.session.user.id,
          role: 'STAFF',
          permissions: ['settings:read'],
        },
      });
      const base = `/api/v1/admin/stores/${owner.store.id}`;

      await ctx.http().get(base).set(staff.auth).expect(200);
      await ctx.http().get(`${base}/audit-logs`).set(staff.auth).expect(200);
      const denied = await ctx.http().patch(base).set(staff.auth).send({ name: 'x' }).expect(403);
      expect(denied.body.detail).toMatch(/settings:write/);
    });

    it('blocks suspended stores except for reading store details', async () => {
      const { store, auth } = await merchantWithStore(ctx);
      await ctx.platform.store.update({ where: { id: store.id }, data: { status: 'SUSPENDED' } });
      const base = `/api/v1/admin/stores/${store.id}`;

      const detail = await ctx.http().get(base).set(auth).expect(200);
      expect(detail.body.status).toBe('SUSPENDED');
      await ctx.http().patch(base).set(auth).send({ name: 'x' }).expect(403);
    });
  });

  describe('Database layer (row-level security)', () => {
    it('only exposes tenant rows inside withTenant for the matching store', async () => {
      const a = await merchantWithStore(ctx);
      const b = await merchantWithStore(ctx);

      const outside = await appDb.auditLog.findMany();
      expect(outside).toHaveLength(0);

      const seenByA = await withTenant(appDb, a.store.id, (tx) => tx.auditLog.findMany());
      expect(seenByA.length).toBeGreaterThan(0);
      expect(seenByA.every((row) => row.storeId === a.store.id)).toBe(true);

      // Even an explicit filter for store B returns nothing under store A's context.
      const leaked = await withTenant(appDb, a.store.id, (tx) =>
        tx.auditLog.findMany({ where: { storeId: b.store.id } }),
      );
      expect(leaked).toHaveLength(0);
    });

    it("rejects writing a row into another store's tenant", async () => {
      const a = await merchantWithStore(ctx);
      const b = await merchantWithStore(ctx);
      await expect(
        withTenant(appDb, a.store.id, (tx) =>
          tx.auditLog.create({
            data: { storeId: b.store.id, action: 'x', entityType: 'x' },
          }),
        ),
      ).rejects.toThrow(/row-level security/);
    });

    it('keeps audit logs append-only for the application role', async () => {
      const a = await merchantWithStore(ctx);
      await expect(
        withTenant(appDb, a.store.id, (tx) =>
          tx.auditLog.deleteMany({ where: { storeId: a.store.id } }),
        ),
      ).rejects.toThrow(/permission denied/);
    });

    it('has RLS enabled and forced on every table with a storeId column', async () => {
      const rows = await ctx.platform.$queryRaw<
        { table: string; enabled: boolean; forced: boolean }[]
      >`
        SELECT c.relname AS "table", c.relrowsecurity AS enabled, c.relforcerowsecurity AS forced
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
        JOIN pg_attribute a ON a.attrelid = c.oid AND a.attname = 'storeId' AND NOT a.attisdropped
        WHERE c.relkind = 'r'`;
      const globalTables = [
        'StoreMember',
        'StoreInvitation',
        'Domain',
        'Subscription',
        'PlatformInvoice',
        // Looked up by token hash before the store is known; the guard checks its store.
        'ApiToken',
      ];
      const tenantTables = rows.filter((r) => !globalTables.includes(r.table));
      expect(tenantTables.length).toBeGreaterThan(0);
      for (const row of tenantTables) {
        expect(row, row.table).toMatchObject({ enabled: true, forced: true });
      }
    });
  });
});
