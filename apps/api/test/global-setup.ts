import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import type { TestProject } from 'vitest/node';

/** Applies migrations to the test database once per test run. */
export default function setup(project: TestProject): void {
  const url = project.config.env.DATABASE_URL_MIGRATE;
  if (!url) {
    throw new Error(
      'Test database is not configured. Run `scripts/dev-db.ps1 init` (writes TEST_DATABASE_URL_* to apps/api/.env).',
    );
  }
  execSync('pnpm exec prisma migrate deploy', {
    cwd: fileURLToPath(new URL('../../../packages/db', import.meta.url)),
    env: { ...process.env, DATABASE_URL_MIGRATE: url },
    stdio: 'pipe',
  });
}
