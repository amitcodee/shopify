import {
  Body,
  ConflictException,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  Injectable,
  NotFoundException,
  Param,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  type AdminReview,
  adminReviewQuerySchema,
  type MyReview,
  type Paginated,
  type ProductReviews,
  ratingOf,
  reviewerName,
  reviewInputSchema,
  reviewReplyInputSchema,
  REVIEWS_PAGE_SIZE,
  STOREFRONT_HEADERS,
} from '@repo/contracts';
import type { Customer, Prisma, TenantTx } from '@repo/db';
import type { Request } from 'express';
import { z } from 'zod';
import { AuditService } from '../audit/audit.service.js';
import { Public } from '../auth/auth.guard.js';
import type { AuthUser, RequestMeta, StoreContext } from '../common/request.js';
import { CurrentStore, CurrentUser, ReqMeta } from '../common/request.js';
import { UuidParam } from '../common/uuid-param.pipe.js';
import { ApiZodBody, ZodPipe } from '../common/zod.js';
import { CustomerAuthService } from '../customers/customer-auth.service.js';
import { TenantDb } from '../database/database.module.js';
import { liveProductWhere } from './product-visibility.js';
import { CurrentShop, StorefrontGuard } from '../storefront/storefront.guard.js';
import type { ShopContext } from '../storefront/store-resolver.js';
import { RequirePermission, StoreAccessGuard } from '../tenancy/store-access.guard.js';

type ReviewInput = z.output<typeof reviewInputSchema>;
type AdminQuery = z.output<typeof adminReviewQuerySchema>;

const ADMIN_PAGE_SIZE = 25;

const adminInclude = {
  product: { select: { id: true, title: true, handle: true } },
  customer: { select: { id: true, email: true } },
  order: { select: { id: true, number: true } },
} satisfies Prisma.ProductReviewInclude;

type AdminRow = Prisma.ProductReviewGetPayload<{ include: typeof adminInclude }>;

function toAdmin(r: AdminRow): AdminReview {
  return {
    id: r.id,
    status: r.status,
    rating: r.rating,
    title: r.title,
    body: r.body,
    authorName: r.authorName,
    reply: r.reply,
    product: r.product,
    customer: r.customer,
    order: r.order,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    publishedAt: r.publishedAt?.toISOString() ?? null,
  };
}

/** Recounts a product's published reviews into its counters (cards and JSON-LD read them). */
export async function refreshProductRating(tx: TenantTx, storeId: string, productId: string) {
  const agg = await tx.productReview.aggregate({
    where: { storeId, productId, status: 'PUBLISHED' },
    _count: { _all: true },
    _sum: { rating: true },
  });
  await tx.product.update({
    where: { id: productId },
    data: { reviewCount: agg._count._all, ratingSum: agg._sum.rating ?? 0 },
  });
}

@Injectable()
export class ProductReviewsService {
  constructor(
    private readonly tenantDb: TenantDb,
    private readonly customers: CustomerAuthService,
    private readonly audit: AuditService,
  ) {}

  private async liveProduct(tx: TenantTx, shop: ShopContext, handle: string) {
    const product = await tx.product.findFirst({
      where: { storeId: shop.id, handle, ...liveProductWhere() },
      select: { id: true, reviewCount: true, ratingSum: true },
    });
    if (!product) throw new NotFoundException('Product not found.');
    return product;
  }

  private requireApp(shop: ShopContext) {
    if (!shop.apps.productReviews.enabled) throw new NotFoundException('Reviews are off.');
  }

  /** The latest paid, not cancelled order of this customer that holds the product. */
  private purchase(tx: TenantTx, storeId: string, customerId: string, productId: string) {
    return tx.order.findFirst({
      where: {
        storeId,
        customerId,
        status: { not: 'CANCELLED' },
        paidAt: { not: null },
        lines: { some: { productId, quantity: { gt: 0 } } },
      },
      orderBy: { paidAt: 'desc' },
      select: { id: true },
    });
  }

  /** Published reviews, newest first, with the star breakdown. */
  list(shop: ShopContext, handle: string, page: number): Promise<ProductReviews> {
    this.requireApp(shop);
    return this.tenantDb.run(shop.id, async (tx) => {
      const product = await this.liveProduct(tx, shop, handle);
      const where = { storeId: shop.id, productId: product.id, status: 'PUBLISHED' as const };
      const [groups, items] = await Promise.all([
        tx.productReview.groupBy({ by: ['rating'], where, _count: { _all: true } }),
        tx.productReview.findMany({
          where,
          orderBy: [{ publishedAt: 'desc' }, { id: 'desc' }],
          skip: (page - 1) * REVIEWS_PAGE_SIZE,
          take: REVIEWS_PAGE_SIZE,
        }),
      ]);
      const distribution = [5, 4, 3, 2, 1].map(
        (stars) => groups.find((g) => g.rating === stars)?._count._all ?? 0,
      );
      const count = distribution.reduce((s, n) => s + n, 0);
      const sum = groups.reduce((s, g) => s + g.rating * g._count._all, 0);
      return {
        rating: ratingOf(count, sum),
        distribution,
        items: items.map((r) => ({
          id: r.id,
          rating: r.rating,
          title: r.title,
          body: r.body,
          authorName: r.authorName,
          date: (r.publishedAt ?? r.createdAt).toISOString(),
          reply: r.reply,
        })),
        page,
        pageCount: Math.max(1, Math.ceil(count / REVIEWS_PAGE_SIZE)),
      };
    });
  }

