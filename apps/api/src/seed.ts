/**
 * Development seed: a platform super-admin and a demo merchant with a store.
 * Idempotent. Refuses to run in production. Run with `pnpm --filter @repo/api seed`.
 */
import { existsSync } from 'node:fs';
import { createPrismaClient, setTenant } from '@repo/db';
import { PasswordService } from './auth/password.service.js';
import { PlansService } from './platform/plans.service.js';
import { seedCatalog } from './seed-catalog.js';
import { seedMerchandising } from './seed-merchandising.js';

if (existsSync('.env')) process.loadEnvFile('.env');
if (process.env.NODE_ENV === 'production') throw new Error('Refusing to seed in production.');

const db = createPrismaClient(process.env.DATABASE_URL_PLATFORM ?? '');
const passwords = new PasswordService();

const ADMIN = {
  email: 'admin@example.com',
  name: 'Platform Admin',
  password: 'admin-password-123',
};
const MERCHANT = {
  email: 'merchant@example.com',
  name: 'Demo Merchant',
  password: 'merchant-password-123',
};

async function upsertUser(input: typeof ADMIN, platformRole: 'NONE' | 'SUPER_ADMIN') {
  return db.user.upsert({
    where: { email: input.email },
    update: { platformRole },
    create: {
      email: input.email,
      name: input.name,
      platformRole,
      passwordHash: await passwords.hash(input.password),
      emailVerifiedAt: new Date(),
    },
  });
}

async function main(): Promise<void> {
  await upsertUser(ADMIN, 'SUPER_ADMIN');
  const merchantUser = await upsertUser(MERCHANT, 'NONE');

  const merchant =
    (await db.merchant.findFirst({ where: { ownerUserId: merchantUser.id } })) ??
    (await db.merchant.create({
      data: { name: 'Demo Merchant Inc.', ownerUserId: merchantUser.id },
    }));

  let store = await db.store.findUnique({ where: { subdomain: 'demo' } });
  if (!store) {
    store = await db.$transaction(async (tx) => {
      const created = await tx.store.create({
        data: {
          merchantId: merchant.id,
          name: 'Demo Outfitters',
          subdomain: 'demo',
          contactEmail: MERCHANT.email,
          members: { create: { userId: merchantUser.id, role: 'OWNER' } },
        },
      });
      await setTenant(tx, created.id);
      await tx.auditLog.create({
        data: {
          storeId: created.id,
          actorUserId: merchantUser.id,
          action: 'store.created',
          entityType: 'store',
          entityId: created.id,
          data: { seeded: true },
        },
      });
      return created;
    });
  }

  await new PlansService(db).subscriptionFor(store.id);
  await seedCatalog(db, store.id);
  await seedMerchandising(db, store.id);
  // Sandbox payouts account so the demo store can take (simulated) payments right away.
  const gateways = process.env.PAYMENT_PROVIDERS ?? process.env.PAYMENT_PROVIDER ?? 'mock';
  if (
    gateways
      .split(',')
      .map((g) => g.trim())
      .includes('mock')
  ) {
    await db.paymentAccount.upsert({
      where: { storeId: store.id },
      update: {},
      create: {
        storeId: store.id,
        provider: 'mock',
        accountId: 'acct_mock_demo',
        status: 'ACTIVE',
        chargesEnabled: true,
        payoutsEnabled: true,
        detailsSubmitted: true,
        country: 'US',
      },
    });
  }

  console.log('Seed complete:');
  console.log(`  super-admin  ${ADMIN.email} / ${ADMIN.password}`);
  console.log(`  merchant     ${MERCHANT.email} / ${MERCHANT.password}  (store "demo")`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => void db.$disconnect());
