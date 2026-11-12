import { HttpException, Inject, Injectable } from '@nestjs/common';
import type { BillingAction, Plan as PlanDto, PlanInput, Usage } from '@repo/contracts';
import { type Plan, Prisma, type PrismaClient, type Subscription, type TenantTx } from '@repo/db';
import { APP_DB } from '../database/database.module.js';

const PERIOD_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;
/** A paid period whose renewal we have not confirmed yet keeps working this long (sync lag). */
const RENEWAL_LEEWAY_MS = 2 * DAY_MS;

/**
 * Plans every platform starts with (idempotently created when the table is empty).
 *
 * One plan, INR, everything included: a 7-day free trial without a card, ₹99/month for the first
 * 3 months, then ₹799/month. No free-forever plan and no platform fee on sales: merchants pay a
 * flat subscription whichever gateway (or cash on delivery) they use, so revenue does not leak
 * through own gateways or COD. Operators can add tiers in the platform console.
 */
export const DEFAULT_PLANS: Required<PlanInput>[] = [
  {
    code: 'standard',
    name: 'Standard',
    priceMonthly: 79_900,
    currency: 'INR',
    trialDays: 7,
    introPrice: 9_900,
    introCycles: 3,
    razorpayOfferId: null,
    maxProducts: null,
    maxStaff: 5,
    maxOrdersPerMonth: null,
    transactionFeeBps: 0,
    active: true,
    sortOrder: 1,
  },
];

export interface BillingState {
  /** Storefront offline and admin limited to billing. */
  locked: boolean;
  action: BillingAction | null;
}

/**
 * Whether a subscription still entitles the store to run, and what the merchant must do next.
 * Pure (time is a parameter) so the sweep job, the guard and the billing page agree.
 */
export function billingState(sub: Subscription, now = new Date()): BillingState {
  const t = now.getTime();
  const subscribed = sub.provider !== 'none' && sub.providerPhase !== 'pending_auth';
  switch (sub.status) {
    case 'TRIALING': {
      const ends = (sub.trialEndsAt ?? sub.currentPeriodEnd).getTime();
      // A merchant who authorised a mandate is charged when the trial ends; give the first charge
      // time to land before locking.
      const locked = t > ends + (subscribed ? RENEWAL_LEEWAY_MS : 0);
      return { locked, action: subscribed ? null : 'subscribe' };
    }
    case 'ACTIVE': {
      const locked = t > sub.currentPeriodEnd.getTime() + RENEWAL_LEEWAY_MS;
      if (sub.providerPhase === 'pending_auth') return { locked, action: 'authorize' };
      if (sub.cancelAtPeriodEnd) return { locked, action: 'subscribe' };
      return { locked, action: locked ? 'subscribe' : null };
    }
    case 'PAST_DUE':
      return {
        locked: t > (sub.graceEndsAt ?? sub.currentPeriodEnd).getTime(),
        action: sub.providerPhase === 'pending_auth' ? 'authorize' : 'update_payment',
      };
    case 'CANCELLED':
      return { locked: t > sub.currentPeriodEnd.getTime(), action: 'subscribe' };
    case 'EXPIRED':
      return { locked: true, action: 'subscribe' };
  }
}

type Db = PrismaClient | TenantTx;

