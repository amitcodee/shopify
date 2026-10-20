// Migrates the test database and empties every application table (keeps migration history).
// Used by the Playwright global setup. Refuses to touch anything but TEST_DATABASE_URL_MIGRATE.
import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createPrismaClient } from '../dist/index.js';

if (existsSync('.env')) process.loadEnvFile('.env');
const url = process.env.TEST_DATABASE_URL_MIGRATE;
if (!url) {
  console.error('TEST_DATABASE_URL_MIGRATE is not set (run scripts/dev-db.ps1 init)');
  process.exit(1);
}

execSync('pnpm exec prisma migrate deploy', {
  stdio: 'pipe',
  env: { ...process.env, DATABASE_URL_MIGRATE: url },
});

const owner = createPrismaClient(url);
try {
  const tables = await owner.$queryRaw`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  if (tables.length > 0) {
    const list = tables.map((t) => `"public"."${t.tablename}"`).join(', ');
    await owner.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
  }
} finally {
  await owner.$disconnect();
}
