import { healthResponseSchema } from '@repo/contracts';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, type TestContext } from './utils.js';

describe('API over HTTP', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  afterAll(async () => {
    await ctx?.close();
  });

  it('GET /api/v1/health returns a contract-valid payload with security headers', async () => {
    const res = await ctx.http().get('/api/v1/health').expect(200);

    expect(healthResponseSchema.parse(res.body).service).toBe('api');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('GET /api/v1/health/ready reports the database as up', async () => {
    const res = await ctx.http().get('/api/v1/health/ready').expect(200);
    expect(res.body).toEqual({ status: 'ok', database: 'up' });
  });

  it('allows configured CORS origins and ignores others', async () => {
    const allowed = await ctx.http().get('/api/v1/health').set('Origin', 'http://localhost:3100');
    expect(allowed.headers['access-control-allow-origin']).toBe('http://localhost:3100');

    const denied = await ctx.http().get('/api/v1/health').set('Origin', 'https://evil.example');
    expect(denied.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('returns problem+json for unknown routes', async () => {
    const res = await ctx.http().get('/api/v1/does-not-exist').expect(404);
    expect(res.headers['content-type']).toMatch(/application\/problem\+json/);
  });
});
