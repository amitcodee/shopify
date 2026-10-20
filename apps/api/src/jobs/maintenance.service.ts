import { Inject, Injectable, Logger } from '@nestjs/common';
import type { PrismaClient } from '@repo/db';
import { PLATFORM_DB } from '../database/database.module.js';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Data-retention housekeeping (runs daily): removes expired credentials and stale plumbing rows. */
@Injectable()
export class MaintenanceService {
  private readonly logger = new Logger(MaintenanceService.name);

  constructor(@Inject(PLATFORM_DB) private readonly db: PrismaClient) {}

  async cleanup(now = new Date()): Promise<Record<string, number>> {
    const daysAgo = (days: number) => new Date(now.getTime() - days * DAY_MS);
    const [
      sessions,
      customerSessions,
      carts,
      tokens,
      invitations,
      outbox,
      webhooks,
      domains,
      rateLimits,
    ] = await Promise.all([
      this.db.session.deleteMany({ where: { expiresAt: { lt: now } } }),
      this.db.customerSession.deleteMany({ where: { expiresAt: { lt: now } } }),
      this.db.cart.deleteMany({ where: { expiresAt: { lt: now } } }),
      this.db.customerToken.deleteMany({
        where: { OR: [{ expiresAt: { lt: daysAgo(7) } }, { usedAt: { lt: daysAgo(7) } }] },
      }),
      this.db.storeInvitation.deleteMany({
        where: { OR: [{ expiresAt: { lt: daysAgo(30) } }, { acceptedAt: { lt: daysAgo(30) } }] },
      }),
      this.db.outboxMessage.deleteMany({
        where: { status: 'SENT', sentAt: { lt: daysAgo(30) } },
      }),
      this.db.webhookEvent.deleteMany({ where: { processedAt: { lt: daysAgo(90) } } }),
      // Stale unverified domain claims.
      this.db.domain.deleteMany({ where: { verifiedAt: null, createdAt: { lt: daysAgo(7) } } }),
      // Finished windows that are not blocking anyone.
      this.db.rateLimitBucket.deleteMany({
        where: {
          windowEndsAt: { lt: now },
          OR: [{ blockedUntil: null }, { blockedUntil: { lt: now } }],
        },
      }),
    ]);
    const result = {
      sessions: sessions.count,
      customerSessions: customerSessions.count,
      carts: carts.count,
      customerTokens: tokens.count,
      invitations: invitations.count,
      outbox: outbox.count,
      webhookEvents: webhooks.count,
      unverifiedDomains: domains.count,
      rateLimitBuckets: rateLimits.count,
    };
    this.logger.log(`Cleanup: ${JSON.stringify(result)}`);
    return result;
  }
}
