import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  CreateStoreInput,
  StoreDetail,
  StoreSummary,
  UpdateStoreInput,
} from '@repo/contracts';
import { Prisma, type PrismaClient, setTenant } from '@repo/db';
import { AuditService } from '../audit/audit.service.js';
import type { AuthUser, RequestMeta, StoreContext } from '../common/request.js';
import { APP_DB, TenantDb } from '../database/database.module.js';
import { PlansService } from '../platform/plans.service.js';

@Injectable()
export class StoresService {
  constructor(
    @Inject(APP_DB) private readonly db: PrismaClient,
    private readonly tenantDb: TenantDb,
    private readonly audit: AuditService,
    private readonly plans: PlansService,
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
                { from: before[key as keyof typeof before] as string, to: changes[key] as string },
              ]),
            ),
          },
          meta,
        });
      });
    }
    return this.get({ ...ctx, currency: changes.currency ?? ctx.currency });
  }
}
