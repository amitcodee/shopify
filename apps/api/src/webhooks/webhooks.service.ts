import { createHmac, randomBytes } from 'node:crypto';
import {
  BadRequestException,
  Global,
  Inject,
  Injectable,
  Logger,
  Module,
  NotFoundException,
} from '@nestjs/common';
import {
  type CreatedWebhook,
  type Webhook,
  WEBHOOK_HEADERS,
  type WebhookDelivery,
  type WebhookOrderPayload,
  type WebhookProductPayload,
  type WebhookTopic,
} from '@repo/contracts';
import type { Prisma, PrismaClient, TenantTx, WebhookSubscription } from '@repo/db';
import { AuditService } from '../audit/audit.service.js';
import { decryptSecret, encryptSecret } from '../common/crypto.js';
import type { AuthUser, RequestMeta } from '../common/request.js';
import { allowPrivateWebhooks, ENV, type Env } from '../config/env.js';
import { PLATFORM_DB, TenantDb } from '../database/database.module.js';
import { postJson } from './safe-http.js';

const MAX_SUBSCRIPTIONS = 50;
/** Retry delays after each failed attempt; the delivery fails for good after the last one. */
const RETRY_DELAYS_MS = [
  60_000,
  5 * 60_000,
  30 * 60_000,
  2 * 3600_000,
  6 * 3600_000,
  24 * 3600_000,
];
/** Consecutive failed attempts after which a subscription is switched off. */
const DISABLE_AFTER_FAILURES = 20;
/** A claimed delivery is retried by another worker if this one dies mid-flight. */
const LEASE_MS = 2 * 60_000;

type OrderForPayload = Prisma.OrderGetPayload<{ include: { lines: true } }>;

export function orderPayload(order: OrderForPayload): WebhookOrderPayload {
  return {
    id: order.id,
    number: order.number,
    email: order.email,
    status: order.status,
    financialStatus: order.financialStatus,
    fulfillmentStatus: order.fulfillmentStatus,
    currency: order.currency,
    subtotal: order.subtotal,
    discountTotal: order.discountTotal,
    shippingTotal: order.shippingTotal,
    taxTotal: order.taxTotal,
    total: order.total,
    lines: order.lines.map((l) => ({
      variantId: l.variantId,
      sku: l.sku,
      title: l.title,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
    })),
    createdAt: order.createdAt.toISOString(),
  };
}

/**
 * Producer side: queues a delivery per matching subscription inside the caller's transaction,
 * so a webhook is sent if and only if the change commits.
 */
@Injectable()
export class WebhookEmitter {
  async emit(
    tx: TenantTx,
    storeId: string,
    topic: WebhookTopic,
    /** Builds the body; only called when someone subscribes to the topic. */
    build: () => object | Promise<object>,
  ): Promise<void> {
    const subscriptions = await tx.webhookSubscription.findMany({
      where: { storeId, topic, disabledAt: null },
      select: { id: true },
    });
    if (subscriptions.length === 0) return;
    const body = await build();
    await tx.webhookDelivery.createMany({
      data: subscriptions.map((s) => ({
        storeId,
        subscriptionId: s.id,
        topic,
        payload: body,
      })),
    });
  }

  emitOrder(tx: TenantTx, storeId: string, topic: WebhookTopic, orderId: string, extra = {}) {
    return this.emit(tx, storeId, topic, async () => ({
      ...orderPayload(
        await tx.order.findUniqueOrThrow({ where: { id: orderId }, include: { lines: true } }),
      ),
      ...extra,
    }));
  }

