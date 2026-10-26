import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { AbandonedCheckout, CreatedCart, PaginationQuery, Paginated } from '@repo/contracts';
import type { Prisma, PrismaClient, TenantTx } from '@repo/db';
import { PLATFORM_DB, TenantDb } from '../database/database.module.js';
import { OrderLifecycle } from '../orders/order-lifecycle.service.js';
import { StoreUrls } from '../orders/store-urls.js';
import { OutboxService } from '../outbox/outbox.service.js';
import { abandonedCheckoutEmail } from '../outbox/templates.js';
import { CartService } from '../storefront/cart.service.js';
import type { ShopContext } from '../storefront/store-resolver.js';
import { liveProductWhere } from '../catalog/product-visibility.js';

/** Unpaid orders cancelled by the payment timeout are the store's abandoned checkouts. */
const ABANDONED = { status: 'CANCELLED', cancelReason: 'payment_timeout' } as const;
/** Older checkouts are never emailed, and their recovery links stop working. */
const MAX_AGE_DAYS = 7;
const LINK_MAX_AGE_DAYS = 30;

@Injectable()
export class CheckoutRecoveryService {
  private readonly logger = new Logger(CheckoutRecoveryService.name);

  constructor(
    private readonly tenantDb: TenantDb,
    private readonly outbox: OutboxService,
    private readonly urls: StoreUrls,
    private readonly carts: CartService,
    private readonly lifecycle: OrderLifecycle,
    @Inject(PLATFORM_DB) private readonly platformDb: PrismaClient,
  ) {}

  /**
   * Emails shoppers whose checkout expired unpaid, once the store's delay has passed. Each
   * checkout is handled once (claimed inside its tenant transaction), so several workers can run
   * this concurrently.
   */
  async sendDue(limit = 50): Promise<number> {
    const due = await this.platformDb.$queryRaw<{ id: string; storeId: string }[]>`
      SELECT o.id, o."storeId"
      FROM "Order" o
      JOIN "Store" s ON s.id = o."storeId"
      WHERE o.status = 'CANCELLED'
        AND o."recoveryStatus" IS NULL
        AND o."cancelReason" = 'payment_timeout'
        AND s.status = 'ACTIVE'
        AND s."abandonedCheckoutDelayHours" IS NOT NULL
        AND o."createdAt" <= now() - make_interval(hours => s."abandonedCheckoutDelayHours")
        AND o."createdAt" > now() - make_interval(days => ${MAX_AGE_DAYS})
      ORDER BY o."createdAt"
      LIMIT ${limit}`;
    let sent = 0;
    for (const { id, storeId } of due) {
      try {
        if (await this.tenantDb.run(storeId, (tx) => this.handle(tx, storeId, id))) sent++;
      } catch (error) {
        this.logger.error(`Recovery email for order ${id} failed: ${String(error)}`);
      }
    }
    return sent;
  }

