import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/prisma/client.js';

export * from './generated/prisma/client.js';
export { setTenant, withTenant, type TenantTx } from './tenant.js';
export { isUuid } from './uuid.js';

/**
 * Creates a Prisma client over node-postgres. Every session runs in UTC: Prisma reads and writes `timestamp` columns as UTC, so raw SQL using
 * `now()` must agree with it regardless of the database server's own TimeZone setting.
 */
export function createPrismaClient(connectionString: string): PrismaClient {
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString, options: '-c TimeZone=UTC' }),
  });
}
