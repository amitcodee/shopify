import { Prisma, type Location, type TenantTx } from '@repo/db';

/**
 * Stock per location. ProductVariant.inventoryQuantity is the total over locations; every
 * change goes through these helpers in the same transaction as the total, so the two never
 * drift (an e2e test checks the invariant).
 */

/** The store's default location, created on first use ("Main location"). */
export async function defaultLocation(tx: TenantTx, storeId: string): Promise<Location> {
  const existing = await tx.location.findFirst({ where: { storeId, isDefault: true } });
  if (existing) return existing;
  try {
    return await tx.location.create({
      data: { storeId, name: 'Main location', isDefault: true, priority: 0 },
    });
  } catch (error) {
    // A concurrent request created it first (one default per store, unique index).
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return tx.location.findFirstOrThrow({ where: { storeId, isDefault: true } });
    }
    throw error;
  }
}

/** Adds `delta` (may be negative) to one variant's stock at one location. */
export async function changeLevel(
  tx: TenantTx,
  storeId: string,
  variantId: string,
  locationId: string,
  delta: number,
): Promise<number> {
  const level = await tx.inventoryLevel.upsert({
    where: { variantId_locationId: { variantId, locationId } },
    create: { storeId, variantId, locationId, available: delta },
    update: { available: { increment: delta } },
  });
  return level.available;
}

/**
 * Takes `quantity` of a variant from active locations in priority order (default first among
 * equals). Anything not on hand (a backorder) is taken from the default location, which may
 * go negative. Call after the variant's total was decremented (that row lock serializes
 * concurrent sales of the variant). Returns the location that supplied the most units.
 */
export async function allocate(
  tx: TenantTx,
  storeId: string,
  variantId: string,
  quantity: number,
): Promise<string> {
  const levels = await tx.$queryRaw<{ locationId: string; available: number }[]>`
    SELECT l."locationId", l.available
    FROM "InventoryLevel" l
    JOIN "Location" loc ON loc.id = l."locationId"
    WHERE l."variantId" = ${variantId}::uuid AND l."storeId" = ${storeId}::uuid AND loc.active
    ORDER BY loc.priority, loc."isDefault" DESC, loc."createdAt"
    FOR UPDATE OF l`;
  let remaining = quantity;
  let primary: { locationId: string; taken: number } | null = null;
  for (const level of levels) {
    if (remaining === 0) break;
    const take = Math.min(remaining, Math.max(0, level.available));
    if (take === 0) continue;
    await changeLevel(tx, storeId, variantId, level.locationId, -take);
    remaining -= take;
    if (!primary || take > primary.taken) primary = { locationId: level.locationId, taken: take };
  }
  if (remaining > 0) {
    const fallback = await defaultLocation(tx, storeId);
    await changeLevel(tx, storeId, variantId, fallback.id, -remaining);
    if (!primary || remaining > primary.taken)
      primary = { locationId: fallback.id, taken: remaining };
  }
  return primary?.locationId ?? (await defaultLocation(tx, storeId)).id;
}
