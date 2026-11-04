import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  type CreateStoreInput,
  parseTheme,
  type Permission,
  permissionsForRole,
  type StoreDetail,
  type StoreOverview,
  type StoreSummary,
  type UpdateStoreInput,
} from '@repo/contracts';
import { Prisma, type PrismaClient, setTenant } from '@repo/db';
import { AuditService } from '../audit/audit.service.js';
import type { AuthUser, RequestMeta, StoreContext } from '../common/request.js';
import { APP_DB, TenantDb } from '../database/database.module.js';
import { PlansService } from '../platform/plans.service.js';
import { renditionKey } from '../storage/storage.js';
import { MediaUrls } from '../storage/storage.module.js';

const OVERVIEW_CONCURRENCY = 4;

@Injectable()
export class StoresService {
  constructor(
    @Inject(APP_DB) private readonly db: PrismaClient,
    private readonly tenantDb: TenantDb,
    private readonly audit: AuditService,
    private readonly plans: PlansService,
    private readonly media: MediaUrls,
  ) {}

  /** Merchant onboarding: creates (or reuses) the user's merchant, the store, and owner access. */
  async create(user: AuthUser, input: CreateStoreInput, meta: RequestMeta): Promise<StoreSummary> {
    // Stores send customer and order emails to the owner: the address must be proven first.
    if (!user.emailVerified) {
      throw new ForbiddenException('Confirm your email address before creating a store.');
    }
    try {
      return await this.db.$transaction(async (tx) => {
        const merchant =
          (await tx.merchant.findFirst({ where: { ownerUserId: user.id } })) ??
          (await tx.merchant.create({ data: { name: user.name, ownerUserId: user.id } }));

        const store = await tx.store.create({
          data: {
            merchantId: merchant.id,
            name: input.name,
            subdomain: input.subdomain,
            contactEmail: input.contactEmail,
            currency: input.currency,
            members: { create: { userId: user.id, role: 'OWNER' } },
          },
        });

        await this.plans.subscriptionFor(store.id, tx);
        await setTenant(tx, store.id);
        await this.audit.record(tx, {
          storeId: store.id,
          actorUserId: user.id,
          action: 'store.created',
          entityType: 'store',
          entityId: store.id,
          data: { name: store.name, subdomain: store.subdomain },
          meta,
        });

        return {
          id: store.id,
          name: store.name,
          subdomain: store.subdomain,
          status: store.status,
          role: 'OWNER' as const,
        };
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('That store address is already taken.');
      }
      throw error;
    }
  }

  async listForUser(userId: string): Promise<StoreSummary[]> {
    const memberships = await this.db.storeMember.findMany({
      where: { userId },
      include: { store: true },
      orderBy: { createdAt: 'asc' },
    });
    return memberships.map(({ store, role }) => ({
      id: store.id,
      name: store.name,
      subdomain: store.subdomain,
      status: store.status,
      role,
    }));
  }

  /** Everything the store picker shows, limited per store to what this member may see. */
  async overviewForUser(userId: string): Promise<StoreOverview[]> {
    const memberships = await this.db.storeMember.findMany({
      where: { userId },
      include: { store: { include: { subscription: { include: { plan: true } } } } },
      orderBy: { createdAt: 'asc' },
    });
    const storeIds = memberships.map((m) => m.storeId);
    const teammates = await this.db.storeMember.findMany({
      where: { storeId: { in: storeIds } },
      select: { storeId: true, role: true, user: { select: { name: true } } },
      orderBy: { createdAt: 'asc' },
    });

    // One short transaction per store, a few at a time so a large account cannot drain the pool.
    const overviews: StoreOverview[] = [];
    for (let i = 0; i < memberships.length; i += OVERVIEW_CONCURRENCY) {
      const batch = memberships.slice(i, i + OVERVIEW_CONCURRENCY);
      overviews.push(
        ...(await Promise.all(
          batch.map(async ({ store, role, permissions: granted }) => {
            const permissions = permissionsForRole(role, granted);
            const active = store.status !== 'SUSPENDED';
            const can = (permission: Permission) => active && permissions.includes(permission);
            const team = teammates.filter((t) => t.storeId === store.id);
            const { metrics, photos } = await this.overviewData(store.id, can);
            return {
              id: store.id,
              name: store.name,
              subdomain: store.subdomain,
              status: store.status,
              role,
              createdAt: store.createdAt.toISOString(),
              currency: store.currency,
              timezone: store.timezone,
              passwordProtected: store.passwordProtected,
              theme: parseTheme(store.themePreset, store.themeSettings),
              photos,
              metrics,
              // The same permissions as the staff and billing pages.
              team: can('settings:read')
                ? {
                    count: team.length,
                    members: team.slice(0, 5).map((t) => ({ name: t.user.name, role: t.role })),
                  }
                : null,
              plan:
                can('billing:manage') && store.subscription
                  ? {
                      name: store.subscription.plan.name,
                      status: store.subscription.status,
                      trialEndsAt: store.subscription.trialEndsAt?.toISOString() ?? null,
                    }
                  : null,
            };
          }),
        )),
      );
    }
    return overviews;
  }

  private overviewData(
    storeId: string,
    can: (permission: Permission) => boolean,
  ): Promise<Pick<StoreOverview, 'metrics' | 'photos'>> {
    const now = new Date();
    const since = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    return this.tenantDb.run(storeId, async (tx) => {
      // Only products shoppers can already see, so the preview shows nothing unpublished.
      const pictured = await tx.product.findMany({
        where: {
          storeId,
          status: 'ACTIVE',
          images: { some: {} },
          OR: [{ publishedAt: null }, { publishedAt: { lte: now } }],
        },
        orderBy: { createdAt: 'desc' },
        take: 4,
        select: {
          images: {
            orderBy: { position: 'asc' },
            take: 1,
            select: { storageKey: true, alt: true, renditionWidths: true },
          },
        },
      });
      const photos = pictured.flatMap(({ images }) =>
        images.map((image) => {
          const width = [...image.renditionWidths].sort((a, b) => a - b).find((w) => w >= 480);
          const key = width ? renditionKey(image.storageKey, width) : image.storageKey;
          return { url: this.media.url(key), alt: image.alt };
        }),
      );

      const products = can('products:read')
        ? await tx.product.count({ where: { storeId, status: 'ACTIVE' } })
        : null;
      const customers = can('customers:read')
        ? await tx.customer.count({ where: { storeId } })
        : null;
      const orderTotals = can('orders:read')
        ? await tx.order.aggregate({
            where: { storeId, paidAt: { not: null } },
            _count: { _all: true },
            _max: { paidAt: true },
          })
        : null;
      let sales30d: number | null = null;
      if (can('analytics:read')) {
        const [totals] = await tx.$queryRaw<{ gross: number }[]>`
          SELECT COALESCE(ROUND(SUM(total / "exchangeRate")), 0)::int AS gross
          FROM "Order"
          WHERE "storeId" = ${storeId}::uuid AND "paidAt" >= ${since}`;
        sales30d = totals?.gross ?? 0;
      }
      return {
        photos,
        metrics: {
          products,
          customers,
          orders: orderTotals?._count._all ?? null,
          lastOrderAt: orderTotals?._max.paidAt?.toISOString() ?? null,
          sales30d,
        },
      };
    });
  }

  async get(ctx: StoreContext): Promise<StoreDetail> {
    const store = await this.db.store.findUnique({ where: { id: ctx.id } });
    if (!store) throw new NotFoundException('Store not found.');
    return {
      id: store.id,
      name: store.name,
      subdomain: store.subdomain,
      status: store.status,
      role: ctx.role,
      contactEmail: store.contactEmail,
      currency: store.currency,
      timezone: store.timezone,
      abandonedCheckoutDelayHours: store.abandonedCheckoutDelayHours,
      permissions: ctx.permissions,
      createdAt: store.createdAt.toISOString(),
    };
  }

  async update(
    ctx: StoreContext,
    input: UpdateStoreInput,
    actor: AuthUser,
    meta: RequestMeta,
  ): Promise<StoreDetail> {
    const before = await this.db.store.findUniqueOrThrow({ where: { id: ctx.id } });
    const changes = Object.fromEntries(
      Object.entries(input).filter(
        ([key, value]) => value !== undefined && before[key as keyof typeof before] !== value,
      ),
    );

    if (Object.keys(changes).length > 0) {
      await this.tenantDb.run(ctx.id, async (tx) => {
        await tx.store.update({ where: { id: ctx.id }, data: changes });
        await this.audit.record(tx, {
          storeId: ctx.id,
          actorUserId: actor.id,
          action: 'store.updated',
          entityType: 'store',
          entityId: ctx.id,
          data: {
            changes: Object.fromEntries(
              Object.keys(changes).map((key) => [
                key,
                {
                  from: before[key as keyof typeof before] as string | number | null,
                  to: changes[key] as string | number | null,
                },
              ]),
            ),
          },
          meta,
        });
      });
    }
    return this.get({ ...ctx, currency: input.currency ?? ctx.currency });
  }
}
