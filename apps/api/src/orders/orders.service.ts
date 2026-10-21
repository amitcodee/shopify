import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Dispute as DisputeDto } from '@repo/contracts';
import type {
  cancelOrderInputSchema,
  fulfillInputSchema,
  OrderDetail,
  OrderListItem,
  OrderListQuery,
  Paginated,
  refundInputSchema,
} from '@repo/contracts';
import type { Dispute as DisputeRow, Prisma, TenantTx } from '@repo/db';
import type { z } from 'zod';
import { AuditService } from '../audit/audit.service.js';
import type { AuthUser, RequestMeta, StoreContext } from '../common/request.js';
import { TenantDb } from '../database/database.module.js';
import { OutboxService } from '../outbox/outbox.service.js';
import {
  orderCancelledEmail,
  refundEmail,
  shippingConfirmationEmail,
} from '../outbox/templates.js';
import { PAYMENT_PROVIDERS, type PaymentProvider } from '../payments/payment-provider.js';
import { GiftCardLedger } from '../gift-cards/gift-card-ledger.js';
import { WebhookEmitter } from '../webhooks/webhooks.service.js';
import { GIFT_CARD_PAYMENT, MANUAL_PAYMENT, OrderLifecycle } from './order-lifecycle.service.js';

const detailInclude = {
  lines: true,
  payments: { orderBy: { createdAt: 'asc' } },
  refunds: { orderBy: { createdAt: 'asc' } },
  disputes: { orderBy: { createdAt: 'asc' } },
  fulfillments: { orderBy: { createdAt: 'asc' } },
  events: { orderBy: { createdAt: 'asc' } },
  customer: { select: { id: true, email: true, name: true } },
} satisfies Prisma.OrderInclude;

type OrderWithDetail = Prisma.OrderGetPayload<{ include: typeof detailInclude }>;

function paidAmount(order: OrderWithDetail): number {
  return order.payments.filter((p) => p.status === 'SUCCEEDED').reduce((s, p) => s + p.amount, 0);
}

function committedRefunds(order: OrderWithDetail): number {
  return order.refunds.filter((r) => r.status !== 'FAILED').reduce((s, r) => s + r.amount, 0);
}

export function toListItem(
  order: Prisma.OrderGetPayload<{ include: { lines: true; customer: { select: { name: true } } } }>,
): OrderListItem {
  return {
    id: order.id,
    number: order.number,
    email: order.email,
    customerName: order.customer?.name ?? null,
    status: order.status,
    financialStatus: order.financialStatus,
    fulfillmentStatus: order.fulfillmentStatus,
    currency: order.currency,
    total: order.total,
    itemCount: order.lines.reduce((s, l) => s + l.quantity, 0),
    createdAt: order.createdAt.toISOString(),
  };
}

@Injectable()
export class OrdersService {
  constructor(
    private readonly tenantDb: TenantDb,
    private readonly lifecycle: OrderLifecycle,
    private readonly outbox: OutboxService,
    private readonly audit: AuditService,
    private readonly giftCards: GiftCardLedger,
    private readonly webhooks: WebhookEmitter,
    @Inject(PAYMENT_PROVIDERS) private readonly providers: Map<string, PaymentProvider>,
  ) {}

