import type { IncomingHttpHeaders } from 'node:http';
import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { BillingOverview, ChangePlanResult } from '@repo/contracts';
import { type Plan, type PrismaClient, setTenant, type Subscription } from '@repo/db';
import { AuditService } from '../audit/audit.service.js';
import type { AuthUser, RequestMeta, StoreContext } from '../common/request.js';
import { ENV, type Env } from '../config/env.js';
import { PLATFORM_DB, TenantDb } from '../database/database.module.js';
import { BILLING_PROVIDER, type BillingProvider } from './billing-provider.js';
import { addDays, PlanLimits, PlansService, toPlanDto } from './plans.service.js';

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    private readonly tenantDb: TenantDb,
    private readonly plans: PlansService,
    private readonly limits: PlanLimits,
    private readonly audit: AuditService,
    @Inject(BILLING_PROVIDER) private readonly provider: BillingProvider,
    @Inject(PLATFORM_DB) private readonly platformDb: PrismaClient,
    @Inject(ENV) private readonly env: Env,
  ) {}

  overview(storeId: string): Promise<BillingOverview> {
    return this.tenantDb.run(storeId, async (tx) => {
      const subscription = await this.plans.subscriptionFor(storeId, tx);
      const [usage, plans, invoices, pendingPlan] = await Promise.all([
        this.plans.usage(tx, storeId),
        this.plans.list(true, tx),
        tx.platformInvoice.findMany({
          where: { storeId },
          orderBy: { createdAt: 'desc' },
          take: 24,
        }),
        subscription.pendingPlanId
          ? tx.plan.findUnique({ where: { id: subscription.pendingPlanId } })
          : null,
      ]);
      return {
        plan: toPlanDto(subscription.plan),
        status: subscription.status,
        currentPeriodEnd: subscription.currentPeriodEnd.toISOString(),
        trialEndsAt: subscription.trialEndsAt?.toISOString() ?? null,
        pendingPlan: pendingPlan ? toPlanDto(pendingPlan) : null,
        provider: subscription.provider,
        usage,
        plans: plans.map(toPlanDto),
        invoices: invoices.map((i) => ({
          id: i.id,
          planName: i.planName,
          amount: i.amount,
          currency: i.currency,
          status: i.status,
          periodStart: i.periodStart.toISOString(),
          periodEnd: i.periodEnd.toISOString(),
          createdAt: i.createdAt.toISOString(),
        })),
      };
    });
  }

  /**
   * Changes the store's plan. Downgrades must fit current usage. Free plans switch immediately;
   * paid plans go through the billing provider (immediate with the mock, hosted checkout with Stripe).
   */
  async changePlan(
    store: StoreContext,
    planId: string,
    actor: AuthUser,
    meta: RequestMeta,
  ): Promise<ChangePlanResult> {
    const plan = await this.platformDb.plan.findFirst({ where: { id: planId, active: true } });
    if (!plan) throw new NotFoundException('Plan not found.');

    const subscription = await this.tenantDb.run(store.id, async (tx) => {
      const current = await this.plans.subscriptionFor(store.id, tx);
      if (current.planId === plan.id)
        throw new BadRequestException('You are already on this plan.');
      await this.limits.assertUsageFits(tx, store.id, plan);
      return current;
    });

    if (plan.priceMonthly > 0) {
      const result = await this.provider.startSubscription({
        storeId: store.id,
        planId: plan.id,
        planName: plan.name,
        priceMonthly: plan.priceMonthly,
        email: actor.email,
        successUrl: `${this.env.ADMIN_PUBLIC_URL}/s/${store.id}/settings/billing?upgraded=1`,
        cancelUrl: `${this.env.ADMIN_PUBLIC_URL}/s/${store.id}/settings/billing`,
      });
      if (!result.activateNow) {
        return { checkoutUrl: result.checkoutUrl, billing: await this.overview(store.id) };
      }
    }

    await this.activate(store.id, subscription, plan, this.provider.name, null, actor, meta);
    return { checkoutUrl: null, billing: await this.overview(store.id) };
  }

  /** Puts `plan` into effect now, starting a new period (and a paid invoice for paid plans). */
  async activate(
    storeId: string,
    subscription: Subscription,
    plan: Plan,
    provider: string,
    providerRef: string | null,
    actor: AuthUser | null,
    meta?: RequestMeta,
  ): Promise<void> {
    const now = new Date();
    const periodEnd = addDays(now, this.plans.periodDays());
    await this.platformDb.$transaction(async (tx) => {
      await tx.subscription.update({
        where: { id: subscription.id },
        data: {
          planId: plan.id,
          status: 'ACTIVE',
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
          trialEndsAt: null,
          pendingPlanId: null,
          provider,
          providerRef: providerRef ?? subscription.providerRef,
        },
      });
      if (plan.priceMonthly > 0 && provider === 'mock') {
        await tx.platformInvoice.create({
          data: {
            storeId,
            subscriptionId: subscription.id,
            planName: plan.name,
            amount: plan.priceMonthly,
            status: 'PAID',
            periodStart: now,
            periodEnd,
          },
        });
      }
      await setTenant(tx, storeId);
      await this.audit.record(tx, {
        storeId,
        actorUserId: actor?.id ?? null,
        action: 'billing.plan_changed',
        entityType: 'subscription',
        entityId: subscription.id,
        data: { plan: plan.code },
        meta,
      });
    });
  }

  /** Renews due subscriptions (mock provider): ends trials, issues invoices, applies downgrades. */
  async renewDue(limit = 100): Promise<number> {
    const due = await this.platformDb.subscription.findMany({
      where: {
        currentPeriodEnd: { lt: new Date() },
        status: { in: ['TRIALING', 'ACTIVE'] },
        provider: 'mock',
      },
      include: { plan: true },
      take: limit,
    });
    for (const subscription of due) {
      const plan = subscription.pendingPlanId
        ? await this.platformDb.plan.findUniqueOrThrow({
            where: { id: subscription.pendingPlanId },
          })
        : subscription.plan;
      await this.activate(subscription.storeId, subscription, plan, 'mock', null, null);
    }
    return due.length;
  }

  /** Applies Stripe Billing webhooks (activation, renewals, cancellation). */
  async handleWebhook(
    rawBody: Buffer | undefined,
    headers: IncomingHttpHeaders,
  ): Promise<{ received: true }> {
    if (!rawBody) throw new BadRequestException('Missing body.');
    let outcome;
    try {
      outcome = this.provider.parseWebhook(rawBody, headers);
    } catch {
      throw new BadRequestException('Invalid webhook signature.');
    }
    const fresh = await this.platformDb.webhookEvent.createMany({
      data: [
        { provider: `billing-${this.provider.name}`, eventId: outcome.eventId, type: outcome.kind },
      ],
      skipDuplicates: true,
    });
    if (fresh.count === 0) return { received: true };

    if (outcome.kind === 'activated') {
      const [subscription, plan] = await Promise.all([
        this.plans.subscriptionFor(outcome.storeId, this.platformDb),
        this.platformDb.plan.findUniqueOrThrow({ where: { id: outcome.planId } }),
      ]);
      await this.activate(
        outcome.storeId,
        subscription,
        plan,
        this.provider.name,
        outcome.providerRef,
        null,
      );
    } else if (outcome.kind === 'invoice_paid') {
      const subscription = await this.platformDb.subscription.findFirst({
        where: { providerRef: outcome.providerRef },
        include: { plan: true },
      });
      if (subscription) {
        await this.platformDb.platformInvoice.create({
          data: {
            storeId: subscription.storeId,
            subscriptionId: subscription.id,
            planName: subscription.plan.name,
            amount: outcome.amount,
            currency: outcome.currency,
            status: 'PAID',
            periodStart: subscription.currentPeriodStart,
            periodEnd: subscription.currentPeriodEnd,
            providerRef: outcome.eventId,
          },
        });
      }
    } else if (outcome.kind === 'cancelled') {
      const subscription = await this.platformDb.subscription.findFirst({
        where: { providerRef: outcome.providerRef },
      });
      if (subscription) {
        const plan = await this.plans.defaultPlan(this.platformDb);
        await this.activate(subscription.storeId, subscription, plan, 'mock', null, null);
        this.logger.log(`Store ${subscription.storeId} downgraded after subscription cancellation`);
      }
    }
    return { received: true };
  }
}
