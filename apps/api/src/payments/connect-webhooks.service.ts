import type { IncomingHttpHeaders } from 'node:http';
import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { PrismaClient } from '@repo/db';
import { PLATFORM_DB } from '../database/database.module.js';
import { CONNECT_PROVIDERS, type ConnectProvider } from './connect-provider.js';
import { PaymentAccountsService } from './payment-accounts.service.js';
import { InvalidWebhookError } from './payment-provider.js';

/**
 * Verifies, de-duplicates and applies Connect (connected-account) webhooks. Same contract as
 * payment webhooks: an event is consumed only once processing succeeds, so retries recover.
 */
@Injectable()
export class ConnectWebhooksService {
  constructor(
    @Inject(CONNECT_PROVIDERS) private readonly providers: Map<string, ConnectProvider>,
    @Inject(PLATFORM_DB) private readonly db: PrismaClient,
    private readonly accounts: PaymentAccountsService,
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

    // Own namespace in WebhookEvent: Connect and payment endpoints have separate event streams.
    const key = { provider: `${providerName}-connect`, eventId: outcome.eventId };
    const inserted = await this.db.webhookEvent.createMany({
      data: [{ ...key, type: outcome.type }],
      skipDuplicates: true,
    });
    if (inserted.count === 0) return { received: true, duplicate: true };

    try {
      await this.accounts.applyWebhook(providerName, outcome);
      await this.db.webhookEvent.update({
        where: { provider_eventId: key },
        data: { processedAt: new Date() },
      });
    } catch (error) {
      await this.db.webhookEvent.delete({ where: { provider_eventId: key } });
      throw error;
    }
    return { received: true };
  }
}
