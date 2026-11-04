import type { IncomingHttpHeaders } from 'node:http';
import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { StoreGatewayId } from '@repo/contracts';
import type { PrismaClient } from '@repo/db';
import { PLATFORM_DB } from '../database/database.module.js';
import { OrderLifecycle } from '../orders/order-lifecycle.service.js';
import {
  InvalidWebhookError,
  PAYMENT_PROVIDERS,
  type PaymentProvider,
  type WebhookOutcome,
} from './payment-provider.js';
import { StoreGatewaysService } from './store-gateways/store-gateways.service.js';

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
    private readonly storeGateways: StoreGatewaysService,
  ) {}

  /** A webhook sent to one store's own gateway, verified with that store's keys. */
  async handleStoreGateway(
    storeId: string,
    id: StoreGatewayId,
    rawBody: Buffer | undefined,
    headers: IncomingHttpHeaders,
  ): Promise<{ received: true; duplicate?: true }> {
    const adapter = await this.storeGateways.adapterFor(storeId, id);
    if (!adapter) throw new NotFoundException();
    if (!rawBody) throw new BadRequestException('Missing body.');
    let outcome: WebhookOutcome;
    try {
      outcome = adapter.parseWebhook(rawBody, headers);
    } catch (error) {
      if (error instanceof InvalidWebhookError)
        throw new BadRequestException('Invalid webhook signature.');
      throw error;
    }
    return this.applyStoreGateway(storeId, id, outcome);
  }

  /**
   * Applies a verified result from a store's own gateway. Its keys only speak for that store, so
   * payments are looked up within it: a merchant cannot mark another store's order paid.
   */
  applyStoreGateway(
    storeId: string,
    id: StoreGatewayId,
    outcome: WebhookOutcome,
  ): Promise<{ received: true; duplicate?: true }> {
    const provider = { startsWith: `own_${id}` };
    return this.process(`own_${id}:${storeId}`, outcome, {
      byRef: (providerRef) =>
        this.db.payment.findFirst({
          where: { storeId, provider, providerRef },
          select: { id: true, storeId: true },
        }),
      byPaymentId: (providerPaymentId) =>
        this.db.payment.findFirst({
          where: { storeId, provider, providerPaymentId },
          select: { id: true, storeId: true },
        }),
    });
  }

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

    return this.process(providerName, outcome, {
      byRef: (providerRef) =>
        this.db.payment.findUnique({
          where: { provider_providerRef: { provider: providerName, providerRef } },
          select: { id: true, storeId: true },
        }),
      byPaymentId: (providerPaymentId) =>
        this.db.payment.findFirst({
          where: { provider: providerName, providerPaymentId },
          select: { id: true, storeId: true },
        }),
    });
  }

  /** De-duplicates by `eventKey`, then applies the outcome to the payment it refers to. */
  private async process(
    eventKey: string,
    outcome: WebhookOutcome,
    find: {
      byRef: (ref: string) => Promise<{ id: string; storeId: string } | null>;
      byPaymentId: (id: string) => Promise<{ id: string; storeId: string } | null>;
    },
  ): Promise<{ received: true; duplicate?: true }> {
    const inserted = await this.db.webhookEvent.createMany({
      data: [{ provider: eventKey, eventId: outcome.eventId, type: outcome.type }],
      skipDuplicates: true,
    });
    if (inserted.count === 0) return { received: true, duplicate: true };

    try {
      if (outcome.kind === 'dispute') {
        const payment = await find.byPaymentId(outcome.providerPaymentId);
        if (!payment) {
          this.logger.warn(`Dispute ${outcome.dispute.id} for unknown charge`);
        } else {
          await this.lifecycle.applyDispute(payment.storeId, payment.id, outcome.dispute);
        }
      } else if (outcome.kind !== 'ignored') {
        const payment = await find.byRef(outcome.providerRef);
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
        where: { provider_eventId: { provider: eventKey, eventId: outcome.eventId } },
        data: { processedAt: new Date() },
      });
    } catch (error) {
      // Let the provider retry: forget the event so the next delivery is processed again.
      await this.db.webhookEvent.delete({
        where: { provider_eventId: { provider: eventKey, eventId: outcome.eventId } },
      });
      throw error;
    }
    return { received: true };
  }
}
