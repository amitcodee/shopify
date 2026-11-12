import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { STORE_DELETION_GRACE_DAYS, type StoreDetail } from '@repo/contracts';
import { type PrismaClient, setTenant } from '@repo/db';
import { AuditService } from '../audit/audit.service.js';
import type { AuthUser, RequestMeta, StoreContext } from '../common/request.js';
import { PLATFORM_DB } from '../database/database.module.js';
import { BillingService } from '../platform/billing.service.js';
import { addDays } from '../platform/plans.service.js';
import { OBJECT_STORAGE, type ObjectStorage } from '../storage/storage.js';
import { StoreResolver } from '../storefront/store-resolver.js';
import { StoresService } from './stores.service.js';

/**
 * Closing a store (owner only): the storefront goes offline at once, billing stops, and the data
 * is erased after a grace period during which the owner can reopen it. Our invoices to the
 * merchant are kept (tax records); everything else of the store is deleted.
 */
@Injectable()
export class StoreClosureService {
  private readonly logger = new Logger(StoreClosureService.name);

  constructor(
    @Inject(PLATFORM_DB) private readonly db: PrismaClient,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
    private readonly billing: BillingService,
    private readonly resolver: StoreResolver,
    private readonly audit: AuditService,
    private readonly stores: StoresService,
  ) {}

  async close(
    ctx: StoreContext,
    confirmSubdomain: string,
    actor: AuthUser,
    meta: RequestMeta,
  ): Promise<StoreDetail> {
    if (ctx.role !== 'OWNER') throw new ForbiddenException('Only the store owner can close it.');
    const store = await this.db.store.findUniqueOrThrow({ where: { id: ctx.id } });
    if (store.status === 'CLOSED') throw new ConflictException('This store is already closed.');
    if (store.status === 'SUSPENDED') {
      throw new ConflictException('A suspended store cannot be closed. Contact platform support.');
    }
    if (confirmSubdomain !== store.subdomain) {
      throw new BadRequestException('Type the store address exactly to confirm.');
    }

    await this.billing.endForClosure(ctx.id);
    const now = new Date();
    await this.db.$transaction(async (tx) => {
      await tx.store.update({
        where: { id: ctx.id },
        data: {
          status: 'CLOSED',
          closedAt: now,
          deletionScheduledAt: addDays(now, STORE_DELETION_GRACE_DAYS),
        },
      });
      // Staff API tokens stop working with the store.
      await setTenant(tx, ctx.id);
      await this.audit.record(tx, {
        storeId: ctx.id,
        actorUserId: actor.id,
        action: 'store.closed',
        entityType: 'store',
        entityId: ctx.id,
        data: { deletionScheduledAt: addDays(now, STORE_DELETION_GRACE_DAYS).toISOString() },
        meta,
      });
    });
    this.resolver.invalidate();
    return this.stores.get(ctx);
  }

  async reopen(ctx: StoreContext, actor: AuthUser, meta: RequestMeta): Promise<StoreDetail> {
    if (ctx.role !== 'OWNER') throw new ForbiddenException('Only the store owner can reopen it.');
    const store = await this.db.store.findUniqueOrThrow({ where: { id: ctx.id } });
    if (store.status !== 'CLOSED') throw new ConflictException('This store is not closed.');
    await this.db.$transaction(async (tx) => {
      await tx.store.update({
        where: { id: ctx.id },
        data: { status: 'ACTIVE', closedAt: null, deletionScheduledAt: null },
      });
      await setTenant(tx, ctx.id);
      await this.audit.record(tx, {
        storeId: ctx.id,
        actorUserId: actor.id,
        action: 'store.reopened',
        entityType: 'store',
        entityId: ctx.id,
        meta,
      });
    });
    // Billing decides whether it can sell again (the paid period may still be running).
    await this.billing.refreshLock(ctx.id);
    this.resolver.invalidate();
    return this.stores.get({ ...ctx });
  }

  /** Permanently erases stores whose grace period ended (runs daily). */
  async purgeDue(now = new Date(), limit = 20): Promise<number> {
    const due = await this.db.store.findMany({
      where: { status: 'CLOSED', deletionScheduledAt: { lt: now } },
      select: { id: true, subdomain: true },
      take: limit,
    });
    for (const store of due) {
      try {
        await this.storage.deletePrefix(`stores/${store.id}/`);
        // Every store table cascades from Store; platform invoices are detached and kept.
        await this.db.store.delete({ where: { id: store.id } });
        this.logger.log(`Erased closed store ${store.subdomain} (${store.id})`);
      } catch (error) {
        this.logger.error(`Could not erase store ${store.id}: ${String(error)}`);
      }
    }
    if (due.length > 0) this.resolver.invalidate();
    return due.length;
  }
}
