import { Inject, Injectable, Logger } from '@nestjs/common';
import type { PrismaClient } from '@repo/db';
import { PLATFORM_DB } from '../database/database.module.js';
import { OrderLifecycle } from '../orders/order-lifecycle.service.js';
import { parseOwnProviderName } from './store-gateways/adapters.js';
import { StoreGatewaysService } from './store-gateways/store-gateways.service.js';

/** Refunds younger than this are left to settle (and to webhooks) first. */
const SETTLE_AFTER_MS = 10 * 60_000;
/** Gateways settle refunds within days; after this a pending refund is no longer asked about. */
const GIVE_UP_AFTER_MS = 30 * 24 * 60 * 60_000;
const BATCH = 50;

/**
 * Asks merchants' own gateways about refunds they accepted as pending, for gateways without a
 * refund webhook here (and as a safety net when a webhook is not set up). A settled or failed
 * refund goes through the same path as a webhook (OrderLifecycle.applyRefundStatus).
 */
@Injectable()
export class RefundSyncService {
  private readonly logger = new Logger(RefundSyncService.name);

  constructor(
    @Inject(PLATFORM_DB) private readonly db: PrismaClient,
    private readonly gateways: StoreGatewaysService,
    private readonly lifecycle: OrderLifecycle,
  ) {}

  /** Checks one batch, oldest check first; returns how many refunds changed state. */
  async syncDue(now = new Date()): Promise<number> {
    const refunds = await this.db.refund.findMany({
      where: {
        status: 'PENDING',
        providerRef: { not: null },
        createdAt: {
          lt: new Date(now.getTime() - SETTLE_AFTER_MS),
          gt: new Date(now.getTime() - GIVE_UP_AFTER_MS),
        },
        payment: { provider: { startsWith: 'own_' } },
      },
      orderBy: { updatedAt: 'asc' },
      take: BATCH,
      select: {
        id: true,
        storeId: true,
        providerRef: true,
        payment: {
          select: { id: true, provider: true, providerRef: true, providerPaymentId: true },
        },
      },
    });
    let changed = 0;
    for (const refund of refunds) {
      // Touch it so the next run starts with the ones not asked about longest.
      await this.db.refund.update({ where: { id: refund.id }, data: { updatedAt: now } });
      if (!parseOwnProviderName(refund.payment.provider)) continue;
      try {
        const adapter = await this.gateways.adapterFor(
          refund.storeId,
          parseOwnProviderName(refund.payment.provider)!,
        );
        if (!adapter?.refundStatus) continue;
        const state = await adapter.refundStatus({
          refundRef: refund.providerRef!,
          idempotencyKey: `refund-${refund.id}`,
          providerRef: refund.payment.providerRef,
          providerPaymentId: refund.payment.providerPaymentId,
        });
        if (state === 'PENDING') continue;
        await this.lifecycle.applyRefundStatus(
          refund.storeId,
          refund.payment.id,
          refund.providerRef!,
          state,
        );
        changed++;
      } catch (error) {
        this.logger.warn(`Refund ${refund.id}: status check failed: ${String(error)}`);
      }
    }
    return changed;
  }
}
