import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  type InventoryAdjustment,
  type InventoryItem,
  LOW_STOCK_THRESHOLD,
  type Paginated,
} from '@repo/contracts';
import type { Prisma } from '@repo/db';
import type { z } from 'zod';
import type { inventoryAdjustInputSchema, inventoryListQuerySchema } from '@repo/contracts';
import { AuditService } from '../audit/audit.service.js';
import type { AuthUser, RequestMeta } from '../common/request.js';
import { TenantDb } from '../database/database.module.js';

type AdjustInput = z.output<typeof inventoryAdjustInputSchema>;
type ListQuery = z.output<typeof inventoryListQuerySchema>;

@Injectable()
export class InventoryService {
  constructor(
    private readonly tenantDb: TenantDb,
    private readonly audit: AuditService,
  ) {}

  async list(storeId: string, query: ListQuery): Promise<Paginated<InventoryItem>> {
    const where: Prisma.ProductVariantWhereInput = { storeId };
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
          include: { product: { select: { title: true } } },
          orderBy: [{ inventoryQuantity: 'asc' }, { productId: 'asc' }, { position: 'asc' }],
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
        }),
        tx.productVariant.count({ where }),
      ]),
    );
    return {
      items: rows.map((v) => ({
        variantId: v.id,
        productId: v.productId,
        productTitle: v.product.title,
        variantTitle: v.title,
        sku: v.sku,
        trackInventory: v.trackInventory,
        allowBackorder: v.allowBackorder,
        inventoryQuantity: v.inventoryQuantity,
      })),
      page: query.page,
      pageSize: query.pageSize,
      total,
    };
  }

  /** Applies a manual stock change atomically and records it in the append-only ledger. */
  async adjust(
    storeId: string,
    variantId: string,
    input: AdjustInput,
    actor: AuthUser,
    meta: RequestMeta,
  ): Promise<InventoryItem> {
    return this.tenantDb.run(storeId, async (tx) => {
      // Lock the row so concurrent "set to" counts are computed from the latest value.
      const locked = await tx.$queryRaw<{ id: string }[]>`
        SELECT id FROM "ProductVariant" WHERE id = ${variantId}::uuid AND "storeId" = ${storeId}::uuid FOR UPDATE`;
      if (locked.length === 0) throw new NotFoundException('Variant not found.');

      const variant = await tx.productVariant.findUniqueOrThrow({
        where: { id: variantId },
        include: { product: { select: { title: true } } },
      });
      if (!variant.trackInventory) {
        throw new BadRequestException('Inventory is not tracked for this variant.');
      }
      const delta =
        input.setTo !== undefined ? input.setTo - variant.inventoryQuantity : input.delta!;
      const quantityAfter = variant.inventoryQuantity + delta;
      if (quantityAfter < 0 && !variant.allowBackorder) {
        throw new ConflictException('Stock cannot go below zero for this variant.');
      }

      if (delta !== 0) {
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
          },
        });
        await this.audit.record(tx, {
          storeId,
          actorUserId: actor.id,
          action: 'inventory.adjusted',
          entityType: 'variant',
          entityId: variantId,
          data: { delta, quantityAfter, reason: input.reason },
          meta,
        });
      }

      return {
        variantId,
        productId: variant.productId,
        productTitle: variant.product.title,
        variantTitle: variant.title,
        sku: variant.sku,
        trackInventory: variant.trackInventory,
        allowBackorder: variant.allowBackorder,
        inventoryQuantity: quantityAfter,
      };
    });
  }

  async history(storeId: string, variantId: string): Promise<InventoryAdjustment[]> {
    const rows = await this.tenantDb.run(storeId, (tx) =>
      tx.inventoryAdjustment.findMany({
        where: { storeId, variantId },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
    );
    return rows.map((r) => ({
      id: r.id,
      delta: r.delta,
      quantityAfter: r.quantityAfter,
      reason: r.reason,
      note: r.note,
      createdAt: r.createdAt.toISOString(),
    }));
  }
}