  private async customerOrNull(shop: ShopContext, token: string | null): Promise<Customer | null> {
    return token ? this.customers.current(shop, token) : null;
  }

  /** Whether the signed-in shopper may review the product, and their review if any. */
  async mine(shop: ShopContext, token: string | null, handle: string): Promise<MyReview> {
    this.requireApp(shop);
    const customer = await this.customerOrNull(shop, token);
    return this.tenantDb.run(shop.id, async (tx) => {
      const product = await this.liveProduct(tx, shop, handle);
      if (!customer) {
        return {
          canReview: false,
          reason: 'Sign in to review a product you bought.',
          suggestedName: '',
          review: null,
        };
      }
      const [review, bought] = await Promise.all([
        tx.productReview.findUnique({
          where: {
            storeId_productId_customerId: {
              storeId: shop.id,
              productId: product.id,
              customerId: customer.id,
            },
          },
        }),
        this.purchase(tx, shop.id, customer.id, product.id),
      ]);
      const canReview = review !== null || bought !== null;
      return {
        canReview,
        reason: canReview ? null : 'Only customers who bought this product can review it.',
        suggestedName: reviewerName(customer.name, customer.email),
        review: review && {
          rating: review.rating,
          title: review.title,
          body: review.body,
          authorName: review.authorName,
          status: review.status,
        },
      };
    });
  }

  /** Writes or replaces the shopper's review. */
  async save(
    shop: ShopContext,
    token: string | null,
    handle: string,
    input: ReviewInput,
  ): Promise<MyReview> {
    this.requireApp(shop);
    const customer = await this.customers.requireCurrent(shop, token);
    await this.tenantDb.run(shop.id, async (tx) => {
      const product = await this.liveProduct(tx, shop, handle);
      const key = { storeId: shop.id, productId: product.id, customerId: customer.id };
      const existing = await tx.productReview.findUnique({
        where: { storeId_productId_customerId: key },
      });
      const order = await this.purchase(tx, shop.id, customer.id, product.id);
      if (!order && !existing) {
        throw new ForbiddenException('Only customers who bought this product can review it.');
      }
      if (existing?.status === 'REJECTED') {
        throw new ConflictException('This review was not approved by the store.');
      }
      const autoPublish = shop.apps.productReviews.autoPublish;
      const now = new Date();
      const fields = {
        rating: input.rating,
        title: input.title,
        body: input.body,
        authorName: input.authorName,
        status: autoPublish ? ('PUBLISHED' as const) : ('PENDING' as const),
        publishedAt: autoPublish ? now : null,
      };
      if (existing) {
        await tx.productReview.update({ where: { id: existing.id }, data: fields });
      } else {
        await tx.productReview.create({ data: { ...key, orderId: order!.id, ...fields } });
      }
      await refreshProductRating(tx, shop.id, product.id);
    });
    return this.mine(shop, token, handle);
  }

  adminList(store: StoreContext, query: AdminQuery): Promise<Paginated<AdminReview>> {
    return this.tenantDb.run(store.id, async (tx) => {
      const where = { storeId: store.id, ...(query.status ? { status: query.status } : {}) };
      const [items, total] = await Promise.all([
        tx.productReview.findMany({
          where,
          include: adminInclude,
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          skip: (query.page - 1) * ADMIN_PAGE_SIZE,
          take: ADMIN_PAGE_SIZE,
        }),
        tx.productReview.count({ where }),
      ]);
      return { items: items.map(toAdmin), page: query.page, pageSize: ADMIN_PAGE_SIZE, total };
    });
  }

  private async change(
    store: StoreContext,
    id: string,
    actor: AuthUser,
    meta: RequestMeta,
    action: string,
    data: (r: AdminRow) => Prisma.ProductReviewUpdateInput | null,
  ): Promise<AdminReview | null> {
    return this.tenantDb.run(store.id, async (tx) => {
      const review = await tx.productReview.findFirst({
        where: { id, storeId: store.id },
        include: adminInclude,
      });
      if (!review) throw new NotFoundException('Review not found.');
      const update = data(review);
      const result = update
        ? await tx.productReview.update({ where: { id }, data: update, include: adminInclude })
        : (await tx.productReview.delete({ where: { id } }), null);
      await refreshProductRating(tx, store.id, review.productId);
      await this.audit.record(tx, {
        storeId: store.id,
        actorUserId: actor.id,
        action,
        entityType: 'product',
        entityId: review.productId,
        data: { reviewId: id },
        meta,
      });
      return result && toAdmin(result);
    });
  }

