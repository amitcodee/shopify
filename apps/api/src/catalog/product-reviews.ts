import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  Inject,
  Injectable,
  NotFoundException,
  Param,
  Post,
  Put,
  Query,
  Req,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import {
  type AdminReview,
  adminReviewQuerySchema,
  MAX_REVIEW_PHOTO_BYTES,
  MAX_REVIEW_PHOTOS,
  type MyReview,
  type Paginated,
  type ProductReviews,
  type ProductReviewsQuery,
  productReviewsQuerySchema,
  ratingOf,
  type ReviewHelpful,
  reviewHelpfulInputSchema,
  type ReviewPhoto,
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
import { ImageProcessor, type ProcessedImage } from '../storage/image-processor.js';
import { MediaUrls } from '../storage/storage.module.js';
import { imageKeys, OBJECT_STORAGE, type ObjectStorage, renditionKey } from '../storage/storage.js';
import { liveProductWhere } from './product-visibility.js';
import { CurrentShop, StorefrontGuard } from '../storefront/storefront.guard.js';
import type { ShopContext } from '../storefront/store-resolver.js';
import { RequirePermission, StoreAccessGuard } from '../tenancy/store-access.guard.js';

type ReviewInput = z.output<typeof reviewInputSchema>;
type AdminQuery = z.output<typeof adminReviewQuerySchema>;

const ADMIN_PAGE_SIZE = 25;

/** Review photos keep only renditions up to this width (the list shows 600 px). */
const PHOTO_WIDTHS = [600, 1200];

const photosInclude = { orderBy: { position: 'asc' as const } };

const adminInclude = {
  product: { select: { id: true, title: true, handle: true } },
  customer: { select: { id: true, email: true } },
  order: { select: { id: true, number: true } },
  photos: photosInclude,
} satisfies Prisma.ProductReviewInclude;

type AdminRow = Prisma.ProductReviewGetPayload<{ include: typeof adminInclude }>;
type PhotoRow = AdminRow['photos'][number];

/** The largest stored copy at or below `max` px wide (the original when it is narrower). */
function photoUrl(media: MediaUrls, p: PhotoRow, max: number): string {
  if (p.width <= max) return media.url(p.storageKey);
  const fit = [...p.renditionWidths].filter((w) => w <= max).sort((a, b) => b - a)[0];
  return media.url(fit ? renditionKey(p.storageKey, fit) : p.storageKey);
}

function toPhoto(media: MediaUrls, p: PhotoRow): ReviewPhoto {
  return {
    id: p.id,
    url: photoUrl(media, p, 1200),
    thumbUrl: photoUrl(media, p, 600),
    width: p.width,
    height: p.height,
  };
}

function toAdmin(r: AdminRow, media: MediaUrls): AdminReview {
  return {
    photos: r.photos.map((p) => toPhoto(media, p)),
    id: r.id,
    status: r.status,
    rating: r.rating,
    title: r.title,
    body: r.body,
    authorName: r.authorName,
    reply: r.reply,
    helpfulCount: r.helpfulCount,
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
    private readonly images: ImageProcessor,
    private readonly media: MediaUrls,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
  ) {}

  private async deleteObjects(photos: { storageKey: string; renditionWidths: number[] }[]) {
    for (const key of photos.flatMap(imageKeys)) {
      await this.storage.delete(key).catch(() => undefined);
    }
  }

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

  /** Published reviews in the chosen order, optionally of one star rating, with the breakdown. */
  list(shop: ShopContext, handle: string, query: ProductReviewsQuery): Promise<ProductReviews> {
    this.requireApp(shop);
    const { page, sort } = query;
    const stars = query.stars ?? null;
    return this.tenantDb.run(shop.id, async (tx) => {
      const product = await this.liveProduct(tx, shop, handle);
      const where = { storeId: shop.id, productId: product.id, status: 'PUBLISHED' as const };
      const newest: Prisma.ProductReviewOrderByWithRelationInput[] = [
        { publishedAt: 'desc' },
        { id: 'desc' },
      ];
      const orderBy: Prisma.ProductReviewOrderByWithRelationInput[] =
        sort === 'helpful'
          ? [{ helpfulCount: 'desc' }, ...newest]
          : sort === 'highest'
            ? [{ rating: 'desc' }, ...newest]
            : sort === 'lowest'
              ? [{ rating: 'asc' }, ...newest]
              : newest;
      const [groups, items] = await Promise.all([
        tx.productReview.groupBy({ by: ['rating'], where, _count: { _all: true } }),
        tx.productReview.findMany({
          where: stars ? { ...where, rating: stars } : where,
          orderBy,
          skip: (page - 1) * REVIEWS_PAGE_SIZE,
          take: REVIEWS_PAGE_SIZE,
          include: { photos: photosInclude },
        }),
      ]);
      const distribution = [5, 4, 3, 2, 1].map(
        (stars) => groups.find((g) => g.rating === stars)?._count._all ?? 0,
      );
      const count = distribution.reduce((s, n) => s + n, 0);
      const sum = groups.reduce((s, g) => s + g.rating * g._count._all, 0);
      const total = stars ? (distribution[5 - stars] ?? 0) : count;
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
          helpfulCount: r.helpfulCount,
          photos: r.photos.map((p) => toPhoto(this.media, p)),
        })),
        page,
        pageCount: Math.max(1, Math.ceil(total / REVIEWS_PAGE_SIZE)),
        sort,
        stars,
        total,
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
          helpfulReviewIds: [],
        };
      }
      const [review, bought, votes] = await Promise.all([
        tx.productReview.findUnique({
          where: {
            storeId_productId_customerId: {
              storeId: shop.id,
              productId: product.id,
              customerId: customer.id,
            },
          },
          include: { photos: photosInclude },
        }),
        this.purchase(tx, shop.id, customer.id, product.id),
        tx.productReviewVote.findMany({
          where: { storeId: shop.id, customerId: customer.id, review: { productId: product.id } },
          select: { reviewId: true },
        }),
      ]);
      const canReview = review !== null || bought !== null;
      return {
        canReview,
        reason: canReview ? null : 'Only customers who bought this product can review it.',
        suggestedName: reviewerName(customer.name, customer.email),
        review: review && {
          id: review.id,
          rating: review.rating,
          title: review.title,
          body: review.body,
          authorName: review.authorName,
          status: review.status,
          photos: review.photos.map((p) => toPhoto(this.media, p)),
        },
        helpfulReviewIds: votes.map((v) => v.reviewId),
      };
    });
  }

  /**
   * Adds photos to the shopper's own review (at most MAX_REVIEW_PHOTOS in all). Like an edit, it
   * goes back to the store for checking unless the store publishes automatically.
   */
  async addPhotos(
    shop: ShopContext,
    token: string | null,
    handle: string,
    files: Buffer[],
  ): Promise<MyReview> {
    this.requireApp(shop);
    const customer = await this.customers.requireCurrent(shop, token);
    if (files.length === 0) throw new BadRequestException('Attach photos in the "files" field.');
    // Cheap checks before any image work: a review to attach to, with room left.
    await this.tenantDb.run(shop.id, async (tx) => {
      const product = await this.liveProduct(tx, shop, handle);
      const review = await tx.productReview.findUnique({
        where: {
          storeId_productId_customerId: {
            storeId: shop.id,
            productId: product.id,
            customerId: customer.id,
          },
        },
        select: { status: true, _count: { select: { photos: true } } },
      });
      this.assertPhotoRoom(review, files.length);
    });
    const processed: ProcessedImage[] = [];
    for (const file of files) processed.push(await this.images.process(file, PHOTO_WIDTHS));
    const stored = processed.map((image) => ({
      image,
      key: `stores/${shop.id}/reviews/${randomUUID()}.webp`,
      renditions: image.renditions.filter((r) => PHOTO_WIDTHS.includes(r.width)),
    }));
    // The original is kept only when it is small; otherwise the 1200 px copy stands in for it.
    const objects = stored.map(({ image, key, renditions }) => {
      const big = image.width > 1200 ? renditions.find((r) => r.width === 1200) : undefined;
      const main = big ?? { width: image.width, data: image.data };
      return {
        key,
        width: main.width,
        height: Math.round((image.height * main.width) / image.width),
        data: main.data,
        renditions: renditions.filter((r) => r.width < main.width),
      };
    });
    try {
      for (const o of objects) {
        await this.storage.put(o.key, o.data, 'image/webp');
        for (const r of o.renditions) {
          await this.storage.put(renditionKey(o.key, r.width), r.data, 'image/webp');
        }
      }
      await this.tenantDb.run(shop.id, async (tx) => {
        const product = await this.liveProduct(tx, shop, handle);
        const review = await tx.productReview.findUnique({
          where: {
            storeId_productId_customerId: {
              storeId: shop.id,
              productId: product.id,
              customerId: customer.id,
            },
          },
          include: { photos: true },
        });
        if (review) {
          // Serialise uploads to one review so parallel requests cannot pass the limit together.
          await tx.$queryRaw`SELECT id FROM "ProductReview" WHERE id = ${review.id}::uuid FOR UPDATE`;
        }
        const count = review
          ? await tx.productReviewPhoto.count({ where: { reviewId: review.id } })
          : 0;
        this.assertPhotoRoom(
          review && { status: review.status, _count: { photos: count } },
          objects.length,
        );
        if (!review) return;
        await tx.productReviewPhoto.createMany({
          data: objects.map((o, i) => ({
            storeId: shop.id,
            reviewId: review.id,
            storageKey: o.key,
            width: o.width,
            height: o.height,
            renditionWidths: o.renditions.map((r) => r.width),
            position: count + i,
          })),
        });
        if (!shop.apps.productReviews.autoPublish && review.status === 'PUBLISHED') {
          await tx.productReview.update({
            where: { id: review.id },
            data: { status: 'PENDING', publishedAt: null },
          });
          await refreshProductRating(tx, shop.id, product.id);
        }
      });
    } catch (error) {
      await this.deleteObjects(
        objects.map((o) => ({
          storageKey: o.key,
          renditionWidths: o.renditions.map((r) => r.width),
        })),
      );
      throw error;
    }
    return this.mine(shop, token, handle);
  }

  private assertPhotoRoom(
    review: { status: string; _count: { photos: number } } | null,
    adding: number,
  ) {
    if (!review) throw new ConflictException('Write your review first, then add photos.');
    if (review.status === 'REJECTED') {
      throw new ConflictException('This review was not approved by the store.');
    }
    if (review._count.photos + adding > MAX_REVIEW_PHOTOS) {
      throw new BadRequestException(
        `A review can have at most ${MAX_REVIEW_PHOTOS} photos (it has ${review._count.photos}).`,
      );
    }
  }

  /** Removes one photo from the shopper's own review. */
  async removePhoto(
    shop: ShopContext,
    token: string | null,
    handle: string,
    photoId: string,
  ): Promise<MyReview> {
    this.requireApp(shop);
    const customer = await this.customers.requireCurrent(shop, token);
    const photo = await this.tenantDb.run(shop.id, async (tx) => {
      const product = await this.liveProduct(tx, shop, handle);
      const found = await tx.productReviewPhoto.findFirst({
        where: {
          id: photoId,
          storeId: shop.id,
          review: { productId: product.id, customerId: customer.id },
        },
      });
      if (!found) throw new NotFoundException('Photo not found.');
      await tx.productReviewPhoto.delete({ where: { id: found.id } });
      await this.renumber(tx, found.reviewId);
      return found;
    });
    await this.deleteObjects([photo]);
    return this.mine(shop, token, handle);
  }

  private async renumber(tx: TenantTx, reviewId: string) {
    const rest = await tx.productReviewPhoto.findMany({
      where: { reviewId },
      orderBy: { position: 'asc' },
      select: { id: true },
    });
    for (const [position, p] of rest.entries()) {
      await tx.productReviewPhoto.update({ where: { id: p.id }, data: { position } });
    }
  }

  /** Marks or unmarks a published review as helpful: one mark per customer, not on their own. */
  async markHelpful(
    shop: ShopContext,
    token: string | null,
    handle: string,
    reviewId: string,
    helpful: boolean,
  ): Promise<ReviewHelpful> {
    this.requireApp(shop);
    const customer = await this.customers.requireCurrent(shop, token);
    return this.tenantDb.run(shop.id, async (tx) => {
      const product = await this.liveProduct(tx, shop, handle);
      const review = await tx.productReview.findFirst({
        where: { id: reviewId, storeId: shop.id, productId: product.id, status: 'PUBLISHED' },
        select: { id: true, customerId: true },
      });
      if (!review) throw new NotFoundException('Review not found.');
      if (review.customerId === customer.id) {
        throw new ForbiddenException('You cannot mark your own review as helpful.');
      }
      // Accounts are free to make; marks count only from customers who have bought here.
      const buyer = await tx.order.findFirst({
        where: { storeId: shop.id, customerId: customer.id, paidAt: { not: null } },
        select: { id: true },
      });
      if (!buyer) {
        throw new ForbiddenException(
          'Only customers who have ordered from this store can mark reviews.',
        );
      }
      const key = { storeId: shop.id, reviewId: review.id, customerId: customer.id };
      const changed = helpful
        ? (await tx.productReviewVote.createMany({ data: [key], skipDuplicates: true })).count
        : -(await tx.productReviewVote.deleteMany({ where: key })).count;
      const updated = await tx.productReview.update({
        where: { id: review.id },
        data: { helpfulCount: { increment: changed } },
        select: { helpfulCount: true },
      });
      return { helpfulCount: updated.helpfulCount, helpful };
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
      return {
        items: items.map((r) => toAdmin(r, this.media)),
        page: query.page,
        pageSize: ADMIN_PAGE_SIZE,
        total,
      };
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
    const removed: PhotoRow[] = [];
    const result = await this.tenantDb.run(store.id, async (tx) => {
      const review = await tx.productReview.findFirst({
        where: { id, storeId: store.id },
        include: adminInclude,
      });
      if (!review) throw new NotFoundException('Review not found.');
      const update = data(review);
      if (!update) removed.push(...review.photos);
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
      return result && toAdmin(result, this.media);
    });
    await this.deleteObjects(removed);
    return result;
  }

  /** Takes one photo off a review (the rest of the review stays). */
  async adminRemovePhoto(
    store: StoreContext,
    reviewId: string,
    photoId: string,
    actor: AuthUser,
    meta: RequestMeta,
  ): Promise<AdminReview> {
    let photo: PhotoRow | null = null;
    const result = await this.tenantDb.run(store.id, async (tx) => {
      photo = await tx.productReviewPhoto.findFirst({
        where: { id: photoId, reviewId, storeId: store.id },
      });
      if (!photo) throw new NotFoundException('Photo not found.');
      await tx.productReviewPhoto.delete({ where: { id: photoId } });
      await this.renumber(tx, reviewId);
      const review = await tx.productReview.findUniqueOrThrow({
        where: { id: reviewId },
        include: adminInclude,
      });
      await this.audit.record(tx, {
        storeId: store.id,
        actorUserId: actor.id,
        action: 'review.photo_removed',
        entityType: 'product',
        entityId: review.productId,
        data: { reviewId, photoId },
        meta,
      });
      return toAdmin(review, this.media);
    });
    if (photo) await this.deleteObjects([photo]);
    return result;
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
    @Query(new ZodPipe(productReviewsQuerySchema)) query: ProductReviewsQuery,
  ): Promise<ProductReviews> {
    return this.reviews.list(shop, handle.slice(0, 200), query);
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

  @Post('mine/photos')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FilesInterceptor('files', MAX_REVIEW_PHOTOS, {
      limits: { fileSize: MAX_REVIEW_PHOTO_BYTES, files: MAX_REVIEW_PHOTOS, fields: 0 },
    }),
  )
  addPhotos(
    @CurrentShop() shop: ShopContext,
    @Req() req: Request,
    @Param('handle') handle: string,
    @UploadedFiles() files: Express.Multer.File[] | undefined,
  ): Promise<MyReview> {
    const token = req.headers[STOREFRONT_HEADERS.customer];
    return this.reviews.addPhotos(
      shop,
      typeof token === 'string' ? token : null,
      handle.slice(0, 200),
      (files ?? []).map((f) => f.buffer),
    );
  }

  @Delete('mine/photos/:photoId')
  removePhoto(
    @CurrentShop() shop: ShopContext,
    @Req() req: Request,
    @Param('handle') handle: string,
    @Param('photoId', UuidParam) photoId: string,
  ): Promise<MyReview> {
    const token = req.headers[STOREFRONT_HEADERS.customer];
    return this.reviews.removePhoto(
      shop,
      typeof token === 'string' ? token : null,
      handle.slice(0, 200),
      photoId,
    );
  }

  @Put(':reviewId/helpful')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiZodBody(reviewHelpfulInputSchema)
  helpful(
    @CurrentShop() shop: ShopContext,
    @Req() req: Request,
    @Param('handle') handle: string,
    @Param('reviewId', UuidParam) reviewId: string,
    @Body(new ZodPipe(reviewHelpfulInputSchema)) body: z.output<typeof reviewHelpfulInputSchema>,
  ): Promise<ReviewHelpful> {
    const token = req.headers[STOREFRONT_HEADERS.customer];
    return this.reviews.markHelpful(
      shop,
      typeof token === 'string' ? token : null,
      handle.slice(0, 200),
      reviewId,
      body.helpful,
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

  @Delete(':reviewId/photos/:photoId')
  @RequirePermission('products:write')
  removePhoto(
    @CurrentStore() store: StoreContext,
    @CurrentUser() user: AuthUser,
    @Param('reviewId', UuidParam) id: string,
    @Param('photoId', UuidParam) photoId: string,
    @ReqMeta() meta: RequestMeta,
  ): Promise<AdminReview> {
    return this.reviews.adminRemovePhoto(store, id, photoId, user, meta);
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
