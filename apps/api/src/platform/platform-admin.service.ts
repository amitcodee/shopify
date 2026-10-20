import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  Paginated,
  Plan as PlanDto,
  PlatformAuditEntry,
  PlatformOverview,
  PlatformSettings,
  PlatformStore,
  PlatformUser,
  planInputSchema,
  platformStoreQuerySchema,
  setStorePlanInputSchema,
} from '@repo/contracts';
import { Prisma, type PrismaClient } from '@repo/db';
import type { z } from 'zod';
import type { AuthUser, RequestMeta } from '../common/request.js';
import { PLATFORM_DB } from '../database/database.module.js';
import { StoreResolver } from '../storefront/store-resolver.js';
import { PlatformSettingsService } from './platform-settings.service.js';
import { addDays, PlansService, startOfMonthUtc, toPlanDto } from './plans.service.js';

/**
 * Cross-tenant platform administration. Uses the BYPASSRLS connection deliberately; every
 * mutation is written to the platform audit log.
 */
@Injectable()
export class PlatformAdminService {
  constructor(
    @Inject(PLATFORM_DB) private readonly db: PrismaClient,
    private readonly plans: PlansService,
    private readonly settings: PlatformSettingsService,
    private readonly resolver: StoreResolver,
  ) {}

  private async log(
    actor: AuthUser,
    action: string,
    targetType: string,
    targetId: string | null,
    meta: RequestMeta,
    data?: Prisma.InputJsonValue,
  ): Promise<void> {
    await this.db.platformAuditLog.create({
      data: {
        actorUserId: actor.id,
        action,
        targetType,
        targetId,
        data,
        ipAddress: meta.ipAddress,
      },
    });
  }

  async overview(): Promise<PlatformOverview> {
    await this.plans.ensureDefaults(this.db);
    const since = addDays(new Date(), -30);
    const [stores, active, users, merchants, subscriptions, gmv, paidOrders, fees, accepting] =
      await Promise.all([
        this.db.store.count(),
        this.db.store.count({ where: { status: 'ACTIVE' } }),
        this.db.user.count(),
        this.db.merchant.count(),
        this.db.subscription.findMany({ include: { plan: true } }),
        this.db.order.groupBy({
          by: ['currency'],
          where: { paidAt: { gte: since } },
          _sum: { total: true },
        }),
        this.db.order.count({ where: { paidAt: { gte: since } } }),
        this.db.payment.groupBy({
          by: ['currency'],
          where: { status: 'SUCCEEDED', order: { paidAt: { gte: since } } },
          _sum: { applicationFee: true },
        }),
        this.db.paymentAccount.count({ where: { status: 'ACTIVE', chargesEnabled: true } }),
      ]);
    const breakdown = new Map<string, number>();
    for (const s of subscriptions)
      breakdown.set(s.plan.name, (breakdown.get(s.plan.name) ?? 0) + 1);
    return {
      stores: { total: stores, active, suspended: stores - active },
      users,
      merchants,
      mrr: subscriptions
        .filter((s) => s.status === 'ACTIVE')
        .reduce((sum, s) => sum + s.plan.priceMonthly, 0),
      paidOrders30d: paidOrders,
      gmv30d: gmv.map((g) => ({ currency: g.currency, amount: g._sum.total ?? 0 })),
      fees30d: fees.map((f) => ({ currency: f.currency, amount: f._sum.applicationFee ?? 0 })),
      storesAcceptingPayments: accepting,
      planBreakdown: [...breakdown.entries()].map(([plan, count]) => ({ plan, stores: count })),
    };
  }