  publish(store: StoreContext, id: string, actor: AuthUser, meta: RequestMeta) {
    return this.change(store, id, actor, meta, 'review.published', (r) => ({
      status: 'PUBLISHED',
      publishedAt: r.publishedAt ?? new Date(),
    }));
  }

  reject(store: StoreContext, id: string, actor: AuthUser, meta: RequestMeta) {
    return this.change(store, id, actor, meta, 'review.rejected', () => ({
      status: 'REJECTED',
      publishedAt: null,
    }));
  }

  reply(store: StoreContext, id: string, reply: string, actor: AuthUser, meta: RequestMeta) {
    return this.change(store, id, actor, meta, 'review.replied', () => ({
      reply: reply || null,
      repliedAt: reply ? new Date() : null,
    }));
  }

  remove(store: StoreContext, id: string, actor: AuthUser, meta: RequestMeta) {
    return this.change(store, id, actor, meta, 'review.deleted', () => null);
  }
}

const pageSchema = z.object({ page: z.coerce.number().int().min(1).max(1000).default(1) });

@ApiTags('Storefront')
@Public()
@UseGuards(StorefrontGuard)
@Controller('storefront/products/:handle/reviews')
export class StorefrontReviewsController {
  constructor(private readonly reviews: ProductReviewsService) {}

  @Get()
  list(
    @CurrentShop() shop: ShopContext,
    @Param('handle') handle: string,
    @Query(new ZodPipe(pageSchema)) query: z.infer<typeof pageSchema>,
  ): Promise<ProductReviews> {
    return this.reviews.list(shop, handle.slice(0, 200), query.page);
  }

  @Get('mine')
  mine(
    @CurrentShop() shop: ShopContext,
    @Req() req: Request,
    @Param('handle') handle: string,
  ): Promise<MyReview> {
    const token = req.headers[STOREFRONT_HEADERS.customer];
    return this.reviews.mine(shop, typeof token === 'string' ? token : null, handle.slice(0, 200));
  }

  @Put('mine')
  @ApiZodBody(reviewInputSchema)
  save(
    @CurrentShop() shop: ShopContext,
    @Req() req: Request,
    @Param('handle') handle: string,
    @Body(new ZodPipe(reviewInputSchema)) body: ReviewInput,
  ): Promise<MyReview> {
    const token = req.headers[STOREFRONT_HEADERS.customer];
    return this.reviews.save(
      shop,
      typeof token === 'string' ? token : null,
      handle.slice(0, 200),
      body,
    );
  }
}

@ApiTags('Products')
@ApiBearerAuth()
@UseGuards(StoreAccessGuard)
@Controller('admin/stores/:storeId/reviews')
export class ReviewsController {
  constructor(private readonly reviews: ProductReviewsService) {}

  @Get()
  @RequirePermission('products:read')
  list(
    @CurrentStore() store: StoreContext,
    @Query(new ZodPipe(adminReviewQuerySchema)) query: AdminQuery,
  ): Promise<Paginated<AdminReview>> {
    return this.reviews.adminList(store, query);
  }

  @Post(':reviewId/publish')
  @HttpCode(200)
  @RequirePermission('products:write')
  publish(
    @CurrentStore() store: StoreContext,
    @CurrentUser() user: AuthUser,
    @Param('reviewId', UuidParam) id: string,
    @ReqMeta() meta: RequestMeta,
  ) {
    return this.reviews.publish(store, id, user, meta);
  }

  @Post(':reviewId/reject')
  @HttpCode(200)
  @RequirePermission('products:write')
  reject(
    @CurrentStore() store: StoreContext,
    @CurrentUser() user: AuthUser,
    @Param('reviewId', UuidParam) id: string,
    @ReqMeta() meta: RequestMeta,
  ) {
    return this.reviews.reject(store, id, user, meta);
  }

  @Put(':reviewId/reply')
  @RequirePermission('products:write')
  @ApiZodBody(reviewReplyInputSchema)
  reply(
    @CurrentStore() store: StoreContext,
    @CurrentUser() user: AuthUser,
    @Param('reviewId', UuidParam) id: string,
    @Body(new ZodPipe(reviewReplyInputSchema)) body: z.output<typeof reviewReplyInputSchema>,
    @ReqMeta() meta: RequestMeta,
  ) {
    return this.reviews.reply(store, id, body.reply, user, meta);
  }

  @Delete(':reviewId')
  @HttpCode(204)
  @RequirePermission('products:write')
  async remove(
    @CurrentStore() store: StoreContext,
    @CurrentUser() user: AuthUser,
    @Param('reviewId', UuidParam) id: string,
    @ReqMeta() meta: RequestMeta,
  ): Promise<void> {
    await this.reviews.remove(store, id, user, meta);
  }
}