  private async handle(tx: TenantTx, storeId: string, orderId: string): Promise<boolean> {
    // Claim first: a concurrent worker that already handled it updates nothing here.
    const claimed = await tx.order.updateMany({
      where: { id: orderId, storeId, recoveryStatus: null },
      data: { recoveryStatus: 'SKIPPED' },
    });
    if (claimed.count === 0) return false;

    const order = await tx.order.findUniqueOrThrow({
      where: { id: orderId },
      include: { lines: true },
    });
    // The shopper already came back (paid, or another checkout is open or newer).
    const later = await tx.order.findFirst({
      where: {
        storeId,
        id: { not: order.id },
        email: { equals: order.email, mode: 'insensitive' },
        createdAt: { gt: order.createdAt },
        OR: [{ status: { in: ['OPEN', 'PENDING_PAYMENT'] } }, { paidAt: { not: null } }],
      },
      select: { id: true },
    });
    const buyable = await tx.productVariant.count({
      where: {
        storeId,
        id: { in: order.lines.flatMap((l) => (l.variantId ? [l.variantId] : [])) },
        product: liveProductWhere(),
      },
    });
    if (later || buyable === 0) return false;

    const store = await tx.store.findUniqueOrThrow({ where: { id: storeId } });
    const primary = await tx.domain.findFirst({
      where: { storeId, isPrimary: true, verifiedAt: { not: null } },
    });
    const origin = this.urls.storefrontOrigin(store.subdomain, primary?.hostname);
    await this.outbox.enqueueEmail(
      tx,
      storeId,
      abandonedCheckoutEmail(order.email, {
        storeName: store.name,
        currency: order.currency,
        lines: order.lines.map((l) => ({
          title: l.title,
          variantTitle: l.variantTitle,
          quantity: l.quantity,
          total: l.unitPrice * l.quantity - l.discountTotal,
        })),
        recoverUrl: `${origin}/cart/recover/${this.urls.checkoutRecoveryToken(order.id)}`,
      }),
    );
    await tx.order.update({
      where: { id: order.id },
      data: { recoveryStatus: 'SENT', recoveryEmailSentAt: new Date() },
    });
    await this.lifecycle.event(
      tx,
      storeId,
      order.id,
      'recovery_email_sent',
      `Abandoned checkout email sent to ${order.email}.`,
    );
    return true;
  }

  /** Rebuilds the abandoned checkout's items as a new cart (any device, no sign-in). */
  async recoverCart(shop: ShopContext, token: string): Promise<CreatedCart> {
    const orderId = this.urls.verifyCheckoutRecoveryToken(token);
    if (!orderId) throw new NotFoundException('This link is not valid.');
    const order = await this.tenantDb.run(shop.id, (tx) =>
      tx.order.findFirst({
        where: {
          id: orderId,
          storeId: shop.id,
          ...ABANDONED,
          createdAt: { gt: new Date(Date.now() - LINK_MAX_AGE_DAYS * 24 * 60 * 60 * 1000) },
        },
        include: { lines: true },
      }),
    );
    if (!order) throw new NotFoundException('This link has expired.');
    return this.carts.createWithLines(
      shop,
      order.lines.flatMap((l) =>
        l.variantId ? [{ variantId: l.variantId, quantity: l.quantity }] : [],
      ),
    );
  }

  list(storeId: string, query: PaginationQuery): Promise<Paginated<AbandonedCheckout>> {
    return this.tenantDb.run(storeId, async (tx) => {
      const where: Prisma.OrderWhereInput = { storeId, ...ABANDONED };
      const [rows, total] = await Promise.all([
        tx.order.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
          include: { lines: { select: { quantity: true } } },
        }),
        tx.order.count({ where }),
      ]);
      const oldest = rows.at(-1)?.createdAt;
      const paid = oldest
        ? await tx.order.findMany({
            where: {
              storeId,
              paidAt: { not: null },
              createdAt: { gt: oldest },
              email: { in: [...new Set(rows.map((r) => r.email))], mode: 'insensitive' },
            },
            orderBy: { createdAt: 'asc' },
            select: { id: true, number: true, email: true, createdAt: true },
          })
        : [];
      return {
        items: rows.map((r) => {
          const recovered = paid.find(
            (p) => p.email.toLowerCase() === r.email.toLowerCase() && p.createdAt > r.createdAt,
          );
          return {
            id: r.id,
            email: r.email,
            currency: r.currency,
            total: r.total,
            itemCount: r.lines.reduce((sum, l) => sum + l.quantity, 0),
            createdAt: r.createdAt.toISOString(),
            recoveryStatus: r.recoveryStatus ?? 'PENDING',
            recoveryEmailSentAt: r.recoveryEmailSentAt?.toISOString() ?? null,
            recoveredOrder: recovered ? { id: recovered.id, number: recovered.number } : null,
          };
        }),
        page: query.page,
        pageSize: query.pageSize,
        total,
      };
    });
  }
}
