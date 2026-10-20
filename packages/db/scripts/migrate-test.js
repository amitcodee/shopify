// Applies all migrations to the test database (TEST_DATABASE_URL_MIGRATE).
import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';

if (existsSync('.env')) process.loadEnvFile('.env');
const url = process.env.TEST_DATABASE_URL_MIGRATE;
if (!url) {
  console.error('TEST_DATABASE_URL_MIGRATE is not set (run scripts/dev-db.ps1 init)');
  process.exit(1);
}

execSync('pnpm exec prisma migrate deploy', {
  stdio: 'inherit',
  env: { ...process.env, DATABASE_URL_MIGRATE: url },
});
