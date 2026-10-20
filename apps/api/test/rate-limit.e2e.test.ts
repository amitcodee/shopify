import { randomUUID } from 'node:crypto';
import { createPrismaClient, type PrismaClient } from '@repo/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PostgresThrottlerStorage } from '../src/common/postgres-throttler.storage.js';
import { MaintenanceService } from '../src/jobs/maintenance.service.js';

describe('Shared rate limiting (PostgreSQL throttler storage)', () => {
  let a: PrismaClient;
  let b: PrismaClient;
  /** Two storages on separate connection pools stand in for two API instances. */
  let instanceA: PostgresThrottlerStorage;
  let instanceB: PostgresThrottlerStorage;

  beforeAll(() => {
    a = createPrismaClient(process.env.DATABASE_URL_PLATFORM ?? '');
    b = createPrismaClient(process.env.DATABASE_URL_PLATFORM ?? '');
    instanceA = new PostgresThrottlerStorage(a);
    instanceB = new PostgresThrottlerStorage(b);
  });

  afterAll(async () => {
    await Promise.all([a?.$disconnect(), b?.$disconnect()]);
  });

  it('counts hits across instances and blocks once the limit is exceeded', async () => {
    const key = randomUUID();
    const hit = (s: PostgresThrottlerStorage) => s.increment(key, 60_000, 3, 120_000, 'default');

    expect(await hit(instanceA)).toMatchObject({ totalHits: 1, isBlocked: false });
    expect(await hit(instanceB)).toMatchObject({ totalHits: 2, isBlocked: false });
    const third = await hit(instanceA);
    expect(third).toMatchObject({ totalHits: 3, isBlocked: false, timeToBlockExpire: 0 });
    expect(third.timeToExpire).toBeGreaterThan(55);
    expect(third.timeToExpire).toBeLessThanOrEqual(60);

    const blocked = await hit(instanceB);
    expect(blocked).toMatchObject({ totalHits: 4, isBlocked: true });
    expect(blocked.timeToBlockExpire).toBeGreaterThan(115);
    expect((await hit(instanceA)).isBlocked).toBe(true);
  });

  it('is atomic under concurrent requests', async () => {
    const key = randomUUID();
    const results = await Promise.all(
      Array.from({ length: 20 }, (_, i) =>
        (i % 2 ? instanceA : instanceB).increment(key, 60_000, 10, 60_000, 'default'),
      ),
    );
    expect(results.map((r) => r.totalHits).sort((x, y) => x - y)).toEqual(
      Array.from({ length: 20 }, (_, i) => i + 1),
    );
    expect(results.filter((r) => r.isBlocked)).toHaveLength(10);
  });

  it('starts a new window when the previous one ends, and keys per throttler', async () => {
    const key = randomUUID();
    await instanceA.increment(key, 300, 1, 300, 'default');
    expect((await instanceA.increment(key, 300, 1, 300, 'default')).isBlocked).toBe(true);
    // Another named throttler on the same tracker has its own counter.
    expect((await instanceA.increment(key, 300, 1, 300, 'burst')).totalHits).toBe(1);

    await new Promise((resolve) => setTimeout(resolve, 450));
    expect(await instanceB.increment(key, 300, 1, 300, 'default')).toMatchObject({
      totalHits: 1,
      isBlocked: false,
    });
  });

  it('maintenance removes finished windows but keeps active blocks', async () => {
    const finished = randomUUID();
    const blocking = randomUUID();
    await instanceA.increment(finished, 1, 5, 1, 'default');
    await instanceA.increment(blocking, 1, 0, 3_600_000, 'default');
    await new Promise((resolve) => setTimeout(resolve, 20));

    await new MaintenanceService(a).cleanup();
    const keys = (await a.rateLimitBucket.findMany({ select: { key: true } })).map((r) => r.key);
    expect(keys).not.toContain(`default:${finished}`);
    expect(keys).toContain(`default:${blocking}`);
  });
});
