import { BadRequestException } from '@nestjs/common';
import type { TenantTx } from '@repo/db';

/**
 * Bundles (combos). A bundle variant holds no stock of its own: it is made of component
 * variants (BundleComponent) and selling one takes stock from each component. So that the
 * storefront, cart and checkout can treat a bundle like any other variant, its stock fields are
 * kept derived from the components here, in the same transaction as every component change:
 *
 * - trackInventory: some component is tracked (a bundle without components counts as tracked
 *   with no stock, so it cannot be sold);
 * - allowBackorder: every tracked component allows backorders;
 * - inventoryQuantity: how many complete bundles the components make (ignoring components that
 *   may be backordered, unless all of them may).
 *
 * Bundle variants never have InventoryLevel rows.
 */

interface ComponentRow {
  bundleVariantId: string;
  quantity: number;
  inventoryQuantity: number;
  trackInventory: boolean;
  allowBackorder: boolean;
}

export function bundleStock(components: Omit<ComponentRow, 'bundleVariantId'>[]): {
  trackInventory: boolean;
  allowBackorder: boolean;
  inventoryQuantity: number;
} {
  if (components.length === 0) {
    return { trackInventory: true, allowBackorder: false, inventoryQuantity: 0 };
  }
  const tracked = components.filter((c) => c.trackInventory);
  if (tracked.length === 0) {
    return { trackInventory: false, allowBackorder: false, inventoryQuantity: 0 };
  }
  const limiting = tracked.filter((c) => !c.allowBackorder);
  const allowBackorder = limiting.length === 0;
  const counted = allowBackorder ? tracked : limiting;
  const inventoryQuantity = Math.min(
    ...counted.map((c) =>
      Math.floor(
        (allowBackorder ? c.inventoryQuantity : Math.max(0, c.inventoryQuantity)) / c.quantity,
      ),
    ),
  );
  return { trackInventory: true, allowBackorder, inventoryQuantity };
}

/** Recomputes the stock fields of the given bundle variants (in id order, to keep lock order). */
export async function refreshBundleVariants(
  tx: TenantTx,
  storeId: string,
  bundleVariantIds: Iterable<string>,
): Promise<void> {
  const ids = [...new Set(bundleVariantIds)].sort();
  if (ids.length === 0) return;
  const rows = await tx.$queryRaw<ComponentRow[]>`
    SELECT c."bundleVariantId", c.quantity, v."inventoryQuantity", v."trackInventory", v."allowBackorder"
    FROM "BundleComponent" c
    JOIN "ProductVariant" v ON v.id = c."componentVariantId"
    WHERE c."storeId" = ${storeId}::uuid AND c."bundleVariantId" = ANY(${ids}::uuid[])`;
  const byBundle = new Map<string, ComponentRow[]>();
  for (const row of rows) {
    byBundle.set(row.bundleVariantId, [...(byBundle.get(row.bundleVariantId) ?? []), row]);
  }
  for (const id of ids) {
    const stock = bundleStock(byBundle.get(id) ?? []);
    await tx.$executeRaw`
      UPDATE "ProductVariant"
      SET "trackInventory" = ${stock.trackInventory}, "allowBackorder" = ${stock.allowBackorder},
          "inventoryQuantity" = ${stock.inventoryQuantity}, "updatedAt" = now()
      WHERE id = ${id}::uuid AND "storeId" = ${storeId}::uuid
        AND ("trackInventory", "allowBackorder", "inventoryQuantity")
          IS DISTINCT FROM (${stock.trackInventory}, ${stock.allowBackorder}, ${stock.inventoryQuantity})`;
  }
}

/** Bundle variants that contain any of the given variants. */
export async function bundlesContaining(
  tx: TenantTx,
  storeId: string,
  componentVariantIds: Iterable<string>,
): Promise<string[]> {
  const ids = [...new Set(componentVariantIds)];
  if (ids.length === 0) return [];
  const rows = await tx.bundleComponent.findMany({
    where: { storeId, componentVariantId: { in: ids } },
    select: { bundleVariantId: true },
    distinct: ['bundleVariantId'],
  });
  return rows.map((r) => r.bundleVariantId);
}

/** Call after the stock or stock settings of these (component) variants changed. */
export async function refreshBundlesContaining(
  tx: TenantTx,
  storeId: string,
  componentVariantIds: Iterable<string>,
): Promise<void> {
  await refreshBundleVariants(
    tx,
    storeId,
    await bundlesContaining(tx, storeId, componentVariantIds),
  );
}

/**
 * Replaces a bundle variant's components. Components must be variants of other, non-bundle,
 * non-gift-card products of the store.
 */
export async function setBundleComponents(
  tx: TenantTx,
  storeId: string,
  productId: string,
  bundleVariantId: string,
  components: { variantId: string; quantity: number }[],
): Promise<void> {
  const variants = await tx.productVariant.findMany({
    where: { storeId, id: { in: components.map((c) => c.variantId) } },
    select: {
      id: true,
      productId: true,
      product: { select: { isBundle: true, isGiftCard: true } },
    },
  });
  const byId = new Map(variants.map((v) => [v.id, v]));
  for (const c of components) {
    const variant = byId.get(c.variantId);
    if (!variant) throw new BadRequestException('A bundle item no longer exists.');
    if (variant.productId === productId) {
      throw new BadRequestException('A bundle cannot contain its own variants.');
    }
    if (variant.product.isBundle) {
      throw new BadRequestException('A bundle cannot contain another bundle.');
    }
    if (variant.product.isGiftCard) {
      throw new BadRequestException('Gift cards cannot be part of a bundle.');
    }
  }
  await tx.bundleComponent.deleteMany({ where: { storeId, bundleVariantId } });
  await tx.bundleComponent.createMany({
    data: components.map((c, position) => ({
      storeId,
      bundleVariantId,
      componentVariantId: c.variantId,
      quantity: c.quantity,
      position,
    })),
  });
}
