import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/prisma/client.js';

export * from './generated/prisma/client.js';
export { setTenant, withTenant, type TenantTx } from './tenant.js';
export { isUuid } from './uuid.js';

/** Creates a Prisma client over node-postgres for the given connection string. */
export function createPrismaClient(connectionString: string): PrismaClient {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}
