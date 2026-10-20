import type { Prisma, PrismaClient } from './generated/prisma/client.js';
import { isUuid } from './uuid.js';

export type TenantTx = Prisma.TransactionClient;

/** Scopes an already-open transaction to `storeId` (e.g. right after creating the store). */
export async function setTenant(tx: TenantTx, storeId: string): Promise<void> {
  if (!isUuid(storeId)) throw new Error('setTenant requires a valid store id');
  await tx.$queryRaw`SELECT set_config('app.store_id', ${storeId}, true)`;
}

/**
 * Runs `fn` in a transaction where PostgreSQL row-level security is scoped to `storeId`.
 * `app.store_id` is transaction-local, so it never leaks to other requests sharing the pooled
 * connection. Queries on tenant tables outside this helper see no rows (fail closed).
 */
export async function withTenant<T>(
  client: PrismaClient,
  storeId: string,
  fn: (tx: TenantTx) => Promise<T>,
  options: { timeout?: number } = {},
): Promise<T> {
  return client.$transaction(
    async (tx) => {
      await setTenant(tx, storeId);
      return fn(tx);
    },
    { timeout: options.timeout ?? 15_000, maxWait: 10_000 },
  );
}
