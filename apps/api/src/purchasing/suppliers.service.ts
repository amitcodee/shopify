import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  LOW_STOCK_THRESHOLD,
  REORDER_TARGET,
  type ReorderSuggestion,
  type Supplier as SupplierDto,
  type supplierInputSchema,
} from '@repo/contracts';
import { Prisma, type Supplier, type TenantTx } from '@repo/db';
import type { z } from 'zod';
import { AuditService } from '../audit/audit.service.js';
import type { AuthUser, RequestMeta } from '../common/request.js';
import { TenantDb } from '../database/database.module.js';

type SupplierInput = z.output<typeof supplierInputSchema>;

/** Purchase orders that still expect stock. */
export const OPEN_PURCHASE_ORDER_STATUSES = ['ORDERED', 'PARTIALLY_RECEIVED'] as const;

@Injectable()
export class SuppliersService {
  constructor(
    private readonly tenantDb: TenantDb,
    private readonly audit: AuditService,
  ) {}

  list(storeId: string): Promise<SupplierDto[]> {
    return this.tenantDb.run(storeId, async (tx) => {
      const suppliers = await tx.supplier.findMany({
        where: { storeId },
        orderBy: [{ active: 'desc' }, { name: 'asc' }],
      });
      return this.withCounts(tx, storeId, suppliers);
    });
  }

  async get(storeId: string, id: string): Promise<SupplierDto> {
    return this.tenantDb.run(storeId, async (tx) => {
      const [dto] = await this.withCounts(tx, storeId, [await this.find(tx, storeId, id)]);
      return dto!;
    });
  }

  async save(
    storeId: string,
    id: string | null,
    input: SupplierInput,
    actor: AuthUser,
    meta: RequestMeta,
  ): Promise<SupplierDto> {
    try {
      return await this.tenantDb.run(storeId, async (tx) => {
        const current = id ? await this.find(tx, storeId, id) : null;
        const saved = current
          ? await tx.supplier.update({ where: { id: current.id }, data: input })
          : await tx.supplier.create({ data: { storeId, ...input } });
        await this.audit.record(tx, {
          storeId,
          actorUserId: actor.id,
          action: current ? 'supplier.updated' : 'supplier.created',
          entityType: 'supplier',
          entityId: saved.id,
          data: { name: saved.name, active: saved.active },
          meta,
        });
        const [dto] = await this.withCounts(tx, storeId, [saved]);
        return dto!;
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('A supplier with this name already exists.');
      }
      throw error;
    }
  }

  /** Deletes a supplier without purchase orders (its products keep no supplier). */
  async remove(storeId: string, id: string, actor: AuthUser, meta: RequestMeta): Promise<void> {
    await this.tenantDb.run(storeId, async (tx) => {
      const supplier = await this.find(tx, storeId, id);
      const orders = await tx.purchaseOrder.count({ where: { storeId, supplierId: id } });
      if (orders > 0) {
        throw new ConflictException(
          'This supplier has purchase orders, so it cannot be deleted. Mark it inactive instead.',
        );
      }
      await tx.supplier.delete({ where: { id } });
      await this.audit.record(tx, {
        storeId,
        actorUserId: actor.id,
        action: 'supplier.deleted',
        entityType: 'supplier',
        entityId: id,
        data: { name: supplier.name },
        meta,
      });
    });
  }

  /**
   * Low-stock items of the supplier's products, with what is already on its way, and how many
   * to order to get back to REORDER_TARGET.
   */
  async reorder(storeId: string, id: string): Promise<ReorderSuggestion[]> {
    return this.tenantDb.run(storeId, async (tx) => {
      await this.find(tx, storeId, id);
      const variants = await tx.productVariant.findMany({
        where: {
          storeId,
          trackInventory: true,
          inventoryQuantity: { lte: LOW_STOCK_THRESHOLD },
          product: { supplierId: id, isBundle: false, status: { not: 'ARCHIVED' } },
        },
        include: { product: { select: { title: true } } },
        orderBy: [{ inventoryQuantity: 'asc' }, { productId: 'asc' }, { position: 'asc' }],
        take: 200,
      });
      const incoming = await this.incoming(
        tx,
        storeId,
        variants.map((v) => v.id),
      );
      return variants.flatMap((v) => {
        const onTheWay = incoming.get(v.id) ?? 0;
        const suggestedQuantity = REORDER_TARGET - Math.max(0, v.inventoryQuantity) - onTheWay;
        if (suggestedQuantity <= 0) return [];
        return [
          {
            variantId: v.id,
            productId: v.productId,
            productTitle: v.product.title,
            variantTitle: v.title,
            sku: v.sku,
            inventoryQuantity: v.inventoryQuantity,
            incoming: onTheWay,
            costPerItem: v.costPerItem,
            suggestedQuantity,
          },
        ];
      });
    });
  }

  /** Units ordered but not yet received, per variant. */
  async incoming(
    tx: TenantTx,
    storeId: string,
    variantIds: string[],
  ): Promise<Map<string, number>> {
    if (variantIds.length === 0) return new Map();
    const rows = await tx.$queryRaw<{ variantId: string; units: number }[]>`
      SELECT l."variantId", SUM(l.quantity - l."receivedQuantity")::int AS units
      FROM "PurchaseOrderLine" l
      JOIN "PurchaseOrder" o ON o.id = l."purchaseOrderId"
      WHERE l."storeId" = ${storeId}::uuid AND l."variantId" = ANY(${variantIds}::uuid[])
        AND o.status IN ('ORDERED', 'PARTIALLY_RECEIVED')
      GROUP BY l."variantId"`;
    return new Map(rows.map((r) => [r.variantId, Math.max(0, r.units)]));
  }

  async find(tx: TenantTx, storeId: string, id: string): Promise<Supplier> {
    const supplier = await tx.supplier.findFirst({ where: { id, storeId } });
    if (!supplier) throw new NotFoundException('Supplier not found.');
    return supplier;
  }

  private async withCounts(
    tx: TenantTx,
    storeId: string,
    suppliers: Supplier[],
  ): Promise<SupplierDto[]> {
    const ids = suppliers.map((s) => s.id);
    const [products, orders] = await Promise.all([
      tx.product.groupBy({
        by: ['supplierId'],
        where: { storeId, supplierId: { in: ids } },
        _count: { _all: true },
      }),
      tx.purchaseOrder.groupBy({
        by: ['supplierId'],
        where: {
          storeId,
          supplierId: { in: ids },
          status: { in: [...OPEN_PURCHASE_ORDER_STATUSES] },
        },
        _count: { _all: true },
      }),
    ]);
    const productCount = new Map(products.map((p) => [p.supplierId, p._count._all]));
    const openCount = new Map(orders.map((o) => [o.supplierId, o._count._all]));
    return suppliers.map((s) => ({
      id: s.id,
      name: s.name,
      contactName: s.contactName,
      email: s.email,
      phone: s.phone,
      address: s.address,
      website: s.website,
      leadTimeDays: s.leadTimeDays,
      notes: s.notes,
      active: s.active,
      productCount: productCount.get(s.id) ?? 0,
      openPurchaseOrders: openCount.get(s.id) ?? 0,
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
    }));
  }
}
