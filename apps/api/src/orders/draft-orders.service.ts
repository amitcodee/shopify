import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  type Address,
  addressSchema,
  type CheckoutResult,
  type DraftDiscount,
  draftDiscountSchema,
  type DraftOrder as DraftOrderDto,
  type draftOrderInputSchema,
  type DraftOrderLine,
  draftOrderLineSchema,
  type DraftOrderListItem,
  type DraftOrderListQuery,
  type Paginated,
  type StorefrontInvoice,
} from '@repo/contracts';
import type { DraftOrder, Prisma, TenantTx } from '@repo/db';
import { z } from 'zod';
import { AuditService } from '../audit/audit.service.js';
import { CheckoutService } from '../checkout/checkout.service.js';
import { priceCart } from '../checkout/pricing.js';
import { TaxRules } from '../commerce/commerce-rules.js';
import type { AuthUser, RequestMeta } from '../common/request.js';
import { ENV, type Env } from '../config/env.js';
import { TenantDb } from '../database/database.module.js';
import { draftInvoiceEmail } from '../outbox/templates.js';
import { OutboxService } from '../outbox/outbox.service.js';
import { PaymentAccountsService } from '../payments/payment-accounts.service.js';
import { PlanLimits } from '../platform/plans.service.js';
import type { ShopContext } from '../storefront/store-resolver.js';
import { MANUAL_PAYMENT, OrderLifecycle } from './order-lifecycle.service.js';
import { StoreUrls } from './store-urls.js';

type DraftInput = z.output<typeof draftOrderInputSchema>;
type DraftWithOrder = Prisma.DraftOrderGetPayload<{
  include: { order: { select: { id: true; number: true; status: true } } };
}>;

const storedLines = z.array(draftOrderLineSchema);

function lineTotal(line: DraftOrderLine, discount: number): number {
  return line.unitPrice * line.quantity - discount;
}

