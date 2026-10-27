import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  type InventoryAdjustment,
  type InventoryItem,
  type inventoryTransferInputSchema,
  type Location as LocationDto,
  type locationInputSchema,
  LOW_STOCK_THRESHOLD,
  type Paginated,
} from '@repo/contracts';
import type { Prisma, TenantTx } from '@repo/db';
import type { z } from 'zod';
import type { inventoryAdjustInputSchema, inventoryListQuerySchema } from '@repo/contracts';
import { AuditService } from '../audit/audit.service.js';
import type { AuthUser, RequestMeta } from '../common/request.js';
import { TenantDb } from '../database/database.module.js';
import { refreshBundlesContaining } from './bundles.js';
import { changeLevel, defaultLocation } from './inventory-levels.js';

type AdjustInput = z.output<typeof inventoryAdjustInputSchema>;
type ListQuery = z.output<typeof inventoryListQuerySchema>;
type TransferInput = z.output<typeof inventoryTransferInputSchema>;
type LocationInput = z.output<typeof locationInputSchema>;

const itemInclude = {
  product: { select: { title: true } },
  levels: { select: { locationId: true, available: true } },
} satisfies Prisma.ProductVariantInclude;

function toItem(
  v: Prisma.ProductVariantGetPayload<{ include: typeof itemInclude }>,
): InventoryItem {
  return {
    variantId: v.id,
    productId: v.productId,
    productTitle: v.product.title,
    variantTitle: v.title,
    sku: v.sku,
    price: v.price,
    costPerItem: v.costPerItem,
    trackInventory: v.trackInventory,
    allowBackorder: v.allowBackorder,
    inventoryQuantity: v.inventoryQuantity,
    levels: v.levels,
  };
}

@Injectable()
export class InventoryService {
  constructor(
    private readonly tenantDb: TenantDb,
    private readonly audit: AuditService,
  ) {}

  async list(storeId: string, query: ListQuery): Promise<Paginated<InventoryItem>> {
    // Bundles hold no stock of their own (see bundles.ts).
    const where: Prisma.ProductVariantWhereInput = { storeId, product: { isBundle: false } };
    if (query.lowStock === 'true') {
      where.trackInventory = true;
      where.inventoryQuantity = { lte: LOW_STOCK_THRESHOLD };
    }
    if (query.q) {
      where.OR = [
        { sku: { contains: query.q, mode: 'insensitive' } },
        { product: { title: { contains: query.q, mode: 'insensitive' } } },
      ];
    }
    const [rows, total] = await this.tenantDb.run(storeId, (tx) =>
      Promise.all([
        tx.productVariant.findMany({
          where,
          include: itemInclude,
          orderBy: [{ inventoryQuantity: 'asc' }, { productId: 'asc' }, { position: 'asc' }],
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
        }),
        tx.productVariant.count({ where }),
      ]),
    );
    return { items: rows.map(toItem), page: query.page, pageSize: query.pageSize, total };
  }

