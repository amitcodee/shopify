import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpException,
  Inject,
  Injectable,
  Logger,
  Optional,
  Post,
  ServiceUnavailableException,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  confirmTemplatePurchaseInputSchema,
  PREMIUM_STYLES,
  type PremiumStyleId,
  type PremiumTemplate,
  premiumStyleOf,
  type PurchaseTemplateResult,
  purchaseTemplateInputSchema,
  TEMPLATE_NOT_OWNED,
  type TemplatePurchaseRecord,
} from '@repo/contracts';
import type { PrismaClient } from '@repo/db';
import type { z } from 'zod';
import { AuditService } from '../audit/audit.service.js';
import type { AuthUser, RequestMeta, StoreContext } from '../common/request.js';
import { CurrentStore, CurrentUser, ReqMeta } from '../common/request.js';
import { ApiZodBody, ZodPipe } from '../common/zod.js';
import { ENV, type Env } from '../config/env.js';
import { PLATFORM_DB, TenantDb } from '../database/database.module.js';
import {
  AllowBillingLocked,
  RequirePermission,
  StoreAccessGuard,
} from '../tenancy/store-access.guard.js';
import { RAZORPAY_BILLING, type RazorpayBilling } from './razorpay-billing.js';

/** HTTP 402 when a store applies a premium template it has not bought. */
export class TemplateNotOwnedException extends HttpException {
  constructor(label: string) {
    super(
      {
        title: 'Premium template',
        code: TEMPLATE_NOT_OWNED,
        detail: `“${label}” is a premium design. Buy it once for this store, then apply it.`,
      },
      402,
    );
  }
}

const styleById = (id: string) => PREMIUM_STYLES.find((s) => s.id === id);

/**
 * One-time purchases of premium template styles, charged on the platform's Razorpay account.
 * Without Razorpay (development, BILLING_PROVIDER=mock) a purchase completes at once; production
 * refuses the mock provider at boot.
 */
@Injectable()
export class TemplatePurchasesService {
  private readonly logger = new Logger(TemplatePurchasesService.name);

  constructor(
    @Inject(PLATFORM_DB) private readonly db: PrismaClient,
    private readonly tenantDb: TenantDb,
    private readonly audit: AuditService,
    @Inject(ENV) private readonly env: Env,
    @Optional() @Inject(RAZORPAY_BILLING) private readonly razorpay: RazorpayBilling | null = null,
  ) {}

  private async ownedStyles(storeId: string): Promise<Map<string, Date>> {
    const rows = await this.db.templatePurchase.findMany({
      where: { storeId, status: 'PAID' },
      select: { styleId: true, paidAt: true },
    });
    return new Map(rows.map((r) => [r.styleId, r.paidAt ?? new Date(0)]));
  }

  async list(storeId: string): Promise<PremiumTemplate[]> {
    const owned = await this.ownedStyles(storeId);
    return PREMIUM_STYLES.map((s) => ({
      styleId: s.id,
      label: s.label,
      description: s.description,
      price: s.premium.price,
      currency: 'INR' as const,
      owned: owned.has(s.id),
      purchasedAt: owned.get(s.id)?.toISOString() ?? null,
    }));
  }

