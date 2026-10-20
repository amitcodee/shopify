import { Inject, Injectable, Logger } from '@nestjs/common';
import type { OrderLine, Prisma, PrismaClient, TenantTx } from '@repo/db';
import { DiscountRules } from '../commerce/commerce-rules.js';
import { PLATFORM_DB, TenantDb } from '../database/database.module.js';
import { OutboxService } from '../outbox/outbox.service.js';
import {
  merchantNewOrderEmail,
  orderConfirmationEmail,
  type OrderEmailData,
} from '../outbox/templates.js';
import { StoreUrls } from './store-urls.js';

type OrderWithLines = Prisma.OrderGetPayload<{ include: { lines: true } }>;

export interface PaidOutcome {
  amount: number;
  currency: string;
  providerPaymentId: string | null;
}

/**
 * Order state transitions shared by checkout, payment webhooks, the admin, and background
 * jobs. Every transition runs inside a tenant transaction and writes an order event.
 */
@Injectable()
export class OrderLifecycle {
  private readonly logger = new Logger(OrderLifecycle.name);

  constructor(
    private readonly tenantDb: TenantDb,
    private readonly outbox: OutboxService,
    private readonly urls: StoreUrls,
    private readonly discounts: DiscountRules,
    @Inject(PLATFORM_DB) private readonly platformDb: PrismaClient,
  ) {}

  async event(
    tx: TenantTx,
    storeId: string,
    orderId: string,
    type: string,
    message: string,
    extra: { actorUserId?: string | null; data?: Prisma.InputJsonValue } = {},
  ): Promise<void> {
    await tx.orderEvent.create({
      data: {
        storeId,
        orderId,
        type,
        message,
        actorUserId: extra.actorUserId ?? null,
        data: extra.data,
      },
    });
  }

  /** Returns reserved/sold units to stock for the given lines (quantities default to the rest). */
  async restock(
    tx: TenantTx,
    storeId: string,
    lines: OrderLine[],
    quantities: Map<string, number> | null,
    reason: 'ORDER_CANCELLED' | 'RETURN',
    actorUserId: string | null,
    orderId: string,
  ): Promise<void> {
    for (const line of lines) {
      if (!line.stockReserved || !line.variantId) continue;
      const remaining = line.quantity - line.restockedQuantity;
      const qty = Math.min(remaining, quantities ? (quantities.get(line.id) ?? 0) : remaining);
      if (qty <= 0) continue;
      const updated = await tx.$queryRaw<{ inventoryQuantity: number }[]>`
        UPDATE "ProductVariant" SET "inventoryQuantity" = "inventoryQuantity" + ${qty}, "updatedAt" = now()
        WHERE id = ${line.variantId}::uuid AND "storeId" = ${storeId}::uuid AND "trackInventory"
        RETURNING "inventoryQuantity"`;
      const row = updated[0];
      if (row) {
        await tx.inventoryAdjustment.create({
          data: {
            storeId,
            variantId: line.variantId,
            delta: qty,
            quantityAfter: row.inventoryQuantity,
            reason,
            actorUserId,
            referenceId: orderId,
          },
        });
      }
      await tx.orderLine.update({
        where: { id: line.id },
        data: { restockedQuantity: { increment: qty } },
      });
    }
  }