  /**
   * Changes stock at one location (default: the default location) and the variant's total in
   * one transaction, recording it in the append-only ledger. "Set to" counts that location.
   */
  async adjust(
    storeId: string,
    variantId: string,
    input: AdjustInput,
    actor: AuthUser,
    meta: RequestMeta,
  ): Promise<InventoryItem> {
    return this.tenantDb.run(storeId, async (tx) => {
      const variant = await this.lockVariant(tx, storeId, variantId);
      const location = input.locationId
        ? await this.findLocation(tx, storeId, input.locationId)
        : await defaultLocation(tx, storeId);
      const level = await tx.inventoryLevel.findUnique({
        where: { variantId_locationId: { variantId, locationId: location.id } },
      });
      const delta =
        input.setTo !== undefined ? input.setTo - (level?.available ?? 0) : input.delta!;
      const quantityAfter = variant.inventoryQuantity + delta;
      if (((level?.available ?? 0) + delta < 0 || quantityAfter < 0) && !variant.allowBackorder) {
        throw new ConflictException('Stock cannot go below zero for this variant.');
      }

      if (delta !== 0) {
        await changeLevel(tx, storeId, variantId, location.id, delta);
        await tx.productVariant.update({
          where: { id: variantId },
          data: { inventoryQuantity: quantityAfter },
        });
        await tx.inventoryAdjustment.create({
          data: {
            storeId,
            variantId,
            delta,
            quantityAfter,
            reason: input.reason,
            note: input.note ?? null,
            actorUserId: actor.id,
            locationId: location.id,
          },
        });
        await this.audit.record(tx, {
          storeId,
          actorUserId: actor.id,
          action: 'inventory.adjusted',
          entityType: 'variant',
          entityId: variantId,
          data: { delta, quantityAfter, reason: input.reason, location: location.name },
          meta,
        });
        await refreshBundlesContaining(tx, storeId, [variantId]);
      }
      return toItem(
        await tx.productVariant.findUniqueOrThrow({
          where: { id: variantId },
          include: itemInclude,
        }),
      );
    });
  }

  /** Moves units between two locations; the total does not change. */
  async transfer(
    storeId: string,
    variantId: string,
    input: TransferInput,
    actor: AuthUser,
    meta: RequestMeta,
  ): Promise<InventoryItem> {
    return this.tenantDb.run(storeId, async (tx) => {
      const variant = await this.lockVariant(tx, storeId, variantId);
      const [from, to] = await Promise.all([
        this.findLocation(tx, storeId, input.fromLocationId),
        this.findLocation(tx, storeId, input.toLocationId),
      ]);
      const source = await tx.inventoryLevel.findUnique({
        where: { variantId_locationId: { variantId, locationId: from.id } },
      });
      if ((source?.available ?? 0) < input.quantity) {
        throw new ConflictException(`Only ${source?.available ?? 0} on hand at ${from.name}.`);
      }
      await changeLevel(tx, storeId, variantId, from.id, -input.quantity);
      await changeLevel(tx, storeId, variantId, to.id, input.quantity);
      for (const [location, delta] of [
        [from, -input.quantity],
        [to, input.quantity],
      ] as const) {
        await tx.inventoryAdjustment.create({
          data: {
            storeId,
            variantId,
            delta,
            quantityAfter: variant.inventoryQuantity,
            reason: 'TRANSFER',
            note: input.note ?? null,
            actorUserId: actor.id,
            locationId: location.id,
          },
        });
      }
      await this.audit.record(tx, {
        storeId,
        actorUserId: actor.id,
        action: 'inventory.transferred',
        entityType: 'variant',
        entityId: variantId,
        data: { from: from.name, to: to.name, quantity: input.quantity },
        meta,
      });
      return toItem(
        await tx.productVariant.findUniqueOrThrow({
          where: { id: variantId },
          include: itemInclude,
        }),
      );
    });
  }

  async history(storeId: string, variantId: string): Promise<InventoryAdjustment[]> {
    return this.tenantDb.run(storeId, async (tx) => {
      const [rows, locations] = await Promise.all([
        tx.inventoryAdjustment.findMany({
          where: { storeId, variantId },
          orderBy: { createdAt: 'desc' },
          take: 100,
        }),
        tx.location.findMany({ where: { storeId }, select: { id: true, name: true } }),
      ]);
      const names = new Map(locations.map((l) => [l.id, l.name]));
      return rows.map((r) => ({
        id: r.id,
        delta: r.delta,
        quantityAfter: r.quantityAfter,
        reason: r.reason,
        note: r.note,
        locationName: r.locationId ? (names.get(r.locationId) ?? null) : null,
        createdAt: r.createdAt.toISOString(),
      }));
    });
  }

  // ---- Locations ----

