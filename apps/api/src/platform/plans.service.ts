import { HttpException, Inject, Injectable } from '@nestjs/common';
import type { Plan as PlanDto, PlanInput, Usage } from '@repo/contracts';
import { type Plan, Prisma, type PrismaClient, type Subscription, type TenantTx } from '@repo/db';
import { APP_DB } from '../database/database.module.js';

const TRIAL_DAYS = 14;
const PERIOD_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Plans every platform starts with (idempotently created when the table is empty). */
export const DEFAULT_PLANS: Required<PlanInput>[] = [
  {
    code: 'starter',
    name: 'Starter',
    priceMonthly: 0,
    maxProducts: 25,
    maxStaff: 2,
    maxOrdersPerMonth: 100,
    transactionFeeBps: 200,
    active: true,
    sortOrder: 1,
  },
  {
    code: 'growth',
    name: 'Growth',
    priceMonthly: 2900,
    maxProducts: 1000,
    maxStaff: 10,
    maxOrdersPerMonth: null,
    transactionFeeBps: 100,
    active: true,
    sortOrder: 2,
  },
  {
    code: 'pro',
    name: 'Pro',
    priceMonthly: 9900,
    maxProducts: null,
    maxStaff: null,
    maxOrdersPerMonth: null,
    transactionFeeBps: 50,
    active: true,
    sortOrder: 3,
  },
];

type Db = PrismaClient | TenantTx;

export function toPlanDto(p: Plan): PlanDto {
  return {
    id: p.id,
    code: p.code,
    name: p.name,
    priceMonthly: p.priceMonthly,
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
      data: DEFAULT_PLANS.map((p) => ({ ...p, isDefault: p.code === 'starter' })),
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
          currentPeriodStart: now,
          currentPeriodEnd: addDays(now, TRIAL_DAYS),
          trialEndsAt: addDays(now, TRIAL_DAYS),
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
      tx.order.count({
        // Paid orders only: unpaid checkouts must not let anyone exhaust a store's quota.
        where: { storeId, paidAt: { gte: startOfMonthUtc() } },
      }),
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
    const usage = await this.plans.usage(tx, storeId);
    if (usage.ordersThisMonth >= plan.maxOrdersPerMonth) {
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
