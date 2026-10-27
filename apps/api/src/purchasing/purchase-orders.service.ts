import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  type Paginated,
  type PurchaseOrder as PurchaseOrderDto,
  type purchaseOrderActionSchema,
  type purchaseOrderInputSchema,
  type PurchaseOrderListItem,
  type PurchaseOrderListQuery,
  purchaseOrderName,
  type purchaseOrderReceiveInputSchema,
  type PurchaseOrderStatus,
} from '@repo/contracts';
import type { Prisma, TenantTx } from '@repo/db';
import type { z } from 'zod';
import { AuditService } from '../audit/audit.service.js';
import { refreshBundlesContaining } from '../catalog/bundles.js';
import { changeLevel } from '../catalog/inventory-levels.js';
import type { AuthUser, RequestMeta } from '../common/request.js';
import { TenantDb } from '../database/database.module.js';
import { MediaUrls } from '../storage/storage.module.js';

type OrderInput = z.output<typeof purchaseOrderInputSchema>;
type ActionInput = z.output<typeof purchaseOrderActionSchema>;
type ReceiveInput = z.output<typeof purchaseOrderReceiveInputSchema>;

const detailInclude = {
  supplier: { select: { id: true, name: true, email: true } },
  location: { select: { id: true, name: true } },
  lines: {
    orderBy: { position: 'asc' },
    include: {
      variant: {
        select: {
          productId: true,
          image: { select: { storageKey: true } },
          product: {
            select: {
              images: { orderBy: { position: 'asc' }, take: 1, select: { storageKey: true } },
            },
          },
        },
      },
    },
  },
} satisfies Prisma.PurchaseOrderInclude;

type OrderWithDetail = Prisma.PurchaseOrderGetPayload<{ include: typeof detailInclude }>;

/** "2026-12-31" for a date stored at UTC midnight. */
function dateOnly(value: Date | null): string | null {
  return value ? value.toISOString().slice(0, 10) : null;
}

function isOverdue(
  status: PurchaseOrderStatus,
  expectedAt: Date | null,
  now = new Date(),
): boolean {
  if (!expectedAt || (status !== 'ORDERED' && status !== 'PARTIALLY_RECEIVED')) return false;
  return dateOnly(expectedAt)! < now.toISOString().slice(0, 10);
}

/**
 * Purchase orders: stock ordered from a supplier. DRAFT orders can be edited freely; once
 * ordered, items are fixed and stock is received (in one go or in parts) into the order's
 * location, which records PURCHASE_ORDER entries in the inventory ledger.
 */
@Injectable()
export class PurchaseOrdersService {
  constructor(
    private readonly tenantDb: TenantDb,
    private readonly audit: AuditService,
    private readonly media: MediaUrls,
  ) {}

  async list(
    storeId: string,
    query: PurchaseOrderListQuery,
  ): Promise<Paginated<PurchaseOrderListItem>> {
    const where: Prisma.PurchaseOrderWhereInput = { storeId };
    if (query.status === 'open') where.status = { in: ['DRAFT', 'ORDERED', 'PARTIALLY_RECEIVED'] };
    else if (query.status) where.status = query.status;
    if (query.supplierId) where.supplierId = query.supplierId;
    const [rows, total] = await this.tenantDb.run(storeId, (tx) =>
      Promise.all([
        tx.purchaseOrder.findMany({
          where,
          include: {
            supplier: { select: { name: true } },
            location: { select: { name: true } },
            lines: { select: { quantity: true, receivedQuantity: true, unitCost: true } },
          },
          orderBy: { number: 'desc' },
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
        }),
        tx.purchaseOrder.count({ where }),
      ]),
    );
    return {
      items: rows.map((o) => ({
        id: o.id,
        number: o.number,
        name: purchaseOrderName(o.number),
        status: o.status,
        supplierId: o.supplierId,
        supplierName: o.supplier.name,
        locationName: o.location.name,
        expectedAt: dateOnly(o.expectedAt),
        total: o.lines.reduce((s, l) => s + l.quantity * l.unitCost, 0) + o.shippingCost,
        unitsOrdered: o.lines.reduce((s, l) => s + l.quantity, 0),
        unitsReceived: o.lines.reduce((s, l) => s + l.receivedQuantity, 0),
        overdue: isOverdue(o.status, o.expectedAt),
        createdAt: o.createdAt.toISOString(),
      })),
      page: query.page,
      pageSize: query.pageSize,
      total,
    };
  }

