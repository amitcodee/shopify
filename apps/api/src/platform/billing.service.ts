import type { IncomingHttpHeaders } from 'node:http';
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { BillingOverview, ChangePlanResult } from '@repo/contracts';
import {
  type Plan,
  Prisma,
  type PrismaClient,
  setTenant,
  type Subscription,
  type SubscriptionStatus,
} from '@repo/db';
import { AuditService } from '../audit/audit.service.js';
import type { AuthUser, RequestMeta, StoreContext } from '../common/request.js';
import { ENV, type Env } from '../config/env.js';
import { PLATFORM_DB, TenantDb } from '../database/database.module.js';
import { RazorpayError } from '../payments/razorpay/razorpay-client.js';
import { BILLING_PROVIDER, type BillingProvider } from './billing-provider.js';
import { addDays, billingState, PlanLimits, PlansService, toPlanDto } from './plans.service.js';
import {
  RAZORPAY_BILLING,
  type RazorpayBilling,
  type RazorpayPlanIds,
  type RazorpaySubscription,
  subscriptionNotes,
} from './razorpay-billing.js';

/** Regular subscriptions run for 10 years of monthly charges (Razorpay needs a count). */
const REGULAR_TOTAL_COUNT = 120;
/** A start date closer than this is treated as "start now" (Razorpay rejects past start_at). */
const MIN_FUTURE_START_MS = 10 * 60_000;

type SubscriptionWithPlan = Subscription & { plan: Plan };

