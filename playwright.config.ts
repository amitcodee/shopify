import { existsSync, readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { defineConfig, devices } from '@playwright/test';

// E2E runs production builds on dedicated ports against the *test* database.
const apiEnvFile = 'apps/api/.env';
const local = existsSync(apiEnvFile) ? parseEnv(readFileSync(apiEnvFile, 'utf8')) : {};
const db = {
  DATABASE_URL: local.TEST_DATABASE_URL ?? '',
  DATABASE_URL_PLATFORM: local.TEST_DATABASE_URL_PLATFORM ?? '',
  DATABASE_URL_MIGRATE: local.TEST_DATABASE_URL_MIGRATE ?? '',
};

export const PORTS = { api: 4100, admin: 3110, storefront: 3210 } as const;
const apiUrl = `http://localhost:${PORTS.api}`;
const storefrontSecret = 'e2e-storefront-secret-0123456789abcdef';
/** Shared with e2e/helpers.ts, which signs email verification links like the API does. */
export const E2E_ENCRYPTION_KEY = 'e2e-encryption-key-0123456789abcdef0123';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [['list']],
  globalSetup: './e2e/global-setup.ts',
  use: {
    baseURL: `http://localhost:${PORTS.admin}`,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'node dist/main.js',
      cwd: 'apps/api',
      url: `${apiUrl}/api/v1/health/ready`,
      reuseExistingServer: false,
      timeout: 180_000,
      env: {
        ...db,
        NODE_ENV: 'test',
        API_PORT: String(PORTS.api),
        CORS_ORIGINS: `http://localhost:${PORTS.admin}`,
        ADMIN_PUBLIC_URL: `http://localhost:${PORTS.admin}`,
        STOREFRONT_SHARED_SECRET: storefrontSecret,
        APP_ENCRYPTION_KEY: E2E_ENCRYPTION_KEY,
        STOREFRONT_ROOT_DOMAIN: `localhost:${PORTS.storefront}`,
        PAYMENT_PROVIDERS: 'mock',
        PUBLIC_API_URL: apiUrl,
      },
    },
    {
      command: `pnpm exec next start --port ${PORTS.admin}`,
      cwd: 'apps/admin',
      url: `http://localhost:${PORTS.admin}/login`,
      reuseExistingServer: false,
      timeout: 180_000,
      env: {
        API_URL: apiUrl,
        STOREFRONT_PUBLIC_URL: `http://{subdomain}.localhost:${PORTS.storefront}`,
      },
    },
    {
      command: `pnpm exec next start --port ${PORTS.storefront}`,
      cwd: 'apps/storefront',
      url: `http://localhost:${PORTS.storefront}`,
      reuseExistingServer: false,
      timeout: 180_000,
      env: {
        API_URL: apiUrl,
        STOREFRONT_SHARED_SECRET: storefrontSecret,
      },
    },
  ],
});