  /** Cancels an order inside the caller's transaction (idempotent). */
  async cancelInTx(
    tx: TenantTx,
    storeId: string,
    orderId: string,
    options: { reason: string; restock: boolean; actorUserId: string | null },
  ): Promise<OrderWithLines> {
    const order = await tx.order.findFirstOrThrow({
      where: { id: orderId, storeId },
      include: { lines: true },
    });
    if (order.status === 'CANCELLED') return order;
    if (options.restock) {
      await this.restock(
        tx,
        storeId,
        order.lines,
        null,
        'ORDER_CANCELLED',
        options.actorUserId,
        orderId,
      );
    }
    await tx.payment.updateMany({
      where: { orderId, storeId, status: 'PENDING' },
      data: { status: 'CANCELLED' },
    });
    const updated = await tx.order.update({
      where: { id: orderId },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
        cancelReason: options.reason,
        expiresAt: null,
        financialStatus: order.financialStatus === 'PENDING' ? 'VOIDED' : order.financialStatus,
      },
      include: { lines: true },
    });
    await this.event(tx, storeId, orderId, 'cancelled', `Order cancelled (${options.reason}).`, {
      actorUserId: options.actorUserId,
      data: { restocked: options.restock },
    });
    return updated;
  }

  /** Applies a verified "payment succeeded" from the provider. Idempotent. */
  async markPaid(storeId: string, paymentId: string, outcome: PaidOutcome): Promise<void> {
    await this.tenantDb.run(storeId, async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Payment" WHERE id = ${paymentId}::uuid FOR UPDATE`;
      const payment = await tx.payment.findUniqueOrThrow({
        where: { id: paymentId },
        include: { order: { include: { lines: true } } },
      });
      if (payment.status === 'SUCCEEDED') return;
      const { order } = payment;

      if (outcome.amount !== payment.amount || outcome.currency !== payment.currency) {
        await tx.payment.update({ where: { id: paymentId }, data: { status: 'FAILED' } });
        await this.event(
          tx,
          storeId,
          order.id,
          'payment_mismatch',
          `Payment rejected: expected ${payment.amount} ${payment.currency}, provider reported ${outcome.amount} ${outcome.currency}.`,
        );
        this.logger.warn(`Payment amount mismatch on order ${order.id}`);
        return;
      }

      await tx.payment.update({
        where: { id: paymentId },
        data: { status: 'SUCCEEDED', providerPaymentId: outcome.providerPaymentId },
      });
      if (order.discountCode) await this.discounts.redeem(tx, storeId, order.discountCode);

      if (order.status === 'CANCELLED') {
        await tx.order.update({
          where: { id: order.id },
          data: { financialStatus: 'PAID', paidAt: new Date() },
        });
        await this.event(
          tx,
          storeId,
          order.id,
          'paid_after_cancellation',
          'Payment arrived after the order was cancelled. Refund it from the order page.',
        );
        return;
      }

      await tx.order.update({
        where: { id: order.id },
        data: { status: 'OPEN', financialStatus: 'PAID', paidAt: new Date(), expiresAt: null },
      });
      if (order.cartId) await tx.cart.deleteMany({ where: { id: order.cartId, storeId } });
      await this.event(tx, storeId, order.id, 'paid', 'Payment received.');
      await this.sendOrderEmails(tx, storeId, order);
    });
  }

  /** Marks a zero-total order as paid without a payment provider. */
  async markFreeOrderPaid(tx: TenantTx, storeId: string, order: OrderWithLines): Promise<void> {
    await tx.order.update({
      where: { id: order.id },
      data: { status: 'OPEN', financialStatus: 'PAID', paidAt: new Date(), expiresAt: null },
    });
    if (order.discountCode) await this.discounts.redeem(tx, storeId, order.discountCode);
    if (order.cartId) await tx.cart.deleteMany({ where: { id: order.cartId, storeId } });
    await this.event(tx, storeId, order.id, 'paid', 'No payment required (order total is zero).');
    await this.sendOrderEmails(tx, storeId, order);
  }

  async markFailed(storeId: string, paymentId: string): Promise<void> {
    await this.tenantDb.run(storeId, async (tx) => {
      const payment = await tx.payment.findUniqueOrThrow({ where: { id: paymentId } });
      if (payment.status !== 'PENDING') return;
      await tx.payment.update({ where: { id: paymentId }, data: { status: 'FAILED' } });
      await this.event(
        tx,
        storeId,
        payment.orderId,
        'payment_failed',
        'Payment failed or was declined.',
      );
      const order = await tx.order.findUniqueOrThrow({ where: { id: payment.orderId } });
      if (order.status === 'PENDING_PAYMENT') {
        await this.cancelInTx(tx, storeId, order.id, {
          reason: 'payment_failed',
          restock: true,
          actorUserId: null,
        });
      }
    });
  }

  /** Cancels unpaid orders past their payment window, releasing reserved stock. */
  async expireStaleOrders(limit = 50): Promise<number> {
    const stale = await this.platformDb.order.findMany({
      where: { status: 'PENDING_PAYMENT', expiresAt: { lt: new Date() } },
      select: { id: true, storeId: true },
      take: limit,
    });
    for (const order of stale) {
      await this.tenantDb.run(order.storeId, (tx) =>
        this.cancelInTx(tx, order.storeId, order.id, {
          reason: 'payment_timeout',
          restock: true,
          actorUserId: null,
        }),
      );
    }
    return stale.length;
  }

  emailData(storeName: string, order: OrderWithLines, statusUrl?: string): OrderEmailData {
    return {
      storeName,
      orderNumber: order.number,
      currency: order.currency,
      total: order.total,
      lines: order.lines.map((l) => ({
        title: l.title,
        variantTitle: l.variantTitle,
        quantity: l.quantity,
        total: l.unitPrice * l.quantity - l.discountTotal,
      })),
      statusUrl,
    };
  }

  private async sendOrderEmails(
    tx: TenantTx,
    storeId: string,
    order: OrderWithLines,
  ): Promise<void> {
    const store = await tx.store.findUniqueOrThrow({ where: { id: storeId } });
    const primary = await tx.domain.findFirst({
      where: { storeId, isPrimary: true, verifiedAt: { not: null } },
    });
    const statusUrl = `${this.urls.storefrontOrigin(store.subdomain, primary?.hostname)}/orders/${this.urls.orderAccessToken(order.id)}`;
    const data = this.emailData(store.name, order, statusUrl);
    await this.outbox.enqueueEmail(tx, storeId, orderConfirmationEmail(order.email, data));
    await this.outbox.enqueueEmail(
      tx,
      storeId,
      merchantNewOrderEmail(store.contactEmail, data, this.urls.adminOrderUrl(storeId, order.id)),
    );
  }
}