const fromUnix = (seconds: number | null | undefined): Date | null =>
  seconds ? new Date(seconds * 1000) : null;

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
    @Optional() @Inject(RAZORPAY_BILLING) private readonly razorpay: RazorpayBilling | null = null,
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
      const state = billingState(subscription);
      const plan = subscription.plan;
      return {
        plan: toPlanDto(plan),
        status: subscription.status,
        currentPeriodEnd: subscription.currentPeriodEnd.toISOString(),
        trialEndsAt: subscription.trialEndsAt?.toISOString() ?? null,
        pendingPlan: pendingPlan ? toPlanDto(pendingPlan) : null,
        provider: subscription.provider,
        locked: state.locked,
        graceEndsAt: subscription.graceEndsAt?.toISOString() ?? null,
        cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
        introAvailable: !subscription.introUsed && hasIntro(plan),
        onIntroPrice:
          subscription.providerPhase === 'intro' ||
          (subscription.introUsed &&
            subscription.status === 'ACTIVE' &&
            invoices.filter((i) => i.status === 'PAID').length <= plan.introCycles &&
            hasIntro(plan)),
        action: state.action,
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
   * Subscribes the store to `planId` (or changes plan). Downgrades must fit current usage.
   * Razorpay: returns a Checkout session for the merchant to authorise a UPI/card mandate; the
   * trial days left are kept (the first charge happens when the trial ends). Stripe: hosted page.
   * Mock (development only): takes effect at once with a paid invoice.
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
      const state = billingState(current);
      if (current.planId === plan.id && state.action === null && !current.cancelAtPeriodEnd) {
        throw new BadRequestException('You are already subscribed to this plan.');
      }
      await this.limits.assertUsageFits(tx, store.id, plan);
      return current;
    });

    if (this.env.BILLING_PROVIDER === 'razorpay') {
      return this.startRazorpay(store, subscription, plan, actor, meta);
    }

    if (plan.priceMonthly > 0) {
      const result = await this.provider.startSubscription({
        storeId: store.id,
        planId: plan.id,
        planName: plan.name,
        priceMonthly: plan.priceMonthly,
        currency: plan.currency,
        email: actor.email,
        successUrl: `${this.env.ADMIN_PUBLIC_URL}/s/${store.id}/settings/billing?upgraded=1`,
        cancelUrl: `${this.env.ADMIN_PUBLIC_URL}/s/${store.id}/settings/billing`,
      });
      if (!result.activateNow) {
        return {
          checkoutUrl: result.checkoutUrl,
          checkout: null,
          billing: await this.overview(store.id),
        };
      }
    }

    await this.activate(store.id, subscription, plan, this.provider.name, null, actor, meta);
    return { checkoutUrl: null, checkout: null, billing: await this.overview(store.id) };
  }

  /** Puts `plan` into effect now, starting a new period (and a paid invoice for mock billing). */
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
    const intro = provider === 'mock' && hasIntro(plan) && !subscription.introUsed;
    await this.platformDb.$transaction(async (tx) => {
      const paidMockInvoices =
        provider === 'mock'
          ? await tx.platformInvoice.count({
              where: { subscriptionId: subscription.id, status: 'PAID' },
            })
          : 0;
      await tx.subscription.update({
        where: { id: subscription.id },
        data: {
          planId: plan.id,
          status: 'ACTIVE',
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
          trialEndsAt: null,
          pendingPlanId: null,
          graceEndsAt: null,
          cancelAtPeriodEnd: false,
          provider,
          providerRef: providerRef ?? subscription.providerRef,
          providerPhase: null,
          introUsed: subscription.introUsed || intro,
        },
      });
      if (plan.priceMonthly > 0 && provider === 'mock') {
        const onIntro = hasIntro(plan) && (intro || paidMockInvoices < plan.introCycles);
        await tx.platformInvoice.create({
          data: {
            storeId,
            subscriptionId: subscription.id,
            planName: plan.name,
            amount: onIntro && plan.introPrice !== null ? plan.introPrice : plan.priceMonthly,
            currency: plan.currency,
            status: 'PAID',
            periodStart: now,
            periodEnd,
          },
        });
      }
      await tx.store.update({ where: { id: storeId }, data: { billingLocked: false } });
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

  // ── Razorpay ────────────────────────────────────────────────────────────────

  private requireRazorpay(): RazorpayBilling {
    if (!this.razorpay) throw new ServiceUnavailableException('Billing is not configured.');
    return this.razorpay;
  }

  /** Razorpay plan ids for `plan` under the current API key, created on first use. */
  private async razorpayPlans(
    plan: Plan,
  ): Promise<Required<Pick<RazorpayPlanIds, 'regular'>> & RazorpayPlanIds> {
    const razorpay = this.requireRazorpay();
    const all = (plan.providerPlans ?? {}) as Record<string, RazorpayPlanIds>;
    const ids: RazorpayPlanIds = { ...all[razorpay.keyId] };
    if (!ids.regular) {
      ids.regular = await razorpay.createPlan({
        name: `${plan.name} plan`,
        amount: plan.priceMonthly,
        currency: plan.currency,
        planId: plan.id,
        kind: 'regular',
      });
    }
    if (hasIntro(plan) && !plan.razorpayOfferId && !ids.intro && plan.introPrice !== null) {
      ids.intro = await razorpay.createPlan({
        name: `${plan.name} plan (intro)`,
        amount: plan.introPrice,
        currency: plan.currency,
        planId: plan.id,
        kind: 'intro',
      });
    }
    if (ids.regular !== all[razorpay.keyId]?.regular || ids.intro !== all[razorpay.keyId]?.intro) {
      await this.platformDb.plan.update({
        where: { id: plan.id },
        data: { providerPlans: { ...all, [razorpay.keyId]: ids } as Prisma.InputJsonValue },
      });
    }
    return ids as Required<Pick<RazorpayPlanIds, 'regular'>> & RazorpayPlanIds;
  }

  private async startRazorpay(
    store: StoreContext,
    subscription: SubscriptionWithPlan,
    plan: Plan,
    actor: AuthUser,
    meta: RequestMeta,
  ): Promise<ChangePlanResult> {
    const razorpay = this.requireRazorpay();
    if (plan.priceMonthly <= 0) {
      await this.activate(store.id, subscription, plan, 'manual', null, actor, meta);
      return { checkoutUrl: null, checkout: null, billing: await this.overview(store.id) };
    }

    // An earlier, never-authorised checkout for the same plan is reused instead of piling up
    // abandoned subscriptions in Razorpay.
    if (subscription.provider === 'razorpay' && subscription.providerRef) {
      const existing = await razorpay.fetchSubscription(subscription.providerRef);
      const notes = subscriptionNotes(existing);
      if (existing.status === 'created' && notes.planId === plan.id) {
        return this.checkoutResult(store.id, existing, plan, actor);
      }
    }

    const now = Date.now();
    const state = billingState(subscription);
    // Keep what the merchant already has: the rest of the trial, or the paid period.
    const keepUntil =
      subscription.status === 'TRIALING'
        ? subscription.trialEndsAt
        : !state.locked && subscription.status !== 'EXPIRED'
          ? subscription.currentPeriodEnd
          : null;
    const startAt = keepUntil && keepUntil.getTime() - now > MIN_FUTURE_START_MS ? keepUntil : null;

    const ids = await this.razorpayPlans(plan);
    const intro = hasIntro(plan) && !subscription.introUsed;
    const phase: 'intro' | 'regular' = intro && !plan.razorpayOfferId ? 'intro' : 'regular';
    let created: RazorpaySubscription;
    try {
      created = await razorpay.createSubscription({
        razorpayPlanId: phase === 'intro' && ids.intro ? ids.intro : ids.regular,
        totalCount: phase === 'intro' ? plan.introCycles : REGULAR_TOTAL_COUNT,
        startAt,
        offerId: intro && plan.razorpayOfferId ? plan.razorpayOfferId : null,
        notes: { storeId: store.id, planId: plan.id, phase },
      });
    } catch (error) {
      if (error instanceof RazorpayError && error.status < 500) {
        this.logger.warn(`Razorpay rejected a subscription for ${store.id}: ${error.message}`);
        throw new BadRequestException(
          'The payment provider could not start the subscription. Please try again or contact support.',
        );
      }
      throw error;
    }

    // Only a subscription that is not live yet may be replaced; a live mandate keeps billing
    // until the new one is authorised (then it is cancelled, see `applyRazorpay`).
    const live =
      subscription.provider === 'razorpay' &&
      subscription.providerRef &&
      subscription.providerPhase !== 'pending_auth';
    if (!live) {
      await this.platformDb.subscription.update({
        where: { id: subscription.id },
        data: { provider: 'razorpay', providerRef: created.id, providerPhase: 'pending_auth' },
      });
    }
    await this.tenantDb.run(store.id, (tx) =>
      this.audit.record(tx, {
        storeId: store.id,
        actorUserId: actor.id,
        action: 'billing.checkout_started',
        entityType: 'subscription',
        entityId: subscription.id,
        data: { plan: plan.code, providerRef: created.id, phase },
        meta,
      }),
    );
    return this.checkoutResult(store.id, created, plan, actor);
  }

  private async checkoutResult(
    storeId: string,
    remote: RazorpaySubscription,
    plan: Plan,
    actor: AuthUser,
  ): Promise<ChangePlanResult> {
    const notes = subscriptionNotes(remote);
    const price = (amount: number) =>
      new Intl.NumberFormat('en-IN', { style: 'currency', currency: plan.currency }).format(
        amount / 100,
      );
    const description =
      notes.phase === 'intro' && plan.introPrice !== null
        ? `${price(plan.introPrice)}/month for ${plan.introCycles} months`
        : remote.offer_id && plan.introPrice !== null
          ? `${price(plan.introPrice)}/month for ${plan.introCycles} months, then ${price(plan.priceMonthly)}/month`
          : `${price(plan.priceMonthly)}/month`;
    return {
      checkoutUrl: null,
      checkout: {
        provider: 'razorpay',
        keyId: this.requireRazorpay().keyId,
        subscriptionId: remote.id,
        shortUrl: remote.short_url,
        name: `${plan.name} plan`,
        description,
        email: actor.email,
      },
      billing: await this.overview(storeId),
    };
  }

  /**
   * Razorpay Checkout's success callback. The signature proves the payment belongs to the
   * subscription; the subscription's notes must name this store.
   */
  async confirmRazorpay(
    store: StoreContext,
    input: { paymentId: string; subscriptionId: string; signature: string },
    actor: AuthUser,
    meta: RequestMeta,
  ): Promise<BillingOverview> {
    const razorpay = this.requireRazorpay();
    if (!razorpay.verifyCheckout(input.paymentId, input.subscriptionId, input.signature)) {
      throw new BadRequestException('The payment could not be verified.');
    }
    const remote = await razorpay.fetchSubscription(input.subscriptionId);
    if (subscriptionNotes(remote).storeId !== store.id) {
      throw new NotFoundException('Subscription not found.');
    }
    await this.applyRazorpay(remote);
    await this.tenantDb.run(store.id, (tx) =>
      this.audit.record(tx, {
        storeId: store.id,
        actorUserId: actor.id,
        action: 'billing.subscription_authorized',
        entityType: 'subscription',
        entityId: remote.id,
        data: { status: remote.status },
        meta,
      }),
    );
    return this.overview(store.id);
  }

  /** Fetches the store's subscription from Razorpay and applies it (also run by the sweep). */
  async syncRazorpay(storeId: string): Promise<void> {
    const sub = await this.platformDb.subscription.findUnique({ where: { storeId } });
    if (!sub || sub.provider !== 'razorpay' || !sub.providerRef || !this.razorpay) return;
    await this.applyRazorpay(await this.razorpay.fetchSubscription(sub.providerRef));
  }

  /**
   * Maps a Razorpay subscription onto ours. Idempotent: webhooks, the Checkout callback and the
   * sweep all end up here with the latest state fetched from Razorpay.
   */
  async applyRazorpay(remote: RazorpaySubscription): Promise<void> {
    const notes = subscriptionNotes(remote);
    if (!notes.storeId) return;
    const sub = await this.platformDb.subscription.findUnique({
      where: { storeId: notes.storeId },
      include: { plan: true },
    });
    if (!sub) return;
    const isCurrent = sub.providerRef === remote.id;
    const now = new Date();
    const targetPlan =
      notes.planId && notes.planId !== sub.planId
        ? await this.platformDb.plan.findUnique({ where: { id: notes.planId } })
        : sub.plan;
    const plan = targetPlan ?? sub.plan;

    const authorised = ['authenticated', 'active', 'pending', 'halted'].includes(remote.status);
    // A new mandate replaced an older live one (plan change): stop billing the old one.
    if (authorised && !isCurrent && sub.provider === 'razorpay' && sub.providerRef) {
      if (sub.providerPhase !== 'pending_auth') {
        await this.razorpay?.cancelSubscription(sub.providerRef, false).catch((error: unknown) => {
          this.logger.warn(
            `Could not cancel replaced subscription ${sub.providerRef}: ${String(error)}`,
          );
        });
      }
    } else if (!isCurrent) {
      return; // A stale or abandoned subscription: nothing to apply.
    }

    const data: Prisma.SubscriptionUncheckedUpdateInput = { lastSyncedAt: now };
    if (authorised) {
      data.provider = 'razorpay';
      data.providerRef = remote.id;
      data.providerPhase = notes.phase ?? 'regular';
      data.planId = plan.id;
      data.pendingPlanId = null;
      if (notes.phase === 'intro' || remote.offer_id) data.introUsed = true;
    }
    const periodStart = fromUnix(remote.current_start);
    const periodEnd = fromUnix(remote.current_end);
    let status: SubscriptionStatus | undefined;
    switch (remote.status) {
      case 'authenticated':
        // Authorised, first charge at start_at (the end of the trial).
        if (sub.status === 'EXPIRED' || sub.status === 'CANCELLED') status = 'ACTIVE';
        if (sub.status === 'TRIALING' && remote.start_at) {
          data.trialEndsAt = fromUnix(remote.start_at);
          data.currentPeriodEnd = fromUnix(remote.start_at)!;
        }
        data.graceEndsAt = null;
        data.cancelAtPeriodEnd = false;
        break;
      case 'active':
        status = 'ACTIVE';
        if (periodStart) data.currentPeriodStart = periodStart;
        if (periodEnd) data.currentPeriodEnd = periodEnd;
        data.trialEndsAt = null;
        data.graceEndsAt = null;
        break;
      case 'pending':
      case 'halted':
        // Razorpay keeps retrying while pending; halted means retries ran out. Either way the
        // store keeps working until the grace period ends, then billing locks it.
        status = 'PAST_DUE';
        data.graceEndsAt = sub.graceEndsAt ?? addDays(now, this.env.BILLING_GRACE_DAYS);
        break;
      case 'cancelled':
        status = sub.status === 'TRIALING' ? 'EXPIRED' : 'CANCELLED';
        data.cancelAtPeriodEnd = false;
        break;
      case 'completed':
        if (notes.phase === 'intro') {
          // The intro months are over: start the regular plan on a new mandate. The merchant
          // authorises it once; until then the paid period runs out normally.
          data.introUsed = true;
          await this.platformDb.subscription.update({ where: { id: sub.id }, data });
          await this.continueAfterIntro(sub.storeId, plan, periodEnd);
          await this.refreshLock(sub.storeId);
          return;
        }
        status = 'CANCELLED';
        break;
      case 'expired':
        // Never authorised before its start date.
        if (sub.status === 'TRIALING') status = 'EXPIRED';
        break;
      default:
        break;
    }
    if (status) data.status = status;
    await this.platformDb.subscription.update({ where: { id: sub.id }, data });
    await this.recordRazorpayInvoices(sub.id, sub.storeId, plan, remote.id);
    await this.refreshLock(sub.storeId);
  }

  private async continueAfterIntro(storeId: string, plan: Plan, periodEnd: Date | null) {
    const razorpay = this.requireRazorpay();
    const ids = await this.razorpayPlans(plan);
    const startAt =
      periodEnd && periodEnd.getTime() - Date.now() > MIN_FUTURE_START_MS ? periodEnd : null;
    const next = await razorpay.createSubscription({
      razorpayPlanId: ids.regular,
      totalCount: REGULAR_TOTAL_COUNT,
      startAt,
      offerId: null,
      notes: { storeId, planId: plan.id, phase: 'regular' },
    });
    await this.platformDb.subscription.update({
      where: { storeId },
      data: { providerRef: next.id, providerPhase: 'pending_auth' },
    });
    this.logger.log(
      `Store ${storeId} finished its intro months; regular mandate ${next.id} awaits authorisation`,
    );
  }

  /** Copies Razorpay's paid invoices for a subscription into our invoice history (idempotent). */
  private async recordRazorpayInvoices(
    subscriptionId: string,
    storeId: string,
    plan: Plan,
    razorpaySubscriptionId: string,
  ): Promise<void> {
    if (!this.razorpay) return;
    const invoices = await this.razorpay.listInvoices(razorpaySubscriptionId).catch(() => []);
    for (const invoice of invoices) {
      if (invoice.status !== 'paid' || invoice.amount_paid <= 0) continue;
      await this.platformDb.platformInvoice.upsert({
        where: { providerRef: invoice.id },
        update: {},
        create: {
          storeId,
          subscriptionId,
          planName: plan.name,
          amount: invoice.amount_paid,
          currency: invoice.currency.toUpperCase(),
          status: 'PAID',
          periodStart: fromUnix(invoice.billing_start) ?? fromUnix(invoice.paid_at) ?? new Date(),
          periodEnd: fromUnix(invoice.billing_end) ?? addDays(new Date(), this.plans.periodDays()),
          providerRef: invoice.id,
        },
      });
    }
  }

  /** Stops billing at the end of the paid period (or ends the trial subscription right away). */
  async cancel(store: StoreContext, actor: AuthUser, meta: RequestMeta): Promise<BillingOverview> {
    const sub = await this.plans.subscriptionFor(store.id, this.platformDb);
    if (sub.provider === 'none' || sub.status === 'EXPIRED' || sub.status === 'CANCELLED') {
      throw new ConflictException('There is no active subscription to cancel.');
    }
    if (sub.provider === 'razorpay' && sub.providerRef) {
      const razorpay = this.requireRazorpay();
      const remote = await razorpay.fetchSubscription(sub.providerRef);
      // Only an active (charged) subscription can end at cycle end; one that is still in its
      // trial or awaiting authorisation is cancelled outright.
      const atCycleEnd = remote.status === 'active';
      if (!['cancelled', 'completed', 'expired'].includes(remote.status)) {
        await razorpay.cancelSubscription(sub.providerRef, atCycleEnd);
      }
    }
    await this.platformDb.subscription.update({
      where: { id: sub.id },
      data:
        sub.status === 'TRIALING'
          ? { provider: 'none', providerRef: null, providerPhase: null }
          : { cancelAtPeriodEnd: true },
    });
    await this.tenantDb.run(store.id, (tx) =>
      this.audit.record(tx, {
        storeId: store.id,
        actorUserId: actor.id,
        action: 'billing.cancelled',
        entityType: 'subscription',
        entityId: sub.id,
        meta,
      }),
    );
    return this.overview(store.id);
  }

  /** The owner closed the store: stop charging now. A paid period stays valid if they reopen. */
  async endForClosure(storeId: string): Promise<void> {
    const sub = await this.platformDb.subscription.findUnique({ where: { storeId } });
    if (!sub) return;
    if (sub.provider === 'razorpay' && sub.providerRef && this.razorpay) {
      const remote = await this.razorpay.fetchSubscription(sub.providerRef);
      if (!['cancelled', 'completed', 'expired'].includes(remote.status)) {
        await this.razorpay.cancelSubscription(sub.providerRef, false);
      }
    }
    await this.platformDb.subscription.update({
      where: { id: sub.id },
      data:
        sub.status === 'TRIALING'
          ? { provider: 'none', providerRef: null, providerPhase: null }
          : sub.status === 'EXPIRED'
            ? {}
            : { status: 'CANCELLED', cancelAtPeriodEnd: false, providerPhase: null },
    });
  }

  /** Recomputes `Store.billingLocked` from the subscription (storefront offline when locked). */
  async refreshLock(storeId: string): Promise<boolean> {
    const sub = await this.platformDb.subscription.findUnique({ where: { storeId } });
    if (!sub) return false;
    const { locked } = billingState(sub);
    await this.platformDb.store.updateMany({
      where: { id: storeId, billingLocked: !locked },
      data: { billingLocked: locked },
    });
    return locked;
  }

  /**
   * Periodic billing sweep: ends unpaid trials, renews mock subscriptions (development), applies
   * scheduled cancellations, re-syncs Razorpay subscriptions whose state may have moved without a
   * webhook reaching us, and keeps every store's lock in step.
   */
  async renewDue(limit = 100): Promise<number> {
    const now = new Date();
    let processed = 0;

    // 1. Trials that ended without a subscription.
    const endedTrials = await this.platformDb.subscription.findMany({
      where: { status: 'TRIALING', provider: 'none', trialEndsAt: { lt: now } },
      select: { id: true, storeId: true },
      take: limit,
    });
    for (const sub of endedTrials) {
      await this.platformDb.subscription.update({
        where: { id: sub.id },
        data: { status: 'EXPIRED' },
      });
      await this.refreshLock(sub.storeId);
      processed++;
    }

    // 2. Mock billing (development): renew paid periods; cancellations end at period end.
    const dueMock = await this.platformDb.subscription.findMany({
      where: { currentPeriodEnd: { lt: now }, status: 'ACTIVE', provider: 'mock' },
      include: { plan: true },
      take: limit,
    });
    for (const subscription of dueMock) {
      if (subscription.cancelAtPeriodEnd) {
        await this.platformDb.subscription.update({
          where: { id: subscription.id },
          data: { status: 'CANCELLED', cancelAtPeriodEnd: false },
        });
      } else {
        const plan = subscription.pendingPlanId
          ? await this.platformDb.plan.findUniqueOrThrow({
              where: { id: subscription.pendingPlanId },
            })
          : subscription.plan;
        await this.activate(subscription.storeId, subscription, plan, 'mock', null, null);
      }
      await this.refreshLock(subscription.storeId);
      processed++;
    }

    // 3. Razorpay: anything whose period ended, is failing, awaits a first charge, or has not
    //    been checked for a day.
    if (this.razorpay) {
      const stale = await this.platformDb.subscription.findMany({
        where: {
          provider: 'razorpay',
          providerRef: { not: null },
          OR: [
            { currentPeriodEnd: { lt: now } },
            { status: 'PAST_DUE' },
            { status: 'TRIALING', trialEndsAt: { lt: now } },
            { lastSyncedAt: null },
            { lastSyncedAt: { lt: addDays(now, -1) } },
          ],
        },
        select: { storeId: true },
        take: limit,
      });
      for (const sub of stale) {
        try {
          await this.syncRazorpay(sub.storeId);
        } catch (error) {
          this.logger.warn(`Billing sync failed for store ${sub.storeId}: ${String(error)}`);
        }
        processed++;
      }
    }

    // 4. Cancelled subscriptions whose paid period ran out.
    const lapsed = await this.platformDb.subscription.findMany({
      where: { status: 'CANCELLED', currentPeriodEnd: { lt: now } },
      select: { id: true, storeId: true },
      take: limit,
    });
    for (const sub of lapsed) {
      await this.platformDb.subscription.update({
        where: { id: sub.id },
        data: { status: 'EXPIRED' },
      });
      processed++;
    }

    // 5. Locks whose state flipped with time alone (grace periods, leeway).
    const candidates = await this.platformDb.subscription.findMany({
      where: {
        OR: [
          { status: { in: ['PAST_DUE', 'EXPIRED', 'CANCELLED'] } },
          { currentPeriodEnd: { lt: now } },
          { store: { billingLocked: true } },
        ],
      },
      select: { storeId: true },
      take: limit * 5,
    });
    for (const sub of candidates) await this.refreshLock(sub.storeId);
    return processed;
  }

  /** Applies billing webhooks (Stripe events or Razorpay subscription events). */
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
        // A successful retry clears dunning.
        await this.platformDb.subscription.update({
          where: { id: subscription.id },
          data: { status: 'ACTIVE', graceEndsAt: null },
        });
        await this.refreshLock(subscription.storeId);
      }
    } else if (outcome.kind === 'payment_failed') {
      const subscription = await this.platformDb.subscription.findFirst({
        where: { providerRef: outcome.providerRef },
      });
      if (subscription) {
        await this.platformDb.subscription.update({
          where: { id: subscription.id },
          data: {
            status: 'PAST_DUE',
            graceEndsAt:
              subscription.graceEndsAt ?? addDays(new Date(), this.env.BILLING_GRACE_DAYS),
          },
        });
        this.logger.warn(`Subscription payment failed for store ${subscription.storeId}`);
      }
    } else if (outcome.kind === 'cancelled') {
      const subscription = await this.platformDb.subscription.findFirst({
        where: { providerRef: outcome.providerRef },
      });
      if (subscription) {
        await this.platformDb.subscription.update({
          where: { id: subscription.id },
          data: { status: 'CANCELLED', cancelAtPeriodEnd: false },
        });
        await this.refreshLock(subscription.storeId);
        this.logger.log(`Store ${subscription.storeId} subscription cancelled`);
      }
    }
    return { received: true };
  }

  /** Razorpay subscription webhooks: re-fetch the subscription and apply it. */
  async handleRazorpayWebhook(
    rawBody: Buffer | undefined,
    headers: IncomingHttpHeaders,
  ): Promise<{ received: true }> {
    const razorpay = this.requireRazorpay();
    if (!rawBody) throw new BadRequestException('Missing body.');
    const signature = headers['x-razorpay-signature'];
    if (!razorpay.verifyWebhook(rawBody, Array.isArray(signature) ? signature[0] : signature)) {
      throw new BadRequestException('Invalid webhook signature.');
    }
    const event = JSON.parse(rawBody.toString('utf8')) as {
      event?: string;
      payload?: { subscription?: { entity?: { id?: string } } };
    };
    const eventIdHeader = headers['x-razorpay-event-id'];
    const eventId = Array.isArray(eventIdHeader) ? eventIdHeader[0] : eventIdHeader;
    const subscriptionId = event.payload?.subscription?.entity?.id;
    if (!event.event?.startsWith('subscription.') || !subscriptionId) return { received: true };
    if (eventId) {
      const fresh = await this.platformDb.webhookEvent.createMany({
        data: [{ provider: 'billing-razorpay', eventId, type: event.event }],
        skipDuplicates: true,
      });
      if (fresh.count === 0) return { received: true };
    }
    // The payload can be older than the subscription's real state; Razorpay's API is the truth.
    await this.applyRazorpay(await razorpay.fetchSubscription(subscriptionId));
    return { received: true };
  }
}

export function hasIntro(plan: Plan): boolean {
  return plan.introPrice !== null && plan.introCycles > 0 && plan.introPrice < plan.priceMonthly;
}
