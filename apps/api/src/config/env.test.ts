import { describe, expect, it } from 'vitest';
import { loadEnv } from './env.js';

const required = {
  DATABASE_URL: 'postgresql://app:pw@localhost:5432/db',
  DATABASE_URL_PLATFORM: 'postgresql://platform:pw@localhost:5432/db',
  STOREFRONT_SHARED_SECRET: 'x'.repeat(32),
  APP_ENCRYPTION_KEY: 'k'.repeat(32),
};

describe('loadEnv', () => {
  it('applies safe local defaults', () => {
    const env = loadEnv(required);
    expect(env.API_PORT).toBe(4000);
    expect(env.NODE_ENV).toBe('development');
    expect(env.CORS_ORIGINS).toEqual(['http://localhost:3100', 'http://localhost:3200']);
    expect(env.SESSION_TTL_DAYS).toBe(30);
  });

  it('parses a comma-separated origin list', () => {
    const env = loadEnv({
      ...required,
      CORS_ORIGINS: 'https://admin.example.com, https://shop.example.com',
    });
    expect(env.CORS_ORIGINS).toEqual(['https://admin.example.com', 'https://shop.example.com']);
  });

  it('fails fast on invalid or missing values', () => {
    expect(() => loadEnv({ ...required, API_PORT: 'not-a-port' })).toThrow(/Invalid environment/);
    expect(() => loadEnv({ ...required, CORS_ORIGINS: 'javascript:alert(1)' })).toThrow(
      /Invalid environment/,
    );
    expect(() => loadEnv({})).toThrow(/DATABASE_URL/);
  });

  it('rejects template placeholders in secrets', () => {
    expect(() =>
      loadEnv({ ...required, APP_ENCRYPTION_KEY: 'CHANGE_ME_TO_A_LONG_RANDOM_VALUE_32+' }),
    ).toThrow(/APP_ENCRYPTION_KEY still contains a CHANGE_ME placeholder/);
    expect(() =>
      loadEnv({ ...required, DATABASE_URL: 'postgresql://app:CHANGE_ME@db:5432/shop' }),
    ).toThrow(/CHANGE_ME/);
  });

  it('requires a real email transport in production', () => {
    expect(() => loadEnv({ ...required, EMAIL_TRANSPORT: 'postmark' })).toThrow(
      /POSTMARK_SERVER_TOKEN/,
    );
    expect(() => loadEnv({ ...required, NODE_ENV: 'production' })).toThrow(
      /mailbox cannot deliver email in production/,
    );
  });
});
