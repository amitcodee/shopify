import { existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseEnv } from 'node:util';
import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

// Integration tests run against the dedicated test database (written by scripts/dev-db.ps1).
const local = existsSync('.env') ? parseEnv(readFileSync('.env', 'utf8')) : {};
const testDb = {
  DATABASE_URL: local.TEST_DATABASE_URL ?? process.env.TEST_DATABASE_URL ?? '',
  DATABASE_URL_PLATFORM:
    local.TEST_DATABASE_URL_PLATFORM ?? process.env.TEST_DATABASE_URL_PLATFORM ?? '',
  DATABASE_URL_MIGRATE:
    local.TEST_DATABASE_URL_MIGRATE ?? process.env.TEST_DATABASE_URL_MIGRATE ?? '',
};

export default defineConfig({
  // SWC emits decorator metadata, which NestJS dependency injection relies on.
  plugins: [swc.vite({ module: { type: 'es6' } })],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
    env: {
      NODE_ENV: 'test',
      STORAGE_DIR: join(tmpdir(), 'shop-api-test-storage'),
      STOREFRONT_SHARED_SECRET: 'test-storefront-secret-0123456789abcdef',
      APP_ENCRYPTION_KEY: 'test-encryption-key-0123456789abcdef0123',
      ...testDb,
    },
    globalSetup: ['./test/global-setup.ts'],
    // Test files share one database; run them one at a time.
    fileParallelism: false,
    // Booting the Nest app on a cold, busy machine can exceed the 10s default.
    hookTimeout: 30_000,
    testTimeout: 20_000,
  },
});