  emitProduct(tx: TenantTx, storeId: string, topic: WebhookTopic, productId: string) {
    return this.emit(tx, storeId, topic, async (): Promise<WebhookProductPayload> => {
      const p = await tx.product.findUniqueOrThrow({
        where: { id: productId },
        include: { variants: { orderBy: { position: 'asc' } } },
      });
      return {
        id: p.id,
        handle: p.handle,
        title: p.title,
        status: p.status,
        publishedAt: p.publishedAt?.toISOString() ?? null,
        variants: p.variants.map((v) => ({
          id: v.id,
          sku: v.sku,
          price: v.price,
          inventoryQuantity: v.inventoryQuantity,
        })),
      };
    });
  }
}

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(
    private readonly tenantDb: TenantDb,
    private readonly audit: AuditService,
    @Inject(PLATFORM_DB) private readonly platformDb: PrismaClient,
    @Inject(ENV) private readonly env: Env,
  ) {}

  list(storeId: string): Promise<Webhook[]> {
    return this.tenantDb.run(storeId, async (tx) =>
      (
        await tx.webhookSubscription.findMany({ where: { storeId }, orderBy: { createdAt: 'asc' } })
      ).map((s) => this.toDto(s)),
    );
  }

  create(
    storeId: string,
    input: { topic: WebhookTopic; url: string },
    actor: AuthUser,
    meta: RequestMeta,
  ): Promise<CreatedWebhook> {
    if (this.env.NODE_ENV === 'production' && !input.url.startsWith('https://')) {
      throw new BadRequestException('Webhook URLs must use https.');
    }
    return this.tenantDb.run(storeId, async (tx) => {
      if ((await tx.webhookSubscription.count({ where: { storeId } })) >= MAX_SUBSCRIPTIONS) {
        throw new BadRequestException(`A store can have at most ${MAX_SUBSCRIPTIONS} webhooks.`);
      }
      const secret = randomBytes(32).toString('base64url');
      const created = await tx.webhookSubscription.create({
        data: {
          storeId,
          topic: input.topic,
          url: input.url,
          secretEncrypted: encryptSecret(this.env.APP_ENCRYPTION_KEY, secret),
        },
      });
      await this.audit.record(tx, {
        storeId,
        actorUserId: actor.id,
        action: 'webhook.created',
        entityType: 'webhook',
        entityId: created.id,
        data: { topic: input.topic, url: input.url },
        meta,
      });
      return { ...this.toDto(created), secret };
    });
  }

  remove(storeId: string, id: string, actor: AuthUser, meta: RequestMeta): Promise<void> {
    return this.tenantDb.run(storeId, async (tx) => {
      const sub = await this.find(tx, storeId, id);
      await tx.webhookSubscription.delete({ where: { id: sub.id } });
      await this.audit.record(tx, {
        storeId,
        actorUserId: actor.id,
        action: 'webhook.deleted',
        entityType: 'webhook',
        entityId: id,
        data: { topic: sub.topic, url: sub.url },
        meta,
      });
    });
  }

  /** Re-enables a subscription that was switched off after repeated failures. */
  enable(storeId: string, id: string): Promise<Webhook> {
    return this.tenantDb.run(storeId, async (tx) => {
      await this.find(tx, storeId, id);
      return this.toDto(
        await tx.webhookSubscription.update({
          where: { id },
          data: { disabledAt: null, failureCount: 0 },
        }),
      );
    });
  }

  deliveries(storeId: string, id: string): Promise<WebhookDelivery[]> {
    return this.tenantDb.run(storeId, async (tx) => {
      await this.find(tx, storeId, id);
      const rows = await tx.webhookDelivery.findMany({
        where: { storeId, subscriptionId: id },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });
      return rows.map((d) => ({
        id: d.id,
        topic: d.topic,
        status: d.status,
        attempts: d.attempts,
        lastStatusCode: d.lastStatusCode,
        lastError: d.lastError,
        createdAt: d.createdAt.toISOString(),
        deliveredAt: d.deliveredAt?.toISOString() ?? null,
      }));
    });
  }

  /**
   * Sends due deliveries. Each batch is claimed with a short lease (SKIP LOCKED), then sent
   * outside any transaction, so several workers can run this and slow receivers never hold
   * database locks.
   */
  async deliverDue(limit = 20): Promise<number> {
    const claimed = await this.platformDb.$queryRaw<{ id: string }[]>`
      UPDATE "WebhookDelivery" SET "nextAttemptAt" = now() + make_interval(secs => ${LEASE_MS / 1000})
      WHERE id IN (
        SELECT id FROM "WebhookDelivery"
        WHERE status = 'PENDING' AND "nextAttemptAt" <= now()
        ORDER BY "nextAttemptAt"
        LIMIT ${limit}
        FOR UPDATE SKIP LOCKED)
      RETURNING id`;
    for (const { id } of claimed) await this.deliver(id);
    return claimed.length;
  }

  private async deliver(id: string): Promise<void> {
    const delivery = await this.platformDb.webhookDelivery.findUniqueOrThrow({
      where: { id },
      include: { subscription: true },
    });
    const { subscription } = delivery;
    if (subscription.disabledAt) {
      await this.platformDb.webhookDelivery.update({
        where: { id },
        data: { status: 'FAILED', lastError: 'Subscription disabled' },
      });
      return;
    }
    const body = JSON.stringify(delivery.payload);
    const secret = decryptSecret(this.env.APP_ENCRYPTION_KEY, subscription.secretEncrypted);
    let status = 0;
    let error: string | null = null;
    try {
      ({ status } = await postJson(
        subscription.url,
        body,
        {
          [WEBHOOK_HEADERS.topic]: delivery.topic,
          [WEBHOOK_HEADERS.storeId]: delivery.storeId,
          [WEBHOOK_HEADERS.deliveryId]: delivery.id,
          [WEBHOOK_HEADERS.signature]: createHmac('sha256', secret).update(body).digest('base64'),
          'user-agent': 'CommercePlatform-Webhooks/1.0',
        },
        { allowPrivate: allowPrivateWebhooks(this.env) },
      ));
      if (status < 200 || status >= 300) error = `HTTP ${status}`;
    } catch (e) {
      error = String(e instanceof Error ? e.message : e).slice(0, 300);
    }

    const attempts = delivery.attempts + 1;
    if (!error) {
      await this.platformDb.$transaction([
        this.platformDb.webhookDelivery.update({
          where: { id },
          data: {
            status: 'SUCCEEDED',
            attempts,
            lastStatusCode: status,
            lastError: null,
            deliveredAt: new Date(),
          },
        }),
        this.platformDb.webhookSubscription.update({
          where: { id: subscription.id },
          data: { failureCount: 0 },
        }),
      ]);
      return;
    }
    const delay = RETRY_DELAYS_MS[attempts - 1];
    const failures = subscription.failureCount + 1;
    await this.platformDb.$transaction([
      this.platformDb.webhookDelivery.update({
        where: { id },
        data: {
          attempts,
          lastStatusCode: status || null,
          lastError: error,
          ...(delay === undefined
            ? { status: 'FAILED' }
            : { nextAttemptAt: new Date(Date.now() + delay) }),
        },
      }),
      this.platformDb.webhookSubscription.update({
        where: { id: subscription.id },
        data: {
          failureCount: failures,
          ...(failures >= DISABLE_AFTER_FAILURES ? { disabledAt: new Date() } : {}),
        },
      }),
    ]);
    this.logger.warn(`Webhook ${id} (${delivery.topic}) attempt ${attempts} failed: ${error}`);
  }

  private async find(tx: TenantTx, storeId: string, id: string): Promise<WebhookSubscription> {
    const sub = await tx.webhookSubscription.findFirst({ where: { id, storeId } });
    if (!sub) throw new NotFoundException('Webhook not found.');
    return sub;
  }

  private toDto(s: WebhookSubscription): Webhook {
    return {
      id: s.id,
      topic: s.topic as WebhookTopic,
      url: s.url,
      failureCount: s.failureCount,
      disabled: s.disabledAt !== null,
      createdAt: s.createdAt.toISOString(),
    };
  }
}

/** Global so any module (orders, catalog) can emit webhooks from its transactions. */
@Global()
@Module({ providers: [WebhookEmitter], exports: [WebhookEmitter] })
export class WebhooksCoreModule {}
