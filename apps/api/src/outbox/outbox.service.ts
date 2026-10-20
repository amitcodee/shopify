import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Prisma, PrismaClient, TenantTx } from '@repo/db';
import { PLATFORM_DB } from '../database/database.module.js';
import { EMAIL_SENDER, type EmailMessage, type EmailSender } from '../email/email.js';

const MAX_ATTEMPTS = 5;

/** Producer side: enqueue inside the caller's transaction so messages exist iff the change commits. */
@Injectable()
export class OutboxService {
  async enqueueEmail(tx: TenantTx, tenantId: string | null, message: EmailMessage): Promise<void> {
    await tx.outboxMessage.create({
      data: { tenantId, type: 'email', payload: message as unknown as Prisma.InputJsonValue },
    });
  }
}

/** Consumer side: delivers pending messages; safe to run in several workers concurrently. */
@Injectable()
export class OutboxProcessor {
  private readonly logger = new Logger(OutboxProcessor.name);

  constructor(
    @Inject(PLATFORM_DB) private readonly db: PrismaClient,
    @Inject(EMAIL_SENDER) private readonly email: EmailSender,
  ) {}

  /** Delivers up to `limit` due messages; returns how many were attempted. */
  async processBatch(limit = 20): Promise<number> {
    return this.db.$transaction(
      async (tx) => {
        const due = await tx.$queryRaw<{ id: string }[]>`
          SELECT id FROM "OutboxMessage"
          WHERE status = 'PENDING' AND "availableAt" <= now()
          ORDER BY "createdAt"
          LIMIT ${limit}
          FOR UPDATE SKIP LOCKED`;
        for (const { id } of due) {
          const message = await tx.outboxMessage.findUniqueOrThrow({ where: { id } });
          try {
            if (message.type !== 'email') throw new Error(`Unknown outbox type ${message.type}`);
            const email = message.payload as unknown as EmailMessage;
            await this.email.send(email);
            // Sent messages keep only their subject: bodies hold personal data and one-time links.
            await tx.outboxMessage.update({
              where: { id },
              data: {
                status: 'SENT',
                sentAt: new Date(),
                attempts: { increment: 1 },
                payload: { subject: email.subject, scrubbed: true },
              },
            });
          } catch (error) {
            const attempts = message.attempts + 1;
            const backoffMs = 2 ** attempts * 30_000;
            this.logger.warn(`Outbox ${id} attempt ${attempts} failed: ${String(error)}`);
            await tx.outboxMessage.update({
              where: { id },
              data: {
                attempts,
                lastError: String(error).slice(0, 500),
                status: attempts >= MAX_ATTEMPTS ? 'FAILED' : 'PENDING',
                availableAt: new Date(Date.now() + backoffMs),
              },
            });
          }
        }
        return due.length;
      },
      { timeout: 60_000 },
    );
  }
}
