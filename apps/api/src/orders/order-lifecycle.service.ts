import { ConflictException, Inject, Injectable, Logger } from '@nestjs/common';
import type { OrderLine, Prisma, PrismaClient, TenantTx } from '@repo/db';
import { DiscountRules } from '../commerce/commerce-rules.js';
import { PLATFORM_DB, TenantDb } from '../database/database.module.js';
import { GiftCardLedger } from '../gift-cards/gift-card-ledger.js';
import { WebhookEmitter } from '../webhooks/webhooks.service.js';
import { OutboxService } from '../outbox/outbox.service.js';
import { formatMoney } from '@repo/contracts';
import {
  disputeEmail,
  merchantNewOrderEmail,
  orderConfirmationEmail,
  type OrderEmailData,
} from '../outbox/templates.js';
import type { DisputeUpdate } from '../payments/payment-provider.js';
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
/** Provider name of payments collected outside the platform (see markPaidManually). */
export const MANUAL_PAYMENT = 'manual';
/** Provider name of the part of an order paid with a gift card (settled at checkout). */
export const GIFT_CARD_PAYMENT = 'gift_card';

@Injectable()
export class OrderLifecycle {
  private readonly logger = new Logger(OrderLifecycle.name);

  constructor(
    private readonly tenantDb: TenantDb,
    private readonly outbox: OutboxService,
    private readonly urls: StoreUrls,
    private readonly discounts: DiscountRules,
    private readonly giftCards: GiftCardLedger,
    private readonly webhooks: WebhookEmitter,
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

  /** Next sequential order number for the store (first order is #1001). */
  async allocateOrderNumber(tx: TenantTx, storeId: string): Promise<number> {
    const [counter] = await tx.$queryRaw<{ number: number }[]>`
      INSERT INTO "OrderCounter" ("storeId", "next") VALUES (${storeId}::uuid, 1002)
      ON CONFLICT ("storeId") DO UPDATE SET "next" = "OrderCounter"."next" + 1
      RETURNING "next" - 1 AS number`;
    if (!counter) throw new Error('Could not allocate an order number');
    return counter.number;
  }

  /** Atomic conditional decrements: concurrent checkouts can never oversell. */
  async reserveStock(
    tx: TenantTx,
    storeId: string,
    orderId: string,
    lines: { variantId: string | null; title: string; quantity: number; trackInventory: boolean }[],
  ): Promise<void> {
    for (const line of lines) {
      if (!line.trackInventory || !line.variantId) continue;
      const rows = await tx.$queryRaw<{ inventoryQuantity: number }[]>`
        UPDATE "ProductVariant"
        SET "inventoryQuantity" = "inventoryQuantity" - ${line.quantity}, "updatedAt" = now()
        WHERE id = ${line.variantId}::uuid AND "storeId" = ${storeId}::uuid
          AND ("inventoryQuantity" >= ${line.quantity} OR "allowBackorder")
        RETURNING "inventoryQuantity"`;
      const row = rows[0];
      if (!row)
        throw new ConflictException(`${line.title} just sold out. Please review your cart.`);
      await tx.inventoryAdjustment.create({
        data: {
          storeId,
          variantId: line.variantId,
          delta: -line.quantity,
          quantityAfter: row.inventoryQuantity,
          reason: 'ORDER',
          referenceId: orderId,
        },
      });
    }
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
    // An unpaid order hands its gift card reservation back.
    if (order.financialStatus === 'PENDING' && order.giftCardId && order.giftCardAmount > 0) {
      await this.giftCards.credit(tx, storeId, order.giftCardId, order.giftCardAmount, 'RESTORED', {
        orderId,
        actorUserId: options.actorUserId,
      });
      await tx.payment.updateMany({
        where: { orderId, storeId, provider: GIFT_CARD_PAYMENT, status: 'SUCCEEDED' },
        data: { status: 'CANCELLED' },
      });
    }
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
    await this.webhooks.emitOrder(tx, storeId, 'orders/cancelled', orderId);
    await this.event(tx, storeId, orderId, 'cancelled', `Order cancelled (${options.reason}).`, {
      actorUserId: options.actorUserId,
      data: { restocked: options.restock },
    });
    return updated;
  }

  /**
   * Mirrors a provider dispute (chargeback) onto the order: upserts the Dispute, and on every
   * status change writes a timeline event and emails the store. Idempotent per status.
   */
  async applyDispute(storeId: string, paymentId: string, update: DisputeUpdate): Promise<void> {
    await this.tenantDb.run(storeId, async (tx) => {
      const payment = await tx.payment.findUniqueOrThrow({
        where: { id: paymentId },
        include: { order: true },
      });
      const existing = await tx.dispute.findUnique({
        where: {
          provider_providerDisputeId: { provider: payment.provider, providerDisputeId: update.id },
        },
      });
      if (existing?.status === update.status) return;
      const fields = {
        amount: update.amount,
        currency: update.currency,
        reason: update.reason,
        status: update.status,
        evidenceDueBy: update.evidenceDueBy,
      };
      if (existing) {
        await tx.dispute.update({ where: { id: existing.id }, data: fields });
      } else {
        await tx.dispute.create({
          data: {
            storeId,
            orderId: payment.orderId,
            paymentId,
            provider: payment.provider,
            providerDisputeId: update.id,
            ...fields,
          },
        });
      }

      const amount = formatMoney(update.amount, update.currency);
      const message =
        update.status === 'WON'
          ? `Chargeback of ${amount} resolved in your favour.`
          : update.status === 'LOST'
            ? `Chargeback of ${amount} lost: the funds were returned to the customer.`
            : update.status === 'UNDER_REVIEW'
              ? `Chargeback of ${amount} is under review by the card network.`
              : `Chargeback of ${amount} opened${update.reason ? ` (${update.reason.replaceAll('_', ' ')})` : ''}. Respond with evidence in your payment provider's dashboard${update.evidenceDueBy ? ` by ${update.evidenceDueBy.toISOString().slice(0, 10)}` : ''}.`;
      await this.event(
        tx,
        storeId,
        payment.orderId,
        `dispute_${update.status.toLowerCase()}`,
        message,
        {
          data: { disputeId: update.id, amount: update.amount, status: update.status },
        },
      );
      const store = await tx.store.findUniqueOrThrow({ where: { id: storeId } });
      await this.outbox.enqueueEmail(
        tx,
        storeId,
        disputeEmail(store.contactEmail, {
          storeName: store.name,
          orderNumber: payment.order.number,
          message,
          orderUrl: this.urls.adminOrderUrl(storeId, payment.orderId),
        }),
      );
    });
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
      await this.completeDraft(tx, storeId, order.id);
      await this.event(tx, storeId, order.id, 'paid', 'Payment received.');
      await this.webhooks.emitOrder(tx, storeId, 'orders/paid', order.id);
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
    await this.completeDraft(tx, storeId, order.id);
    await this.event(
      tx,
      storeId,
      order.id,
      'paid',
      order.giftCardAmount > 0
        ? 'Paid in full with a gift card.'
        : 'No payment required (order total is zero).',
    );
    await this.webhooks.emitOrder(tx, storeId, 'orders/paid', order.id);
    await this.sendOrderEmails(tx, storeId, order);
  }

  /**
   * Records a payment the merchant collected outside the platform (cash, bank transfer). It is
   * a "manual" payment: refunds against it are recorded but not sent to any provider.
   */
  async markPaidManually(
    tx: TenantTx,
    storeId: string,
    order: OrderWithLines,
    actorUserId: string,
  ): Promise<void> {
    await tx.payment.create({
      data: {
        storeId,
        orderId: order.id,
        provider: MANUAL_PAYMENT,
        providerRef: `manual-${order.id}`,
        amount: order.total,
        currency: order.currency,
        status: 'SUCCEEDED',
      },
    });
    await tx.order.update({
      where: { id: order.id },
      data: { status: 'OPEN', financialStatus: 'PAID', paidAt: new Date(), expiresAt: null },
    });
    await this.completeDraft(tx, storeId, order.id);
    await this.event(
      tx,
      storeId,
      order.id,
      'paid',
      'Marked as paid (payment collected manually).',
      {
        actorUserId,
      },
    );
    await this.webhooks.emitOrder(tx, storeId, 'orders/paid', order.id);
    await this.sendOrderEmails(tx, storeId, order);
  }

  /** A draft order whose order was paid is complete. */
  private async completeDraft(tx: TenantTx, storeId: string, orderId: string): Promise<void> {
    await tx.draftOrder.updateMany({
      where: { storeId, orderId, status: { not: 'COMPLETED' } },
      data: { status: 'COMPLETED', completedAt: new Date() },
    });
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