  async get(storeId: string, id: string): Promise<PurchaseOrderDto> {
    return this.tenantDb.run(storeId, async (tx) => this.toDto(await this.load(tx, storeId, id)));
  }

  async create(
    storeId: string,
    input: OrderInput,
    actor: AuthUser,
    meta: RequestMeta,
  ): Promise<PurchaseOrderDto> {
    return this.tenantDb.run(storeId, async (tx) => {
      await this.assertTargets(tx, storeId, input);
      const lines = await this.lineData(tx, storeId, input);
      const [counter] = await tx.$queryRaw<{ number: number }[]>`
        INSERT INTO "OrderCounter" ("storeId", "nextPurchaseOrder") VALUES (${storeId}::uuid, 2)
        ON CONFLICT ("storeId") DO UPDATE SET "nextPurchaseOrder" = "OrderCounter"."nextPurchaseOrder" + 1
        RETURNING "nextPurchaseOrder" - 1 AS number`;
      if (!counter) throw new Error('Could not allocate a purchase order number');
      const created = await tx.purchaseOrder.create({
        data: {
          storeId,
          number: counter.number,
          ...this.headerData(input),
        },
      });
      await tx.purchaseOrderLine.createMany({
        data: lines.map((l) => ({ ...l, storeId, purchaseOrderId: created.id })),
      });
      await this.audit.record(tx, {
        storeId,
        actorUserId: actor.id,
        action: 'purchase_order.created',
        entityType: 'purchase_order',
        entityId: created.id,
        data: { number: created.number, lines: lines.length },
        meta,
      });
      return this.toDto(await this.load(tx, storeId, created.id));
    });
  }

  /** Replaces a draft's details and items. */
  async update(
    storeId: string,
    id: string,
    input: OrderInput,
    actor: AuthUser,
    meta: RequestMeta,
  ): Promise<PurchaseOrderDto> {
    return this.tenantDb.run(storeId, async (tx) => {
      const order = await this.lock(tx, storeId, id);
      if (order.status !== 'DRAFT') {
        throw new ConflictException('Only draft purchase orders can be edited.');
      }
      await this.assertTargets(tx, storeId, input);
      const lines = await this.lineData(tx, storeId, input);
      await tx.purchaseOrderLine.deleteMany({ where: { storeId, purchaseOrderId: id } });
      await tx.purchaseOrder.update({
        where: { id },
        data: this.headerData(input),
      });
      await tx.purchaseOrderLine.createMany({
        data: lines.map((l) => ({ ...l, storeId, purchaseOrderId: id })),
      });
      await this.audit.record(tx, {
        storeId,
        actorUserId: actor.id,
        action: 'purchase_order.updated',
        entityType: 'purchase_order',
        entityId: id,
        data: { number: order.number, lines: lines.length },
        meta,
      });
      return this.toDto(await this.load(tx, storeId, id));
    });
  }

  async action(
    storeId: string,
    id: string,
    input: ActionInput,
    actor: AuthUser,
    meta: RequestMeta,
  ): Promise<PurchaseOrderDto> {
    return this.tenantDb.run(storeId, async (tx) => {
      const order = await this.lock(tx, storeId, id);
      const now = new Date();
      let data: Prisma.PurchaseOrderUpdateInput;
      switch (input.action) {
        case 'mark_ordered':
          if (order.status !== 'DRAFT') {
            throw new ConflictException('Only a draft can be marked as ordered.');
          }
          data = { status: 'ORDERED', orderedAt: now };
          break;
        case 'cancel': {
          if (order.status !== 'DRAFT' && order.status !== 'ORDERED') {
            throw new ConflictException(
              order.status === 'PARTIALLY_RECEIVED'
                ? 'Some stock was already received. Close the order instead.'
                : 'This purchase order is already closed.',
            );
          }
          data = { status: 'CANCELLED', cancelledAt: now };
          break;
        }
        case 'close':
          if (order.status !== 'ORDERED' && order.status !== 'PARTIALLY_RECEIVED') {
            throw new ConflictException('Only an order that is expecting stock can be closed.');
          }
          data = { status: 'RECEIVED', receivedAt: now };
          break;
      }
      await tx.purchaseOrder.update({ where: { id }, data });
      await this.audit.record(tx, {
        storeId,
        actorUserId: actor.id,
        action: `purchase_order.${input.action}`,
        entityType: 'purchase_order',
        entityId: id,
        data: { number: order.number },
        meta,
      });
      return this.toDto(await this.load(tx, storeId, id));
    });
  }