  async history(storeId: string): Promise<TemplatePurchaseRecord[]> {
    const rows = await this.db.templatePurchase.findMany({
      where: { storeId, status: 'PAID' },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => ({
      id: r.id,
      styleId: r.styleId,
      styleLabel: r.styleLabel,
      amount: r.amount,
      currency: r.currency,
      status: r.status as TemplatePurchaseRecord['status'],
      createdAt: r.createdAt.toISOString(),
      paidAt: r.paidAt?.toISOString() ?? null,
    }));
  }

  /** Throws 402 when `template` (a template id / settings.template) is premium and not owned. */
  async assertCanApply(storeId: string, template: string): Promise<void> {
    const styleId = premiumStyleOf(template);
    if (!styleId) return;
    const paid = await this.db.templatePurchase.findFirst({
      where: { storeId, styleId, status: 'PAID' },
      select: { id: true },
    });
    if (!paid) throw new TemplateNotOwnedException(styleById(styleId)?.label ?? styleId);
  }

  async start(
    store: StoreContext,
    styleId: PremiumStyleId,
    actor: AuthUser,
    meta: RequestMeta,
  ): Promise<PurchaseTemplateResult> {
    const style = styleById(styleId);
    if (!style) throw new BadRequestException('Unknown premium template.');
    if ((await this.ownedStyles(store.id)).has(styleId)) return { status: 'owned' };

    if (!this.razorpay) {
      if (this.env.BILLING_PROVIDER !== 'mock') {
        throw new ServiceUnavailableException('Template purchases are not available right now.');
      }
      const purchase = await this.db.templatePurchase.create({
        data: {
          storeId: store.id,
          styleId,
          styleLabel: style.label,
          amount: style.premium.price,
          provider: 'mock',
          status: 'PAID',
          paidAt: new Date(),
          purchasedById: actor.id,
        },
      });
      await this.recordAudit(store.id, purchase.id, styleId, actor, meta);
      return { status: 'owned' };
    }

    const order = await this.razorpay.createOrder({
      amount: style.premium.price,
      currency: 'INR',
      receipt: `tpl_${store.id.slice(0, 8)}_${styleId}`.slice(0, 40),
      notes: { kind: 'template', storeId: store.id, styleId },
    });
    await this.db.templatePurchase.create({
      data: {
        storeId: store.id,
        styleId,
        styleLabel: style.label,
        amount: style.premium.price,
        provider: 'razorpay',
        providerOrderId: order.id,
        purchasedById: actor.id,
      },
    });
    return {
      status: 'checkout',
      checkout: {
        keyId: this.razorpay.keyId,
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        name: 'Commerce Platform',
        description: `${style.label} premium template (one-time)`,
        email: actor.email,
      },
    };
  }

  /** Checkout success callback: verify the signature, then mark the order paid. */
  async confirm(
    store: StoreContext,
    input: z.output<typeof confirmTemplatePurchaseInputSchema>,
    actor: AuthUser,
    meta: RequestMeta,
  ): Promise<PremiumTemplate[]> {
    if (!this.razorpay) throw new BadRequestException('Nothing to confirm.');
    const purchase = await this.db.templatePurchase.findUnique({
      where: { providerOrderId: input.orderId },
    });
    if (!purchase || purchase.storeId !== store.id) {
      throw new BadRequestException('Unknown order.');
    }
    if (!this.razorpay.verifyOrderPayment(input.orderId, input.paymentId, input.signature)) {
      throw new BadRequestException('The payment could not be verified.');
    }
    if (await this.markPaid(input.orderId, input.paymentId)) {
      await this.recordAudit(store.id, purchase.id, purchase.styleId, actor, meta);
    }
    return this.list(store.id);
  }

  /** From the `order.paid` webhook: re-reads the order from Razorpay before trusting it. */
  async handleOrderPaid(orderId: string, paymentId: string | undefined): Promise<void> {
    if (!this.razorpay) return;
    const purchase = await this.db.templatePurchase.findUnique({
      where: { providerOrderId: orderId },
    });
    if (!purchase || purchase.status === 'PAID') return;
    const order = await this.razorpay.fetchOrder(orderId);
    if (order.status !== 'paid' || order.amount !== purchase.amount) {
      this.logger.warn(`Order ${orderId} is ${order.status}; not marking the template paid`);
      return;
    }
    await this.markPaid(orderId, paymentId ?? null);
  }

  /** True when this call moved the purchase to PAID. */
  private async markPaid(orderId: string, paymentId: string | null): Promise<boolean> {
    try {
      const { count } = await this.db.templatePurchase.updateMany({
        where: { providerOrderId: orderId, status: { not: 'PAID' } },
        data: { status: 'PAID', providerPaymentId: paymentId, paidAt: new Date() },
      });
      return count > 0;
    } catch (error) {
      // The partial unique index refuses a second paid row for the same store and style.
      this.logger.warn(`Duplicate template payment on order ${orderId}: ${String(error)}`);
      return false;
    }
  }

  private recordAudit(
    storeId: string,
    purchaseId: string,
    styleId: string,
    actor: AuthUser,
    meta: RequestMeta,
  ): Promise<void> {
    return this.tenantDb.run(storeId, async (tx) => {
      await this.audit.record(tx, {
        storeId,
        actorUserId: actor.id,
        action: 'template.purchased',
        entityType: 'template',
        entityId: purchaseId,
        data: { styleId },
        meta,
      });
    });
  }
}

@ApiTags('Online store')
@ApiBearerAuth()
@UseGuards(StoreAccessGuard)
@AllowBillingLocked()
@Controller('admin/stores/:storeId/premium-templates')
export class TemplatePurchasesController {
  constructor(private readonly purchases: TemplatePurchasesService) {}

  @Get()
  @RequirePermission('settings:read')
  list(@CurrentStore() store: StoreContext): Promise<PremiumTemplate[]> {
    return this.purchases.list(store.id);
  }

  @Get('purchases')
  @RequirePermission('settings:read')
  purchaseHistory(@CurrentStore() store: StoreContext): Promise<TemplatePurchaseRecord[]> {
    return this.purchases.history(store.id);
  }

  @Post('purchases')
  @HttpCode(200)
  @RequirePermission('billing:manage')
  @ApiZodBody(purchaseTemplateInputSchema)
  buy(
    @CurrentStore() store: StoreContext,
    @CurrentUser() user: AuthUser,
    @Body(new ZodPipe(purchaseTemplateInputSchema))
    body: z.output<typeof purchaseTemplateInputSchema>,
    @ReqMeta() meta: RequestMeta,
  ): Promise<PurchaseTemplateResult> {
    return this.purchases.start(store, body.styleId, user, meta);
  }

  @Post('purchases/confirm')
  @HttpCode(200)
  @RequirePermission('billing:manage')
  @ApiZodBody(confirmTemplatePurchaseInputSchema)
  confirm(
    @CurrentStore() store: StoreContext,
    @CurrentUser() user: AuthUser,
    @Body(new ZodPipe(confirmTemplatePurchaseInputSchema))
    body: z.output<typeof confirmTemplatePurchaseInputSchema>,
    @ReqMeta() meta: RequestMeta,
  ): Promise<PremiumTemplate[]> {
    return this.purchases.confirm(store, body, user, meta);
  }
}