  listLocations(storeId: string): Promise<LocationDto[]> {
    return this.tenantDb.run(storeId, async (tx) => {
      await defaultLocation(tx, storeId);
      const [locations, units] = await Promise.all([
        tx.location.findMany({
          where: { storeId },
          orderBy: [{ priority: 'asc' }, { isDefault: 'desc' }, { createdAt: 'asc' }],
        }),
        tx.inventoryLevel.groupBy({
          by: ['locationId'],
          where: { storeId },
          _sum: { available: true },
        }),
      ]);
      const onHand = new Map(units.map((u) => [u.locationId, u._sum.available ?? 0]));
      return locations.map((l) => ({
        id: l.id,
        name: l.name,
        address: l.address,
        active: l.active,
        priority: l.priority,
        isDefault: l.isDefault,
        unitsOnHand: onHand.get(l.id) ?? 0,
      }));
    });
  }

  async saveLocation(
    storeId: string,
    id: string | null,
    input: LocationInput,
    actor: AuthUser,
    meta: RequestMeta,
  ): Promise<LocationDto[]> {
    await this.tenantDb.run(storeId, async (tx) => {
      const current = id ? await this.findLocation(tx, storeId, id) : null;
      if (current?.isDefault && (!input.isDefault || !input.active)) {
        throw new BadRequestException('Make another location the default first.');
      }
      if (input.isDefault && !input.active) {
        throw new BadRequestException('The default location must be active.');
      }
      if (input.isDefault) {
        await tx.location.updateMany({
          where: { storeId, isDefault: true },
          data: { isDefault: false },
        });
      }
      const data = {
        name: input.name,
        address: input.address,
        active: input.active,
        priority: input.priority,
        isDefault: input.isDefault,
      };
      const saved = current
        ? await tx.location.update({ where: { id: current.id }, data })
        : await tx.location.create({ data: { storeId, ...data } });
      await this.audit.record(tx, {
        storeId,
        actorUserId: actor.id,
        action: current ? 'location.updated' : 'location.created',
        entityType: 'location',
        entityId: saved.id,
        data: { name: saved.name },
        meta,
      });
    });
    return this.listLocations(storeId);
  }

  /** Only empty, non-default locations can be deleted (stock must be moved first). */
  async removeLocation(
    storeId: string,
    id: string,
    actor: AuthUser,
    meta: RequestMeta,
  ): Promise<void> {
    await this.tenantDb.run(storeId, async (tx) => {
      const location = await this.findLocation(tx, storeId, id);
      if (location.isDefault)
        throw new BadRequestException('The default location cannot be deleted.');
      const stocked = await tx.inventoryLevel.count({
        where: { storeId, locationId: id, available: { not: 0 } },
      });
      if (stocked > 0) {
        throw new ConflictException(
          'Move or adjust the stock at this location before deleting it.',
        );
      }
      await tx.location.delete({ where: { id } });
      await this.audit.record(tx, {
        storeId,
        actorUserId: actor.id,
        action: 'location.deleted',
        entityType: 'location',
        entityId: id,
        data: { name: location.name },
        meta,
      });
    });
  }

  private async lockVariant(tx: TenantTx, storeId: string, variantId: string) {
    // Lock the row so concurrent counts and sales see the latest stock.
    const locked = await tx.$queryRaw<{ id: string }[]>`
      SELECT id FROM "ProductVariant" WHERE id = ${variantId}::uuid AND "storeId" = ${storeId}::uuid FOR UPDATE`;
    if (locked.length === 0) throw new NotFoundException('Variant not found.');
    const variant = await tx.productVariant.findUniqueOrThrow({
      where: { id: variantId },
      include: { product: { select: { isBundle: true } } },
    });
    if (variant.product.isBundle) {
      throw new BadRequestException(
        "A bundle's stock comes from the products in it. Adjust their stock instead.",
      );
    }
    if (!variant.trackInventory) {
      throw new BadRequestException('Inventory is not tracked for this variant.');
    }
    return variant;
  }

  private async findLocation(tx: TenantTx, storeId: string, id: string) {
    const location = await tx.location.findFirst({ where: { id, storeId } });
    if (!location) throw new NotFoundException('Location not found.');
    return location;
  }
}