  /**
   * Books arrived units into the order's location (tracked variants only) and moves the order to
   * PARTIALLY_RECEIVED or RECEIVED. Receiving more than is still expected is refused.
   */
  async receive(
    storeId: string,
    id: string,
    input: ReceiveInput,
    actor: AuthUser,
    meta: RequestMeta,
  ): Promise<PurchaseOrderDto> {
    return this.tenantDb.run(storeId, async (tx) => {
      const order = await this.lock(tx, storeId, id);
      if (order.status !== 'ORDERED' && order.status !== 'PARTIALLY_RECEIVED') {
        throw new ConflictException(
          order.status === 'DRAFT'
            ? 'Mark the purchase order as ordered before receiving stock.'
            : 'This purchase order is closed.',
        );
      }
      const lines = await tx.purchaseOrderLine.findMany({
        where: { storeId, purchaseOrderId: id },
        orderBy: { position: 'asc' },
      });
      const byId = new Map(lines.map((l) => [l.id, l]));
      const name = purchaseOrderName(order.number);
      const touched: string[] = [];
      let units = 0;
      // Variant id order keeps the lock order stable against concurrent sales.
      const receipts = input.lines
        .filter((r) => r.quantity > 0)
        .map((r) => {
          const line = byId.get(r.lineId);
          if (!line) throw new BadRequestException('Unknown purchase order line.');
          const expected = line.quantity - line.receivedQuantity;
          if (r.quantity > expected) {
            throw new BadRequestException(
              `${line.productTitle}: only ${expected} more ${expected === 1 ? 'unit is' : 'units are'} expected.`,
            );
          }
          return { line, quantity: r.quantity };
        })
        .sort((a, b) => (a.line.variantId ?? '').localeCompare(b.line.variantId ?? ''));

      for (const { line, quantity } of receipts) {
        units += quantity;
        await tx.purchaseOrderLine.update({
          where: { id: line.id },
          data: { receivedQuantity: { increment: quantity } },
        });
        if (!line.variantId) continue;
        const [variant] = await tx.$queryRaw<{ inventoryQuantity: number }[]>`
          UPDATE "ProductVariant" v
          SET "inventoryQuantity" = v."inventoryQuantity" + ${quantity}, "updatedAt" = now()
          FROM "Product" p
          WHERE v.id = ${line.variantId}::uuid AND v."storeId" = ${storeId}::uuid
            AND p.id = v."productId" AND v."trackInventory" AND NOT p."isBundle"
          RETURNING v."inventoryQuantity"`;
        if (input.updateCost) {
          await tx.productVariant.updateMany({
            where: { id: line.variantId, storeId },
            data: { costPerItem: line.unitCost },
          });
        }
        if (!variant) continue; // Not tracked: nothing to count.
        await changeLevel(tx, storeId, line.variantId, order.locationId, quantity);
        await tx.inventoryAdjustment.create({
          data: {
            storeId,
            variantId: line.variantId,
            delta: quantity,
            quantityAfter: variant.inventoryQuantity,
            reason: 'PURCHASE_ORDER',
            note: `Received on ${name}`,
            actorUserId: actor.id,
            referenceId: order.id,
            locationId: order.locationId,
          },
        });
        touched.push(line.variantId);
      }
      await refreshBundlesContaining(tx, storeId, touched);

      const after = await tx.purchaseOrderLine.findMany({
        where: { storeId, purchaseOrderId: id },
        select: { quantity: true, receivedQuantity: true },
      });
      const complete = after.every((l) => l.receivedQuantity >= l.quantity);
      await tx.purchaseOrder.update({
        where: { id },
        data: complete
          ? { status: 'RECEIVED', receivedAt: new Date() }
          : { status: 'PARTIALLY_RECEIVED' },
      });
      await this.audit.record(tx, {
        storeId,
        actorUserId: actor.id,
        action: 'purchase_order.received',
        entityType: 'purchase_order',
        entityId: id,
        data: { number: order.number, units, updateCost: input.updateCost },
        meta,
      });
      return this.toDto(await this.load(tx, storeId, id));
    });
  }

  /** Deletes a draft or cancelled order (received stock stays in the ledger otherwise). */
  async remove(storeId: string, id: string, actor: AuthUser, meta: RequestMeta): Promise<void> {
    await this.tenantDb.run(storeId, async (tx) => {
      const order = await this.lock(tx, storeId, id);
      if (order.status !== 'DRAFT' && order.status !== 'CANCELLED') {
        throw new ConflictException('Only draft or cancelled purchase orders can be deleted.');
      }
      await tx.purchaseOrder.delete({ where: { id } });
      await this.audit.record(tx, {
        storeId,
        actorUserId: actor.id,
        action: 'purchase_order.deleted',
        entityType: 'purchase_order',
        entityId: id,
        data: { number: order.number },
        meta,
      });
    });
  }