  async list(storeId: string, query: OrderListQuery): Promise<Paginated<OrderListItem>> {
    const where: Prisma.OrderWhereInput = { storeId };
    if (query.status) where.status = query.status;
    if (query.financialStatus) where.financialStatus = query.financialStatus;
    if (query.fulfillmentStatus) where.fulfillmentStatus = query.fulfillmentStatus;
    if (query.q) {
      const asNumber = Number(query.q.replace(/^#/, ''));
      where.OR = [
        { email: { contains: query.q, mode: 'insensitive' } },
        ...(Number.isInteger(asNumber) && asNumber > 0 ? [{ number: asNumber }] : []),
      ];
    }
    const [rows, total] = await this.tenantDb.run(storeId, (tx) =>
      Promise.all([
        tx.order.findMany({
          where,
          include: { lines: true, customer: { select: { name: true } } },
          orderBy: { createdAt: 'desc' },
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
        }),
        tx.order.count({ where }),
      ]),
    );
    return { items: rows.map(toListItem), page: query.page, pageSize: query.pageSize, total };
  }

  async get(storeId: string, orderId: string): Promise<OrderDetail> {
    const order = await this.tenantDb.run(storeId, (tx) => this.find(tx, storeId, orderId));
    return this.toDetail(order);
  }

  /**
   * Refunds through the payment provider. The refund row is committed first (so concurrent
   * refunds cannot exceed the paid amount), the provider is called outside the transaction,
   * and the outcome is recorded afterwards.
   */
  async refund(
    store: StoreContext,
    orderId: string,
    input: z.output<typeof refundInputSchema>,
    actor: AuthUser,
    meta: RequestMeta,
  ): Promise<OrderDetail> {
    const pending = await this.tenantDb.run(store.id, async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Order" WHERE id = ${orderId}::uuid AND "storeId" = ${store.id}::uuid FOR UPDATE`;
      const order = await this.find(tx, store.id, orderId);
      if (order.financialStatus !== 'PAID' && order.financialStatus !== 'PARTIALLY_REFUNDED') {
        throw new ConflictException('Only paid orders can be refunded.');
      }
      const refundable = paidAmount(order) - committedRefunds(order);
      if (input.amount > refundable) {
        throw new BadRequestException(`You can refund at most ${refundable} (minor units).`);
      }
      for (const item of input.restock) {
        const line = order.lines.find((l) => l.id === item.lineId);
        if (!line) throw new BadRequestException('Unknown order line.');
        if (item.quantity > line.quantity - line.restockedQuantity) {
          throw new BadRequestException(
            `Cannot restock more than ${line.quantity - line.restockedQuantity} of ${line.title}.`,
          );
        }
      }
      // Money goes back the way it came: the card/manual payment first, then the gift card.
      const remaining = (p: { id: string; amount: number }) =>
        p.amount -
        order.refunds
          .filter((r) => r.paymentId === p.id && r.status !== 'FAILED')
          .reduce((sum, r) => sum + r.amount, 0);
      const succeeded = order.payments.filter((p) => p.status === 'SUCCEEDED');
      const payment = succeeded.find((p) => p.provider !== GIFT_CARD_PAYMENT) ?? null;
      const giftPayment = succeeded.find((p) => p.provider === GIFT_CARD_PAYMENT) ?? null;
      if (!payment && !giftPayment) throw new ConflictException('No successful payment to refund.');
      const toPayment = payment ? Math.min(input.amount, remaining(payment)) : 0;
      const toGiftCard = input.amount - toPayment;
      const row = (paymentId: string, amount: number) =>
        tx.refund.create({
          data: {
            storeId: store.id,
            orderId,
            paymentId,
            amount,
            reason: input.reason ?? null,
            actorUserId: actor.id,
          },
        });
      const refund = payment && toPayment > 0 ? await row(payment.id, toPayment) : null;
      const giftRefund =
        giftPayment && toGiftCard > 0 ? await row(giftPayment.id, toGiftCard) : null;
      return {
        refund,
        payment,
        giftRefund,
        giftCardId: order.giftCardId,
        currency: order.currency,
      };
    });

    const provider = pending.payment ? this.providers.get(pending.payment.provider) : undefined;
    let result: Awaited<ReturnType<PaymentProvider['refund']>> | null = null;
    try {
      if (!pending.refund || !pending.payment) {
        // Nothing to send to a provider: the whole amount goes back to the gift card.
        result = { status: 'SUCCEEDED', providerRef: 'gift-card-only' };
      } else if (pending.payment.provider === MANUAL_PAYMENT) {
        // Collected outside the platform, so it is returned outside it too: record it only.
        result = { status: 'SUCCEEDED', providerRef: `manual-refund-${pending.refund.id}` };
      } else {
        if (!provider) throw new Error(`Provider ${pending.payment.provider} unavailable`);
        result = await provider.refund({
          providerRef: pending.payment.providerRef,
          providerPaymentId: pending.payment.providerPaymentId,
          amount: input.amount,
          currency: pending.currency,
          idempotencyKey: `refund-${pending.refund.id}`,
          reverseTransfer: pending.payment.destinationAccountId !== null,
        });
      }
    } catch {
      result = null;
    }

    await this.tenantDb.run(store.id, async (tx) => {
      // Re-lock and re-read: concurrent refunds must not both restock the same units
      // (restock clamps to what is still un-restocked on the freshly read lines).
      await tx.$queryRaw`SELECT id FROM "Order" WHERE id = ${orderId}::uuid AND "storeId" = ${store.id}::uuid FOR UPDATE`;
      if (!result || result.status === 'FAILED') {
        await tx.refund.updateMany({
          where: {
            id: {
              in: [pending.refund?.id, pending.giftRefund?.id].filter((id) => id !== undefined),
            },
          },
          data: { status: 'FAILED', providerRef: result?.providerRef ?? null },
        });
        await this.lifecycle.event(
          tx,
          store.id,
          orderId,
          'refund_failed',
          'Refund failed at the payment provider.',
          { actorUserId: actor.id },
        );
        return;
      }
      if (pending.refund) {
        await tx.refund.update({
          where: { id: pending.refund.id },
          data: { status: result.status, providerRef: result.providerRef },
        });
      }
      if (pending.giftRefund && pending.giftCardId) {
        await this.giftCards.credit(
          tx,
          store.id,
          pending.giftCardId,
          pending.giftRefund.amount,
          'REFUNDED',
          { orderId, actorUserId: actor.id },
        );
        await tx.refund.update({
          where: { id: pending.giftRefund.id },
          data: { status: 'SUCCEEDED', providerRef: `gift-card-refund-${pending.giftRefund.id}` },
        });
      }
      const order = await this.find(tx, store.id, orderId);
      const refunded = committedRefunds(order);
      await tx.order.update({
        where: { id: orderId },
        data: {
          financialStatus: refunded >= paidAmount(order) ? 'REFUNDED' : 'PARTIALLY_REFUNDED',
        },
      });
      if (input.restock.length > 0) {
        await this.lifecycle.restock(
          tx,
          store.id,
          order.lines,
          new Map(input.restock.map((r) => [r.lineId, r.quantity])),
          'RETURN',
          actor.id,
          orderId,
        );
      }
      await this.lifecycle.event(
        tx,
        store.id,
        orderId,
        'refunded',
        pending.giftRefund
          ? `Refunded ${input.amount} ${order.currency} (${pending.giftRefund.amount} to the gift card).`
          : `Refunded ${input.amount} ${order.currency}.`,
        {
          actorUserId: actor.id,
          data: {
            refundId: pending.refund?.id ?? pending.giftRefund?.id ?? null,
            reason: input.reason ?? null,
          },
        },
      );
      await this.webhooks.emitOrder(tx, store.id, 'refunds/created', orderId, {
        refund: { id: pending.refund?.id ?? pending.giftRefund?.id, amount: input.amount },
      });
      await this.audit.record(tx, {
        storeId: store.id,
        actorUserId: actor.id,
        action: 'order.refunded',
        entityType: 'order',
        entityId: orderId,
        data: { amount: input.amount },
        meta,
      });
      const shop = await tx.store.findUniqueOrThrow({ where: { id: store.id } });
      await this.outbox.enqueueEmail(
        tx,
        store.id,
        refundEmail(order.email, {
          storeName: shop.name,
          orderNumber: order.number,
          amount: input.amount,
          currency: order.currency,
        }),
      );
    });

    if (!result || result.status === 'FAILED') {
      throw new BadGatewayException('The payment provider could not process the refund.');
    }
    return this.get(store.id, orderId);
  }

  async fulfill(
    store: StoreContext,
    orderId: string,
    input: z.output<typeof fulfillInputSchema>,
    actor: AuthUser,
    meta: RequestMeta,
  ): Promise<OrderDetail> {
    await this.tenantDb.run(store.id, async (tx) => {
      const order = await this.find(tx, store.id, orderId);
      if (order.status !== 'OPEN')
        throw new ConflictException('Only open (paid) orders can be fulfilled.');
      if (order.fulfillmentStatus === 'FULFILLED')
        throw new ConflictException('This order is already fulfilled.');
      await tx.fulfillment.create({
        data: {
          storeId: store.id,
          orderId,
          trackingCompany: input.trackingCompany ?? null,
          trackingNumber: input.trackingNumber ?? null,
          trackingUrl: input.trackingUrl ?? null,
          actorUserId: actor.id,
        },
      });
      await tx.order.update({ where: { id: orderId }, data: { fulfillmentStatus: 'FULFILLED' } });
      await this.webhooks.emitOrder(tx, store.id, 'orders/fulfilled', orderId);
      await this.lifecycle.event(tx, store.id, orderId, 'fulfilled', 'Order fulfilled.', {
        actorUserId: actor.id,
      });
      await this.audit.record(tx, {
        storeId: store.id,
        actorUserId: actor.id,
        action: 'order.fulfilled',
        entityType: 'order',
        entityId: orderId,
        meta,
      });
      if (input.notifyCustomer) {
        const shop = await tx.store.findUniqueOrThrow({ where: { id: store.id } });
        await this.outbox.enqueueEmail(
          tx,
          store.id,
          shippingConfirmationEmail(order.email, {
            storeName: shop.name,
            orderNumber: order.number,
            trackingCompany: input.trackingCompany,
            trackingNumber: input.trackingNumber,
            trackingUrl: input.trackingUrl,
          }),
        );
      }
    });
    return this.get(store.id, orderId);
  }

  async cancel(
    store: StoreContext,
    orderId: string,
    input: z.output<typeof cancelOrderInputSchema>,
    actor: AuthUser,
    meta: RequestMeta,
  ): Promise<OrderDetail> {
    const order = await this.get(store.id, orderId);
    if (order.status === 'CANCELLED')
      throw new ConflictException('This order is already cancelled.');
    if (order.fulfillmentStatus === 'FULFILLED') {
      throw new ConflictException('Fulfilled orders cannot be cancelled. Issue a refund instead.');
    }
    if (input.refund && order.refundableAmount > 0) {
      await this.refund(
        store,
        orderId,
        { amount: order.refundableAmount, reason: 'Order cancelled', restock: [] },
        actor,
        meta,
      );
    }
    await this.tenantDb.run(store.id, async (tx) => {
      const cancelled = await this.lifecycle.cancelInTx(tx, store.id, orderId, {
        reason: input.reason.toLowerCase(),
        restock: input.restock,
        actorUserId: actor.id,
      });
      await this.audit.record(tx, {
        storeId: store.id,
        actorUserId: actor.id,
        action: 'order.cancelled',
        entityType: 'order',
        entityId: orderId,
        data: { reason: input.reason, refunded: input.refund },
        meta,
      });
      const shop = await tx.store.findUniqueOrThrow({ where: { id: store.id } });
      await this.outbox.enqueueEmail(
        tx,
        store.id,
        orderCancelledEmail(cancelled.email, {
          storeName: shop.name,
          orderNumber: cancelled.number,
        }),
      );
    });
    return this.get(store.id, orderId);
  }

  private async find(tx: TenantTx, storeId: string, orderId: string): Promise<OrderWithDetail> {
    const order = await tx.order.findFirst({
      where: { id: orderId, storeId },
      include: detailInclude,
    });
    if (!order) throw new NotFoundException('Order not found.');
    return order;
  }

  private toDetail(order: OrderWithDetail): OrderDetail {
    return {
      ...toListItem({ ...order, customer: order.customer ? { name: order.customer.name } : null }),
      subtotal: order.subtotal,
      discountTotal: order.discountTotal,
      shippingTotal: order.shippingTotal,
      taxTotal: order.taxTotal,
      giftCardAmount: order.giftCardAmount,
      discountCode: order.discountCode,
      shippingMethod: order.shippingMethod,
      shippingAddress: order.shippingAddress as OrderDetail['shippingAddress'],
      note: order.note,
      paidAt: order.paidAt?.toISOString() ?? null,
      cancelledAt: order.cancelledAt?.toISOString() ?? null,
      cancelReason: order.cancelReason,
      customer: order.customer,
      lines: order.lines.map((l) => ({
        id: l.id,
        productId: l.productId,
        variantId: l.variantId,
        title: l.title,
        variantTitle: l.variantTitle,
        sku: l.sku,
        unitPrice: l.unitPrice,
        quantity: l.quantity,
        discountTotal: l.discountTotal,
        total: l.unitPrice * l.quantity - l.discountTotal,
        restockedQuantity: l.restockedQuantity,
        restockable: l.stockReserved ? l.quantity - l.restockedQuantity : 0,
      })),
      payments: order.payments.map((p) => ({
        id: p.id,
        provider: p.provider,
        amount: p.amount,
        status: p.status,
        createdAt: p.createdAt.toISOString(),
      })),
      refunds: order.refunds.map((r) => ({
        id: r.id,
        amount: r.amount,
        reason: r.reason,
        status: r.status,
        createdAt: r.createdAt.toISOString(),
      })),
      disputes: order.disputes.map((d) => toDisputeDto(d, order.number)),
      fulfillments: order.fulfillments.map((f) => ({
        id: f.id,
        trackingCompany: f.trackingCompany,
        trackingNumber: f.trackingNumber,
        trackingUrl: f.trackingUrl,
        createdAt: f.createdAt.toISOString(),
      })),
      events: order.events.map((e) => ({
        id: e.id,
        type: e.type,
        message: e.message,
        createdAt: e.createdAt.toISOString(),
      })),
      refundableAmount: Math.max(0, paidAmount(order) - committedRefunds(order)),
    };
  }
}

export function toDisputeDto(d: DisputeRow, orderNumber: number): DisputeDto {
  return {
    id: d.id,
    orderId: d.orderId,
    orderNumber,
    amount: d.amount,
    currency: d.currency,
    reason: d.reason,
    status: d.status,
    evidenceDueBy: d.evidenceDueBy?.toISOString() ?? null,
    createdAt: d.createdAt.toISOString(),
  };
}