  async stores(
    query: z.output<typeof platformStoreQuerySchema>,
  ): Promise<Paginated<PlatformStore>> {
    const where: Prisma.StoreWhereInput = {};
    if (query.status) where.status = query.status;
    if (query.q) {
      where.OR = [
        { name: { contains: query.q, mode: 'insensitive' } },
        { subdomain: { contains: query.q.toLowerCase() } },
        { merchant: { owner: { email: { contains: query.q.toLowerCase() } } } },
      ];
    }
    const [rows, total] = await Promise.all([
      this.db.store.findMany({
        where,
        include: {
          merchant: { include: { owner: { select: { email: true } } } },
          subscription: { include: { plan: true } },
          paymentAccount: { select: { status: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.db.store.count({ where }),
    ]);
    const ids = rows.map((r) => r.id);
    const monthStart = startOfMonthUtc();
    const [products, members, orders] = await Promise.all([
      this.db.product.groupBy({
        by: ['storeId'],
        where: { storeId: { in: ids } },
        _count: { _all: true },
      }),
      this.db.storeMember.groupBy({
        by: ['storeId'],
        where: { storeId: { in: ids } },
        _count: { _all: true },
      }),
      this.db.order.groupBy({
        by: ['storeId'],
        where: {
          storeId: { in: ids },
          paidAt: { gte: monthStart },
        },
        _count: { _all: true },
      }),
    ]);
    const count = (list: { storeId: string; _count: { _all: number } }[], id: string) =>
      list.find((x) => x.storeId === id)?._count._all ?? 0;
    return {
      items: rows.map((s) => ({
        id: s.id,
        name: s.name,
        subdomain: s.subdomain,
        status: s.status,
        suspendedReason: s.suspendedReason,
        ownerEmail: s.merchant.owner.email,
        plan: s.subscription?.plan.name ?? 'Starter',
        subscriptionStatus: s.subscription?.status ?? 'TRIALING',
        paymentsStatus: s.paymentAccount?.status ?? null,
        usage: {
          products: count(products, s.id),
          staff: count(members, s.id),
          ordersThisMonth: count(orders, s.id),
        },
        createdAt: s.createdAt.toISOString(),
      })),
      page: query.page,
      pageSize: query.pageSize,
      total,
    };
  }

  async setStoreStatus(
    storeId: string,
    suspend: boolean,
    reason: string | null,
    actor: AuthUser,
    meta: RequestMeta,
  ) {
    const store = await this.db.store.findUnique({ where: { id: storeId } });
    if (!store) throw new NotFoundException('Store not found.');
    await this.db.store.update({
      where: { id: storeId },
      data: { status: suspend ? 'SUSPENDED' : 'ACTIVE', suspendedReason: suspend ? reason : null },
    });
    this.resolver.invalidate();
    await this.log(
      actor,
      suspend ? 'store.suspended' : 'store.reactivated',
      'store',
      storeId,
      meta,
      { reason },
    );
  }

  async setStorePlan(
    storeId: string,
    input: z.output<typeof setStorePlanInputSchema>,
    actor: AuthUser,
    meta: RequestMeta,
  ) {
    const plan = await this.db.plan.findUnique({ where: { id: input.planId } });
    if (!plan) throw new NotFoundException('Plan not found.');
    const store = await this.db.store.findUnique({ where: { id: storeId } });
    if (!store) throw new NotFoundException('Store not found.');
    const subscription = await this.plans.subscriptionFor(storeId, this.db);
    const now = new Date();
    await this.db.subscription.update({
      where: { id: subscription.id },
      data: {
        planId: plan.id,
        status: input.status,
        currentPeriodStart: now,
        currentPeriodEnd: addDays(now, this.plans.periodDays()),
        trialEndsAt: null,
        pendingPlanId: null,
        provider: 'manual',
      },
    });
    await this.log(actor, 'store.plan_set', 'store', storeId, meta, {
      plan: plan.code,
      status: input.status,
    });
  }

  async listPlans(): Promise<PlanDto[]> {
    return (await this.plans.list(false, this.db)).map(toPlanDto);
  }

  async savePlan(
    planId: string | null,
    input: z.output<typeof planInputSchema>,
    actor: AuthUser,
    meta: RequestMeta,
  ): Promise<PlanDto> {
    try {
      const plan = planId
        ? await this.db.plan.update({ where: { id: planId }, data: input })
        : await this.db.plan.create({ data: input });
      await this.log(actor, planId ? 'plan.updated' : 'plan.created', 'plan', plan.id, meta, {
        code: plan.code,
      });
      return toPlanDto(plan);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002')
          throw new ConflictException('A plan with this code already exists.');
        if (error.code === 'P2025') throw new NotFoundException('Plan not found.');
      }
      throw error;
    }
  }

  async users(
    q: string | undefined,
    page: number,
    pageSize: number,
  ): Promise<Paginated<PlatformUser>> {
    const where: Prisma.UserWhereInput = q
      ? {
          OR: [
            { email: { contains: q.toLowerCase() } },
            { name: { contains: q, mode: 'insensitive' } },
          ],
        }
      : {};
    const [rows, total] = await Promise.all([
      this.db.user.findMany({
        where,
        include: { _count: { select: { memberships: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.db.user.count({ where }),
    ]);
    return {
      items: rows.map((u) => ({
        id: u.id,
        email: u.email,
        name: u.name,
        platformRole: u.platformRole,
        disabled: u.disabledAt !== null,
        stores: u._count.memberships,
        createdAt: u.createdAt.toISOString(),
      })),
      page,
      pageSize,
      total,
    };
  }

  async setUserDisabled(userId: string, disabled: boolean, actor: AuthUser, meta: RequestMeta) {
    if (userId === actor.id) throw new BadRequestException('You cannot disable your own account.');
    const user = await this.db.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found.');
    await this.db.$transaction([
      this.db.user.update({
        where: { id: userId },
        data: { disabledAt: disabled ? new Date() : null },
      }),
      ...(disabled ? [this.db.session.deleteMany({ where: { userId } })] : []),
    ]);
    await this.log(actor, disabled ? 'user.disabled' : 'user.enabled', 'user', userId, meta);
  }

  getSettings(): Promise<PlatformSettings> {
    return this.settings.get();
  }

  async saveSettings(
    input: PlatformSettings,
    actor: AuthUser,
    meta: RequestMeta,
  ): Promise<PlatformSettings> {
    const saved = await this.settings.save(input, actor.id);
    await this.log(actor, 'settings.updated', 'platform', null, meta, input);
    return saved;
  }

  async auditLog(page: number, pageSize: number): Promise<Paginated<PlatformAuditEntry>> {
    const [rows, total] = await Promise.all([
      this.db.platformAuditLog.findMany({
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.db.platformAuditLog.count(),
    ]);
    const actors = await this.db.user.findMany({
      where: { id: { in: [...new Set(rows.map((r) => r.actorUserId))] } },
      select: { id: true, email: true },
    });
    return {
      items: rows.map((r) => ({
        id: r.id,
        actor: actors.find((a) => a.id === r.actorUserId) ?? null,
        action: r.action,
        targetType: r.targetType,
        targetId: r.targetId,
        data: r.data ?? null,
        createdAt: r.createdAt.toISOString(),
      })),
      page,
      pageSize,
      total,
    };
  }
}
