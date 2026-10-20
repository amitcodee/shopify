import type { IncomingHttpHeaders } from 'node:http';
import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { PrismaClient } from '@repo/db';
import { PLATFORM_DB } from '../database/database.module.js';
import { OrderLifecycle } from '../orders/order-lifecycle.service.js';
import {
  InvalidWebhookError,
  PAYMENT_PROVIDERS,
  type PaymentProvider,
} from './payment-provider.js';

/**
 * Verifies, de-duplicates and applies payment-provider webhooks. A webhook is only "consumed"
 * once processing succeeds, so provider retries recover from transient failures.
 */
@Injectable()
export class PaymentWebhooksService {
  private readonly logger = new Logger(PaymentWebhooksService.name);

  constructor(
    @Inject(PAYMENT_PROVIDERS) private readonly providers: Map<string, PaymentProvider>,
    @Inject(PLATFORM_DB) private readonly db: PrismaClient,
    private readonly lifecycle: OrderLifecycle,
  ) {}

  async handle(
    providerName: string,
    rawBody: Buffer | undefined,
    headers: IncomingHttpHeaders,
  ): Promise<{ received: true; duplicate?: true }> {
    const provider = this.providers.get(providerName);
    if (!provider) throw new NotFoundException();
    if (!rawBody) throw new BadRequestException('Missing body.');

    let outcome;
    try {
      outcome = provider.parseWebhook(rawBody, headers);
    } catch (error) {
      if (error instanceof InvalidWebhookError)
        throw new BadRequestException('Invalid webhook signature.');
      throw error;
    }

    const inserted = await this.db.webhookEvent.createMany({
      data: [{ provider: providerName, eventId: outcome.eventId, type: outcome.type }],
      skipDuplicates: true,
    });
    if (inserted.count === 0) return { received: true, duplicate: true };

    try {
      if (outcome.kind === 'dispute') {
        const payment = await this.db.payment.findFirst({
          where: { provider: providerName, providerPaymentId: outcome.providerPaymentId },
          select: { id: true, storeId: true },
        });
        if (!payment) {
          this.logger.warn(`Dispute ${outcome.dispute.id} for unknown charge`);
        } else {
          await this.lifecycle.applyDispute(payment.storeId, payment.id, outcome.dispute);
        }
      } else if (outcome.kind !== 'ignored') {
        const payment = await this.db.payment.findUnique({
          where: {
            provider_providerRef: { provider: providerName, providerRef: outcome.providerRef },
          },
          select: { id: true, storeId: true },
        });
        if (!payment) {
          this.logger.warn(`Webhook ${outcome.eventId} for unknown payment ${outcome.providerRef}`);
        } else if (outcome.kind === 'payment_succeeded') {
          await this.lifecycle.markPaid(payment.storeId, payment.id, {
            amount: outcome.amount,
            currency: outcome.currency,
            providerPaymentId: outcome.providerPaymentId,
          });
        } else {
          await this.lifecycle.markFailed(payment.storeId, payment.id);
        }
      }
      await this.db.webhookEvent.update({
        where: { provider_eventId: { provider: providerName, eventId: outcome.eventId } },
        data: { processedAt: new Date() },
      });
    } catch (error) {
      // Let the provider retry: forget the event so the next delivery is processed again.
      await this.db.webhookEvent.delete({
        where: { provider_eventId: { provider: providerName, eventId: outcome.eventId } },
      });
      throw error;
    }
    return { received: true };
  }
}
