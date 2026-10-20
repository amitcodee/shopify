import type { ThrottlerStorage } from '@nestjs/throttler';
import type { PrismaClient } from '@repo/db';

interface ThrottlerStorageRecord {
  totalHits: number;
  timeToExpire: number;
  isBlocked: boolean;
  timeToBlockExpire: number;
}

/**
 * Rate-limit counters in PostgreSQL so limits hold across API instances (the default storage is
 * per-process memory). Fixed windows: one atomic upsert per request counts the hit, rolls the
 * window over when it has ended, and starts a block once the limit is exceeded. Times are
 * computed by the database clock so instances with skewed clocks agree.
 */
export class PostgresThrottlerStorage implements ThrottlerStorage {
  constructor(private readonly db: PrismaClient) {}

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<ThrottlerStorageRecord> {
    const bucket = `${throttlerName}:${key}`.slice(0, 200);
    const ttlSeconds = ttl / 1000;
    const blockSeconds = Math.max(blockDuration, ttl) / 1000;
    const [row] = await this.db.$queryRaw<
      { hits: number; expires_in: number; blocked_for: number | null }[]
    >`
      INSERT INTO "RateLimitBucket" AS b (key, hits, "windowEndsAt", "blockedUntil")
      VALUES (
        ${bucket}, 1, now() + make_interval(secs => ${ttlSeconds}::double precision),
        CASE WHEN 1 > ${limit}::int
             THEN now() + make_interval(secs => ${blockSeconds}::double precision) END
      )
      ON CONFLICT (key) DO UPDATE SET
        hits = CASE WHEN b."windowEndsAt" <= now() THEN 1 ELSE b.hits + 1 END,
        "windowEndsAt" = CASE WHEN b."windowEndsAt" <= now()
                              THEN now() + make_interval(secs => ${ttlSeconds}::double precision)
                              ELSE b."windowEndsAt" END,
        "blockedUntil" = CASE
          WHEN b."blockedUntil" > now() THEN b."blockedUntil"
          WHEN (CASE WHEN b."windowEndsAt" <= now() THEN 1 ELSE b.hits + 1 END) > ${limit}::int
            THEN now() + make_interval(secs => ${blockSeconds}::double precision)
          ELSE NULL END
      RETURNING hits,
        EXTRACT(EPOCH FROM ("windowEndsAt" - now()))::float8 AS expires_in,
        EXTRACT(EPOCH FROM ("blockedUntil" - now()))::float8 AS blocked_for`;
    if (!row) throw new Error('Rate-limit upsert returned no row');
    const blockedFor = row.blocked_for ?? 0;
    return {
      totalHits: row.hits,
      timeToExpire: Math.max(0, Math.ceil(row.expires_in)),
      isBlocked: blockedFor > 0,
      timeToBlockExpire: blockedFor > 0 ? Math.ceil(blockedFor) : 0,
    };
  }
}
