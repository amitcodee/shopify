import { describe, expect, it } from 'vitest';
import { healthResponseSchema } from './health.js';

describe('healthResponseSchema', () => {
  const valid = {
    status: 'ok',
    service: 'api',
    version: '0.0.0',
    uptimeSeconds: 1.5,
    timestamp: new Date().toISOString(),
  };

  it('accepts a valid health payload', () => {
    expect(healthResponseSchema.parse(valid)).toEqual(valid);
  });

  it('rejects a non-ok status and a malformed timestamp', () => {
    expect(healthResponseSchema.safeParse({ ...valid, status: 'down' }).success).toBe(false);
    expect(healthResponseSchema.safeParse({ ...valid, timestamp: 'yesterday' }).success).toBe(
      false,
    );
  });
});
