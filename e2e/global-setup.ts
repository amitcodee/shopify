import { execSync } from 'node:child_process';

/** Migrates and empties the test database before the E2E run. */
export default function globalSetup(): void {
  execSync('node scripts/reset-test-db.js', { cwd: 'packages/db', stdio: 'inherit' });
}