export function toPlanDto(p: Plan): PlanDto {
  return {
    id: p.id,
    code: p.code,
    name: p.name,
    priceMonthly: p.priceMonthly,
    currency: p.currency,
    trialDays: p.trialDays,
    introPrice: p.introPrice,
    introCycles: p.introCycles,
    razorpayOfferId: p.razorpayOfferId,
    maxProducts: p.maxProducts,
    maxStaff: p.maxStaff,
    maxOrdersPerMonth: p.maxOrdersPerMonth,
    transactionFeeBps: p.transactionFeeBps,
    active: p.active,
    isDefault: p.isDefault,
    sortOrder: p.sortOrder,
  };
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

export function startOfMonthUtc(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

/**
 * Orders that use up the monthly quota: paid ones, plus confirmed cash-on-delivery orders (they
 * are real sales even before the cash is marked received). Unpaid online checkouts and
 * unconfirmed or cancelled COD orders do not count, so nobody can exhaust a store's quota.
 */
export function countedOrdersWhere(storeId: string, now = new Date()): Prisma.OrderWhereInput {
  const since = startOfMonthUtc(now);
  return {
    storeId,
    OR: [
      { paidAt: { gte: since } },
      { paidAt: null, paymentProvider: 'cod', status: 'OPEN', createdAt: { gte: since } },
    ],
  };
}

/** HTTP 402: the action needs a bigger plan. */
export class PlanLimitError extends HttpException {
  constructor(detail: string) {
    super({ title: 'Plan limit reached', detail }, 402);
  }
}

@Injectable()
export class PlansService {
  constructor(@Inject(APP_DB) private readonly db: PrismaClient) {}

  async ensureDefaults(db: Db = this.db): Promise<void> {
    if ((await db.plan.count()) > 0) return;
    await db.plan.createMany({
      data: DEFAULT_PLANS.map((p) => ({ ...p, isDefault: p.code === 'standard' })),
      skipDuplicates: true,
    });
  }

  async defaultPlan(db: Db = this.db): Promise<Plan> {
    await this.ensureDefaults(db);
    return (
      (await db.plan.findFirst({ where: { isDefault: true } })) ??
      (await db.plan.findFirstOrThrow({ where: { active: true }, orderBy: { sortOrder: 'asc' } }))
    );
  }

  async list(activeOnly: boolean, db: Db = this.db): Promise<Plan[]> {
    await this.ensureDefaults(db);
    return db.plan.findMany({
      where: activeOnly ? { active: true } : {},
      orderBy: { sortOrder: 'asc' },
    });
  }

  /** The store's subscription, created on the default plan (with a trial) if missing. */
  async subscriptionFor(storeId: string, db: Db = this.db): Promise<Subscription & { plan: Plan }> {
    const existing = await db.subscription.findUnique({
      where: { storeId },
      include: { plan: true },
    });
    if (existing) return existing;
    const plan = await this.defaultPlan(db);
    const now = new Date();
    try {
      return await db.subscription.create({
        data: {
          storeId,
          planId: plan.id,
          status: 'TRIALING',
          provider: 'none',
          currentPeriodStart: now,
          currentPeriodEnd: addDays(now, plan.trialDays),
          trialEndsAt: addDays(now, plan.trialDays),
        },
        include: { plan: true },
      });
    } catch (error) {
      // Created concurrently by another request.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return db.subscription.findUniqueOrThrow({ where: { storeId }, include: { plan: true } });
      }
      throw error;
    }
  }

  /** Current usage counted inside a tenant transaction (tenant tables are RLS-protected). */
  async usage(tx: TenantTx, storeId: string): Promise<Usage> {
    const [products, members, invitations, ordersThisMonth] = await Promise.all([
      tx.product.count({ where: { storeId } }),
      tx.storeMember.count({ where: { storeId } }),
      tx.storeInvitation.count({
        where: { storeId, acceptedAt: null, expiresAt: { gt: new Date() } },
      }),
      tx.order.count({ where: countedOrdersWhere(storeId) }),
    ]);
    return { products, staff: members + invitations, ordersThisMonth };
  }

  periodDays(): number {
    return PERIOD_DAYS;
  }
}

/** Plan limits, checked inside the same transaction as the write they guard. */
@Injectable()
export class PlanLimits {
  constructor(private readonly plans: PlansService) {}

  async assertCanCreateProduct(tx: TenantTx, storeId: string): Promise<void> {
    const { plan } = await this.plans.subscriptionFor(storeId, tx);
    if (plan.maxProducts === null) return;
    const count = await tx.product.count({ where: { storeId } });
    if (count >= plan.maxProducts) {
      throw new PlanLimitError(
        `Your ${plan.name} plan allows up to ${plan.maxProducts} products. Upgrade your plan to add more.`,
      );
    }
  }

  async assertCanAddStaff(tx: TenantTx, storeId: string): Promise<void> {
    const { plan } = await this.plans.subscriptionFor(storeId, tx);
    if (plan.maxStaff === null) return;
    const usage = await this.plans.usage(tx, storeId);
    if (usage.staff >= plan.maxStaff) {
      throw new PlanLimitError(
        `Your ${plan.name} plan allows up to ${plan.maxStaff} staff accounts (including pending invitations).`,
      );
    }
  }

  async assertCanAcceptOrder(tx: TenantTx, storeId: string): Promise<void> {
    const { plan } = await this.plans.subscriptionFor(storeId, tx);
    if (plan.maxOrdersPerMonth === null) return;
    const ordersThisMonth = await tx.order.count({ where: countedOrdersWhere(storeId) });
    if (ordersThisMonth >= plan.maxOrdersPerMonth) {
      // Shoppers see a neutral message; the merchant sees usage in their billing page.
      throw new PlanLimitError(
        'This store cannot accept new orders right now. Please try again later.',
      );
    }
  }

  /** Throws if current usage would not fit in `plan` (blocks downgrades). */
  async assertUsageFits(tx: TenantTx, storeId: string, plan: Plan): Promise<void> {
    const usage = await this.plans.usage(tx, storeId);
    if (plan.maxProducts !== null && usage.products > plan.maxProducts) {
      throw new PlanLimitError(
        `Reduce your catalog to ${plan.maxProducts} products before switching to ${plan.name}.`,
      );
    }
    if (plan.maxStaff !== null && usage.staff > plan.maxStaff) {
      throw new PlanLimitError(
        `Reduce your staff to ${plan.maxStaff} accounts before switching to ${plan.name}.`,
      );
    }
  }
}