@Injectable()
export class DraftOrdersService {
  constructor(
    private readonly tenantDb: TenantDb,
    private readonly audit: AuditService,
    private readonly tax: TaxRules,
    private readonly lifecycle: OrderLifecycle,
    private readonly outbox: OutboxService,
    private readonly urls: StoreUrls,
    private readonly limits: PlanLimits,
    private readonly paymentAccounts: PaymentAccountsService,
    private readonly checkout: CheckoutService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  // ---- Admin ----

  list(storeId: string, query: DraftOrderListQuery): Promise<Paginated<DraftOrderListItem>> {
    return this.tenantDb.run(storeId, async (tx) => {
      const where: Prisma.DraftOrderWhereInput = {
        storeId,
        ...(query.status ? { status: query.status } : {}),
      };
      const [rows, total] = await Promise.all([
        tx.draftOrder.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
        }),
        tx.draftOrder.count({ where }),
      ]);
      return {
        items: rows.map((d) => ({
          id: d.id,
          number: d.number,
          status: d.status,
          email: d.email,
          currency: d.currency,
          total: d.total,
          createdAt: d.createdAt.toISOString(),
        })),
        page: query.page,
        pageSize: query.pageSize,
        total,
      };
    });
  }

  get(storeId: string, id: string): Promise<DraftOrderDto> {
    return this.tenantDb.run(storeId, async (tx) => this.toDto(await this.find(tx, storeId, id)));
  }

  create(storeId: string, input: DraftInput, actor: AuthUser, meta: RequestMeta) {
    return this.tenantDb.run(storeId, async (tx) => {
      const store = await tx.store.findUniqueOrThrow({ where: { id: storeId } });
      const [counter] = await tx.$queryRaw<{ number: number }[]>`
        INSERT INTO "OrderCounter" ("storeId", "nextDraft") VALUES (${storeId}::uuid, 2)
        ON CONFLICT ("storeId") DO UPDATE SET "nextDraft" = "OrderCounter"."nextDraft" + 1
        RETURNING "nextDraft" - 1 AS number`;
      if (!counter) throw new Error('Could not allocate a draft number');
      const fields = await this.priced(tx, storeId, input);
      const created = await tx.draftOrder.create({
        data: { storeId, number: counter.number, currency: store.currency, ...fields },
        include: { order: { select: { id: true, number: true, status: true } } },
      });
      await this.audit.record(tx, {
        storeId,
        actorUserId: actor.id,
        action: 'draft_order.created',
        entityType: 'draft_order',
        entityId: created.id,
        data: { number: created.number, total: created.total },
        meta,
      });
      return this.toDto(created);
    });
  }

  update(storeId: string, id: string, input: DraftInput, actor: AuthUser, meta: RequestMeta) {
    return this.tenantDb.run(storeId, async (tx) => {
      const draft = await this.lockEditable(tx, storeId, id);
      const updated = await tx.draftOrder.update({
        where: { id: draft.id },
        data: await this.priced(tx, storeId, input),
        include: { order: { select: { id: true, number: true, status: true } } },
      });
      await this.audit.record(tx, {
        storeId,
        actorUserId: actor.id,
        action: 'draft_order.updated',
        entityType: 'draft_order',
        entityId: id,
        data: { total: updated.total },
        meta,
      });
      return this.toDto(updated);
    });
  }

  remove(storeId: string, id: string, actor: AuthUser, meta: RequestMeta): Promise<void> {
    return this.tenantDb.run(storeId, async (tx) => {
      const draft = await this.lockEditable(tx, storeId, id);
      await tx.draftOrder.delete({ where: { id: draft.id } });
      await this.audit.record(tx, {
        storeId,
        actorUserId: actor.id,
        action: 'draft_order.deleted',
        entityType: 'draft_order',
        entityId: id,
        data: { number: draft.number },
        meta,
      });
    });
  }

  /** Emails the customer a link to pay the draft online. */
  sendInvoice(
    storeId: string,
    id: string,
    message: string | undefined,
    actor: AuthUser,
    meta: RequestMeta,
  ): Promise<DraftOrderDto> {
    return this.tenantDb.run(storeId, async (tx) => {
      const draft = await this.lockEditable(tx, storeId, id);
      if (!draft.email) throw new BadRequestException('Add a customer email first.');
      this.requireAddress(draft);
      if (draft.total === 0) {
        throw new BadRequestException('Nothing to pay: complete the draft instead.');
      }
      if (!(await this.paymentAccounts.acceptingPayments(tx, storeId))) {
        throw new ConflictException('Set up payments before sending invoices.');
      }
      const store = await tx.store.findUniqueOrThrow({ where: { id: storeId } });
      const primary = await tx.domain.findFirst({
        where: { storeId, isPrimary: true, verifiedAt: { not: null } },
      });
      const origin = this.urls.storefrontOrigin(store.subdomain, primary?.hostname);
      await this.outbox.enqueueEmail(
        tx,
        storeId,
        draftInvoiceEmail(draft.email, {
          storeName: store.name,
          number: draft.number,
          currency: draft.currency,
          total: draft.total,
          lines: storedLines.parse(draft.lines).map((l) => ({
            title: l.title,
            variantTitle: l.variantTitle,
            quantity: l.quantity,
            total: lineTotal(l, 0),
          })),
          message: message || null,
          payUrl: `${origin}/invoices/${this.invoiceToken(draft.id)}`,
        }),
      );
      const updated = await tx.draftOrder.update({
        where: { id: draft.id },
        data: { status: 'INVOICE_SENT', invoiceSentAt: new Date() },
        include: { order: { select: { id: true, number: true, status: true } } },
      });
      await this.audit.record(tx, {
        storeId,
        actorUserId: actor.id,
        action: 'draft_order.invoice_sent',
        entityType: 'draft_order',
        entityId: id,
        data: { to: draft.email },
        meta,
      });
      return this.toDto(updated);
    });
  }

  /** Turns the draft into a paid order (payment collected outside the platform). */
  complete(storeId: string, id: string, actor: AuthUser, meta: RequestMeta) {
    return this.tenantDb.run(storeId, async (tx) => {
      const draft = await this.lockEditable(tx, storeId, id);
      const order = await this.createOrder(tx, storeId, draft, actor.id);
      if (order.total === 0) {
        await this.lifecycle.markFreeOrderPaid(tx, storeId, order);
      } else {
        await this.lifecycle.markPaidManually(tx, storeId, order, actor.id);
      }
      await this.audit.record(tx, {
        storeId,
        actorUserId: actor.id,
        action: 'draft_order.completed',
        entityType: 'draft_order',
        entityId: id,
        data: { orderNumber: order.number },
        meta,
      });
      return this.toDto(await this.find(tx, storeId, id));
    });
  }

  // ---- Storefront (emailed invoice) ----

  invoiceToken(draftId: string): string {
    const mac = createHmac('sha256', this.env.STOREFRONT_SHARED_SECRET)
      .update(`draft-invoice:${draftId}`)
      .digest('base64url');
    return `${draftId}.${mac}`;
  }

  private draftIdFromToken(token: string): string {
    const draftId = token.split('.', 1)[0] ?? '';
    if (/^[0-9a-f-]{36}$/.test(draftId)) {
      const expected = Buffer.from(this.invoiceToken(draftId));
      const given = Buffer.from(token);
      if (given.length === expected.length && timingSafeEqual(given, expected)) return draftId;
    }
    throw new NotFoundException('Invoice not found.');
  }

  invoice(shop: ShopContext, token: string): Promise<StorefrontInvoice> {
    const draftId = this.draftIdFromToken(token);
    return this.tenantDb.run(shop.id, async (tx) => {
      const draft = await tx.draftOrder.findFirst({ where: { id: draftId, storeId: shop.id } });
      if (!draft) throw new NotFoundException('Invoice not found.');
      const lines = storedLines.parse(draft.lines);
      const pricing = this.pricing(draft, lines);
      return {
        storeName: shop.name,
        number: draft.number,
        state:
          draft.status === 'COMPLETED'
            ? 'paid'
            : draft.status === 'INVOICE_SENT'
              ? 'payable'
              : 'unavailable',
        currency: draft.currency,
        lines: lines.map((l, i) => ({
          title: l.title,
          variantTitle: l.variantTitle,
          quantity: l.quantity,
          total: lineTotal(l, pricing.lineDiscounts[i] ?? 0),
        })),
        subtotal: draft.subtotal,
        discountTotal: draft.discountTotal,
        shippingTotal: draft.shippingTotal,
        taxTotal: draft.taxTotal,
        total: draft.total,
        message: null,
      };
    });
  }

  /**
   * Starts (or resumes) paying an invoiced draft: creates the order, reserving stock, and opens
   * a provider payment session. Repeated clicks reuse the open payment.
   */
  async payInvoice(shop: ShopContext, host: string, token: string): Promise<CheckoutResult> {
    const draftId = this.draftIdFromToken(token);
    const result = await this.tenantDb.run(shop.id, async (tx) => {
      await tx.$queryRaw`SELECT id FROM "DraftOrder" WHERE id = ${draftId}::uuid AND "storeId" = ${shop.id}::uuid FOR UPDATE`;
      const draft = await tx.draftOrder.findFirst({ where: { id: draftId, storeId: shop.id } });
      if (!draft || draft.status === 'OPEN') throw new NotFoundException('Invoice not found.');
      if (draft.status === 'COMPLETED') {
        throw new ConflictException('This invoice has already been paid.');
      }
      const pending = draft.orderId
        ? await tx.order.findFirst({
            where: { id: draft.orderId, storeId: shop.id, status: 'PENDING_PAYMENT' },
            include: { payments: { orderBy: { createdAt: 'desc' }, take: 1 } },
          })
        : null;
      if (pending) return { order: pending, checkoutUrl: pending.payments[0]?.checkoutUrl };
      const order = await this.createOrder(tx, shop.id, draft, null);
      return { order, checkoutUrl: null };
    });
    const { order, checkoutUrl } = result;
    if (checkoutUrl) return { orderNumber: order.number, paymentUrl: checkoutUrl };
    return this.checkout.openPayment(shop, host, order, `/invoices/${token}?cancelled=1`);
  }

  // ---- Internals ----

  /** Validates lines against the catalog and prices the draft (catalog prices unless overridden). */
  private async priced(tx: TenantTx, storeId: string, input: DraftInput) {
    const variantIds = input.lines.flatMap((l) => ('variantId' in l ? [l.variantId] : []));
    const variants = await tx.productVariant.findMany({
      where: { storeId, id: { in: variantIds } },
      include: { product: { select: { title: true, isGiftCard: true } } },
    });
    const byId = new Map(variants.map((v) => [v.id, v]));
    const lines: DraftOrderLine[] = input.lines.map((l) => {
      if ('variantId' in l) {
        const v = byId.get(l.variantId);
        if (!v) throw new BadRequestException('Unknown product variant.');
        if (v.product.isGiftCard) {
          throw new BadRequestException(
            'Gift cards are sold through the storefront; issue one from Gift cards instead.',
          );
        }
        return {
          variantId: v.id,
          productId: v.productId,
          title: v.product.title,
          variantTitle: v.title,
          sku: v.sku,
          unitPrice: l.unitPrice ?? v.price,
          quantity: l.quantity,
          taxable: v.taxable,
          requiresShipping: v.requiresShipping,
          weightGrams: v.weightGrams,
        };
      }
      return {
        variantId: null,
        productId: null,
        title: l.title,
        variantTitle: 'Default',
        sku: null,
        unitPrice: l.unitPrice,
        quantity: l.quantity,
        taxable: l.taxable,
        requiresShipping: l.requiresShipping,
        weightGrams: 0,
      };
    });
    const address = input.shippingAddress ?? null;
    const tax = address
      ? await this.tax.rateFor(tx, storeId, { country: address.country, region: address.region })
      : { rateBps: 0, taxShipping: false };
    const shippingPrice = input.shipping?.price ?? 0;
    const pricing = priceCart({
      lines,
      discount: input.discount ?? null,
      shippingPrice,
      taxRateBps: tax.rateBps,
      taxShipping: tax.taxShipping,
    });
    const customer = input.email
      ? await tx.customer.findUnique({
          where: { storeId_email: { storeId, email: input.email } },
          select: { id: true },
        })
      : null;
    return {
      email: input.email ?? null,
      customerId: customer?.id ?? null,
      lines,
      shippingAddress: address ?? undefined,
      shippingTitle: input.shipping?.title ?? null,
      shippingPrice,
      discountType: input.discount?.type ?? null,
      discountValue: input.discount?.value ?? null,
      note: input.note ?? null,
      subtotal: pricing.subtotal,
      discountTotal: pricing.discountTotal,
      shippingTotal: pricing.shippingTotal,
      taxTotal: pricing.taxTotal,
      total: pricing.total,
    } satisfies Partial<Prisma.DraftOrderUncheckedCreateInput>;
  }

  /** Re-runs line discount allocation for display (totals are stored on the draft). */
  private pricing(draft: DraftOrder, lines: DraftOrderLine[]) {
    return priceCart({
      lines,
      discount: this.discountOf(draft),
      shippingPrice: draft.shippingPrice,
      taxRateBps: 0,
      taxShipping: false,
    });
  }

  private discountOf(draft: DraftOrder): DraftDiscount | null {
    const parsed = draftDiscountSchema.safeParse({
      type: draft.discountType,
      value: draft.discountValue,
    });
    return parsed.success ? parsed.data : null;
  }

  private requireAddress(draft: DraftOrder): Address {
    const parsed = addressSchema.safeParse(draft.shippingAddress);
    if (!parsed.success) throw new BadRequestException('Add the customer’s address first.');
    return parsed.data;
  }

  /** Creates the order for a draft: same snapshot, numbering, quota and stock rules as checkout. */
  private async createOrder(
    tx: TenantTx,
    storeId: string,
    draft: DraftOrder,
    actorUserId: string | null,
  ) {
    if (!draft.email) throw new BadRequestException('Add a customer email first.');
    const address = this.requireAddress(draft);
    await this.limits.assertCanAcceptOrder(tx, storeId);
    const lines = storedLines.parse(draft.lines);
    const pricing = this.pricing(draft, lines);
    const variants = await tx.productVariant.findMany({
      where: { storeId, id: { in: lines.flatMap((l) => (l.variantId ? [l.variantId] : [])) } },
      select: { id: true, trackInventory: true },
    });
    const tracked = new Set(variants.filter((v) => v.trackInventory).map((v) => v.id));
    const live = new Set(variants.map((v) => v.id));
    const destination =
      draft.total > 0 && actorUserId === null
        ? await this.paymentAccounts.requireDestination(tx, storeId)
        : null;
    const customer = await tx.customer.upsert({
      where: { storeId_email: { storeId, email: draft.email } },
      update: {},
      create: { storeId, email: draft.email, name: address.name },
    });
    // Each attempt is a new order (an expired invoice payment can be retried).
    const attempt = randomUUID();

    const order = await tx.order.create({
      data: {
        storeId,
        number: await this.lifecycle.allocateOrderNumber(tx, storeId),
        customerId: customer.id,
        email: draft.email,
        currency: draft.currency,
        subtotal: draft.subtotal,
        discountTotal: draft.discountTotal,
        shippingTotal: draft.shippingTotal,
        taxTotal: draft.taxTotal,
        total: draft.total,
        shippingMethod: draft.shippingTitle,
        shippingAddress: address,
        accessTokenHash: `pending:${attempt}`,
        checkoutKey: `draft-${draft.id}-${attempt}`,
        paymentProvider:
          destination?.provider ?? (actorUserId && draft.total > 0 ? MANUAL_PAYMENT : 'none'),
        note: draft.note,
        // Paying online holds stock for the usual window; a manual completion is paid at once.
        expiresAt:
          actorUserId === null
            ? new Date(Date.now() + this.env.ORDER_PAYMENT_TIMEOUT_MINUTES * 60_000)
            : null,
        // Already handled: an unpaid invoice is followed up by the merchant, not by recovery email.
        recoveryStatus: 'SKIPPED',
        lines: {
          create: lines.map((l, i) => ({
            productId: l.productId && live.has(l.variantId ?? '') ? l.productId : null,
            variantId: l.variantId && live.has(l.variantId) ? l.variantId : null,
            title: l.title,
            variantTitle: l.variantTitle,
            sku: l.sku,
            unitPrice: l.unitPrice,
            quantity: l.quantity,
            discountTotal: pricing.lineDiscounts[i] ?? 0,
            taxable: l.taxable,
            requiresShipping: l.requiresShipping,
            weightGrams: l.weightGrams,
            stockReserved: l.variantId !== null && tracked.has(l.variantId),
          })),
        },
      },
      include: { lines: true },
    });
    await tx.order.update({
      where: { id: order.id },
      data: { accessTokenHash: this.urls.orderAccessTokenHash(order.id) },
    });
    await this.lifecycle.reserveStock(tx, storeId, order.id, order.lines);
    await tx.draftOrder.update({ where: { id: draft.id }, data: { orderId: order.id } });
    await this.lifecycle.event(
      tx,
      storeId,
      order.id,
      'placed',
      `Order created from draft #D${draft.number}.`,
      { actorUserId },
    );
    return order;
  }

  /** Locks a draft that may still change; refuses while its invoice is being paid. */
  private async lockEditable(tx: TenantTx, storeId: string, id: string): Promise<DraftOrder> {
    await tx.$queryRaw`SELECT id FROM "DraftOrder" WHERE id = ${id}::uuid AND "storeId" = ${storeId}::uuid FOR UPDATE`;
    const draft = await tx.draftOrder.findFirst({ where: { id, storeId } });
    if (!draft) throw new NotFoundException('Draft order not found.');
    if (draft.status === 'COMPLETED') {
      throw new ConflictException('This draft is already completed.');
    }
    if (draft.orderId) {
      const paying = await tx.order.count({
        where: { id: draft.orderId, storeId, status: 'PENDING_PAYMENT' },
      });
      if (paying > 0) {
        throw new ConflictException(
          'The customer is paying this invoice right now. Try again once the payment completes or expires.',
        );
      }
    }
    return draft;
  }

  private async find(tx: TenantTx, storeId: string, id: string): Promise<DraftWithOrder> {
    const draft = await tx.draftOrder.findFirst({
      where: { id, storeId },
      include: { order: { select: { id: true, number: true, status: true } } },
    });
    if (!draft) throw new NotFoundException('Draft order not found.');
    return draft;
  }

  private toDto(draft: DraftWithOrder): DraftOrderDto {
    const lines = storedLines.parse(draft.lines);
    const pricing = this.pricing(draft, lines);
    const address = addressSchema.safeParse(draft.shippingAddress);
    return {
      id: draft.id,
      number: draft.number,
      status: draft.status,
      email: draft.email,
      customerId: draft.customerId,
      lines: lines.map((l, i) => ({ ...l, total: lineTotal(l, pricing.lineDiscounts[i] ?? 0) })),
      shippingAddress: address.success ? address.data : null,
      shipping: draft.shippingTitle
        ? { title: draft.shippingTitle, price: draft.shippingPrice }
        : null,
      discount: this.discountOf(draft),
      note: draft.note,
      currency: draft.currency,
      subtotal: draft.subtotal,
      discountTotal: draft.discountTotal,
      shippingTotal: draft.shippingTotal,
      taxTotal: draft.taxTotal,
      total: draft.total,
      order: draft.order,
      invoiceSentAt: draft.invoiceSentAt?.toISOString() ?? null,
      completedAt: draft.completedAt?.toISOString() ?? null,
      createdAt: draft.createdAt.toISOString(),
      updatedAt: draft.updatedAt.toISOString(),
    };
  }
}
