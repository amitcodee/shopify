import { describe, expect, it } from 'vitest';
import type { PrismaClient } from '@repo/db';
import { loadEnv } from '../config/env.js';
import { HealthController } from './health.controller.js';

const env = loadEnv({
  APP_VERSION: '1.2.3',
  DATABASE_URL: 'postgresql://a:b@localhost/db',
  DATABASE_URL_PLATFORM: 'postgresql://a:b@localhost/db',
  STOREFRONT_SHARED_SECRET: 'x'.repeat(32),
  APP_ENCRYPTION_KEY: 'k'.repeat(32),
});

describe('HealthController', () => {
  it('reports ok with the configured version', () => {
    const controller = new HealthController(env, {} as PrismaClient);

    const result = controller.check();

    expect(result.status).toBe('ok');
    expect(result.version).toBe('1.2.3');
    expect(result.uptimeSeconds).toBeGreaterThanOrEqual(0);
  });

  it('reports not ready when the database query fails', async () => {
    const db = { $queryRaw: () => Promise.reject(new Error('down')) } as unknown as PrismaClient;
    await expect(new HealthController(env, db).ready()).rejects.toThrow(/Database unavailable/);
  });
});