  private headerData(input: OrderInput) {
    return {
      supplierId: input.supplierId,
      locationId: input.locationId,
      supplierReference: input.supplierReference,
      expectedAt: input.expectedAt ? new Date(`${input.expectedAt}T00:00:00Z`) : null,
      shippingCost: input.shippingCost,
      notes: input.notes,
    };
  }

  private async assertTargets(tx: TenantTx, storeId: string, input: OrderInput): Promise<void> {
    const [supplier, location] = await Promise.all([
      tx.supplier.findFirst({ where: { id: input.supplierId, storeId } }),
      tx.location.findFirst({ where: { id: input.locationId, storeId } }),
    ]);
    if (!supplier) throw new BadRequestException('Choose an existing supplier.');
    if (!location) throw new BadRequestException('Choose an existing location.');
    if (!location.active) throw new BadRequestException('Choose an active location.');
  }

  /** Line rows with a snapshot of each variant's titles (kept if the variant is deleted). */
  private async lineData(tx: TenantTx, storeId: string, input: OrderInput) {
    const variants = await tx.productVariant.findMany({
      where: { storeId, id: { in: input.lines.map((l) => l.variantId) } },
      include: { product: { select: { title: true, isBundle: true } } },
    });
    const byId = new Map(variants.map((v) => [v.id, v]));
    return input.lines.map((l, position) => {
      const variant = byId.get(l.variantId);
      if (!variant) throw new BadRequestException('Some of the items no longer exist.');
      if (variant.product.isBundle) {
        throw new BadRequestException(
          `${variant.product.title} is a bundle. Order the products in it instead.`,
        );
      }
      return {
        variantId: variant.id,
        productTitle: variant.product.title,
        variantTitle: variant.title,
        sku: variant.sku,
        supplierSku: l.supplierSku,
        quantity: l.quantity,
        unitCost: l.unitCost,
        position,
      };
    });
  }

  private async lock(tx: TenantTx, storeId: string, id: string) {
    const rows = await tx.$queryRaw<{ id: string }[]>`
      SELECT id FROM "PurchaseOrder" WHERE id = ${id}::uuid AND "storeId" = ${storeId}::uuid FOR UPDATE`;
    if (rows.length === 0) throw new NotFoundException('Purchase order not found.');
    return tx.purchaseOrder.findUniqueOrThrow({ where: { id } });
  }

  private async load(tx: TenantTx, storeId: string, id: string): Promise<OrderWithDetail> {
    const order = await tx.purchaseOrder.findFirst({
      where: { id, storeId },
      include: detailInclude,
    });
    if (!order) throw new NotFoundException('Purchase order not found.');
    return order;
  }

  private toDto(o: OrderWithDetail): PurchaseOrderDto {
    const lines = o.lines.map((l) => {
      const image = l.variant?.image ?? l.variant?.product.images[0];
      return {
        id: l.id,
        variantId: l.variantId,
        productId: l.variant?.productId ?? null,
        productTitle: l.productTitle,
        variantTitle: l.variantTitle,
        sku: l.sku,
        supplierSku: l.supplierSku,
        quantity: l.quantity,
        receivedQuantity: l.receivedQuantity,
        unitCost: l.unitCost,
        total: l.quantity * l.unitCost,
        imageUrl: image ? this.media.url(image.storageKey) : null,
      };
    });
    const subtotal = lines.reduce((s, l) => s + l.total, 0);
    return {
      id: o.id,
      number: o.number,
      name: purchaseOrderName(o.number),
      status: o.status,
      supplier: o.supplier,
      location: o.location,
      supplierReference: o.supplierReference,
      expectedAt: dateOnly(o.expectedAt),
      shippingCost: o.shippingCost,
      notes: o.notes,
      lines,
      subtotal,
      total: subtotal + o.shippingCost,
      unitsOrdered: lines.reduce((s, l) => s + l.quantity, 0),
      unitsReceived: lines.reduce((s, l) => s + l.receivedQuantity, 0),
      overdue: isOverdue(o.status, o.expectedAt),
      orderedAt: o.orderedAt?.toISOString() ?? null,
      receivedAt: o.receivedAt?.toISOString() ?? null,
      cancelledAt: o.cancelledAt?.toISOString() ?? null,
      createdAt: o.createdAt.toISOString(),
      updatedAt: o.updatedAt.toISOString(),
    };
  }
}
