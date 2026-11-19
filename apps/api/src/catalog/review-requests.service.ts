import {
  Controller,
  HttpCode,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { PrismaClient, TenantTx } from '@repo/db';
import { Public } from '../auth/auth.guard.js';
import { PLATFORM_DB, TenantDb } from '../database/database.module.js';
import { OrderLifecycle } from '../orders/order-lifecycle.service.js';
import { StoreUrls } from '../orders/store-urls.js';
import { OutboxService } from '../outbox/outbox.service.js';
import { reviewRequestEmail } from '../outbox/templates.js';
import { CurrentShop, StorefrontGuard } from '../storefront/storefront.guard.js';
import type { ShopContext } from '../storefront/store-resolver.js';
import { liveProductWhere } from './product-visibility.js';

/**
 * Orders shipped longer ago than this past the store's delay are never emailed: turning the app on
 * does not mail every old customer.
 */
const WINDOW_DAYS = 14;

/**
 * Product reviews app: once an order has shipped and the store's delay has passed, asks the buyer
 * (once) to review what they bought.
 */
@Injectable()
export class ReviewRequestsService {
  private readonly logger = new Logger(ReviewRequestsService.name);

  constructor(
    private readonly tenantDb: TenantDb,
    private readonly outbox: OutboxService,
    private readonly urls: StoreUrls,
    private readonly lifecycle: OrderLifecycle,
    @Inject(PLATFORM_DB) private readonly platformDb: PrismaClient,
  ) {}

  async sendDue(limit = 50): Promise<number> {
    const due = await this.platformDb.$queryRaw<{ id: string; storeId: string }[]>`
      WITH settings AS (
        SELECT s.id, COALESCE((s.apps -> 'productReviews' ->> 'requestAfterDays')::int, 7) AS days
        FROM "Store" s
        WHERE s.status = 'ACTIVE'
          AND (s.apps -> 'productReviews' ->> 'enabled') = 'true'
      ),
      shipped AS (
        SELECT o.id, o."storeId", st.days, MAX(f."createdAt") AS shipped_at
        FROM "Order" o
        JOIN settings st ON st.id = o."storeId" AND st.days > 0
        JOIN "Fulfillment" f ON f."orderId" = o.id
        WHERE o."reviewRequestSentAt" IS NULL
          AND o."fulfillmentStatus" = 'FULFILLED'
          AND o."paidAt" IS NOT NULL
          AND o.status <> 'CANCELLED'
          AND o."financialStatus" <> 'REFUNDED'
          AND o."customerId" IS NOT NULL
        GROUP BY o.id, o."storeId", st.days
      )
      SELECT id, "storeId" FROM shipped
      WHERE shipped_at <= now() - make_interval(days => days)
        AND shipped_at > now() - make_interval(days => days + ${WINDOW_DAYS})
      ORDER BY shipped_at
      LIMIT ${limit}`;
    let sent = 0;
    for (const { id, storeId } of due) {
      try {
        if (await this.tenantDb.run(storeId, (tx) => this.handle(tx, storeId, id))) sent++;
      } catch (error) {
        this.logger.error(`Review request for order ${id} failed: ${String(error)}`);
      }
    }
    return sent;
  }

  private async handle(tx: TenantTx, storeId: string, orderId: string): Promise<boolean> {
    // Claim first, so the order is asked at most once even with several workers.
    const claimed = await tx.order.updateMany({
      where: { id: orderId, storeId, reviewRequestSentAt: null },
      data: { reviewRequestSentAt: new Date() },
    });
    if (claimed.count === 0) return false;
    const order = await tx.order.findUniqueOrThrow({
      where: { id: orderId },
      select: {
        number: true,
        email: true,
        customerId: true,
        customer: { select: { reviewEmailsOptOutAt: true } },
        lines: { select: { productId: true, quantity: true } },
      },
    });
    if (!order.customerId || order.customer?.reviewEmailsOptOutAt) return false;
    const productIds = [
      ...new Set(order.lines.flatMap((l) => (l.productId && l.quantity > 0 ? [l.productId] : []))),
    ];
    // Products still on sale that this customer has not reviewed yet.
    const products = await tx.product.findMany({
      where: {
        storeId,
        id: { in: productIds },
        isGiftCard: false,
        ...liveProductWhere(),
        reviews: { none: { customerId: order.customerId } },
      },
      select: { title: true, handle: true },
      orderBy: { title: 'asc' },
      take: 10,
    });
    if (products.length === 0) return false;

    const store = await tx.store.findUniqueOrThrow({ where: { id: storeId } });
    const primary = await tx.domain.findFirst({
      where: { storeId, isPrimary: true, verifiedAt: { not: null } },
    });
    const origin = this.urls.storefrontOrigin(store.subdomain, primary?.hostname);
    await this.outbox.enqueueEmail(
      tx,
      storeId,
      reviewRequestEmail(order.email, {
        storeName: store.name,
        orderNumber: order.number,
        products: products.map((p) => ({
          title: p.title,
          url: `${origin}/products/${p.handle}#reviews`,
        })),
        unsubscribeUrl: `${origin}/reviews/emails-off/${this.urls.reviewEmailsToken(order.customerId)}`,
      }),
    );
    await this.lifecycle.event(
      tx,
      storeId,
      orderId,
      'review_request_sent',
      `Review request emailed to ${order.email}.`,
    );
    return true;
  }

  /** Turns review request emails off for the customer a link was sent to. */
  async optOut(shop: ShopContext, token: string): Promise<void> {
    const customerId = this.urls.verifyReviewEmailsToken(token);
    if (!customerId) throw new NotFoundException('This link is not valid.');
    const updated = await this.tenantDb.run(shop.id, (tx) =>
      tx.customer.updateMany({
        where: { id: customerId, storeId: shop.id, reviewEmailsOptOutAt: null },
        data: { reviewEmailsOptOutAt: new Date() },
      }),
    );
    if (updated.count === 0) {
      const exists = await this.tenantDb.run(shop.id, (tx) =>
        tx.customer.count({ where: { id: customerId, storeId: shop.id } }),
      );
      if (exists === 0) throw new NotFoundException('This link is not valid.');
    }
  }
}

@ApiTags('Storefront')
@Public()
@UseGuards(StorefrontGuard)
@Controller('storefront/review-emails')
export class StorefrontReviewEmailsController {
  constructor(private readonly requests: ReviewRequestsService) {}

  /** A POST (from a button), so link scanners in mail systems cannot turn emails off. */
  @Post('off/:token')
  @HttpCode(204)
  async off(@CurrentShop() shop: ShopContext, @Param('token') token: string): Promise<void> {
    await this.requests.optOut(shop, token.slice(0, 200));
  }
}
