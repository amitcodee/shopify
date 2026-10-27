import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  MAX_IMAGES_PER_PRODUCT,
  type Paginated,
  type Product,
  type ProductBulkResult,
  type ProductFacets,
  type ProductInputParsed,
  type ProductListItem,
  type ProductListQuery,
  type productBulkInputSchema,
} from '@repo/contracts';
import { Prisma, type TenantTx } from '@repo/db';
import type { z } from 'zod';
import { AuditService } from '../audit/audit.service.js';
import type { AuthUser, RequestMeta, StoreContext } from '../common/request.js';
import { TenantDb } from '../database/database.module.js';
import { ImageProcessor, type ProcessedImage } from '../storage/image-processor.js';
import { imageKeys, OBJECT_STORAGE, type ObjectStorage, renditionKey } from '../storage/storage.js';
import { MediaUrls } from '../storage/storage.module.js';
import { uniqueHandle } from './handles.js';
import { productDetailInclude, toProductDto, variantTitle } from './product-mapper.js';
import { isProductScheduled } from './product-visibility.js';
import { PlanLimits } from '../platform/plans.service.js';
import { RemoteFetchError, UnsafeUrlError } from '../webhooks/safe-http.js';
import { WebhookEmitter } from '../webhooks/webhooks.service.js';
import { RemoteImageFetcher } from './image-fetcher.js';
import { changeLevel, defaultLocation } from './inventory-levels.js';
import { bundlesContaining, refreshBundleVariants, setBundleComponents } from './bundles.js';

type VariantInput = ProductInputParsed['variants'][number];
type BulkInput = z.output<typeof productBulkInputSchema>;

/** Stored customizations: kept ids stay (carts refer to them), new fields get one. */
function customizationsData(input: NonNullable<ProductInputParsed['customizations']>) {
  return input.map((field) => ({ ...field, id: field.id ?? randomUUID() }));
}

function optionsData(options: ProductInputParsed['options']) {
  return options.map((o, position) => ({
    name: o.name,
    values: o.values,
    style: o.style,
    swatches: o.swatches,
    position,
  }));
}

function variantData(v: VariantInput, position: number) {
  return {
    title: variantTitle(v.options),
    options: v.options,
    sku: v.sku ?? null,
    barcode: v.barcode ?? null,
    price: v.price,
    compareAtPrice: v.compareAtPrice ?? null,
    weightGrams: v.weightGrams,
    requiresShipping: v.requiresShipping,
    taxable: v.taxable,
    trackInventory: v.trackInventory,
    allowBackorder: v.allowBackorder,
    position,
    // Omitted means "keep" on update (and the column default, null, on create).
    ...(v.costPerItem !== undefined && { costPerItem: v.costPerItem }),
    ...(v.countryOfOrigin !== undefined && { countryOfOrigin: v.countryOfOrigin }),
    ...(v.hsCode !== undefined && { hsCode: v.hsCode }),
    ...(v.imageId !== undefined && { imageId: v.imageId }),
  };
}

/**
 * The stored publish time for a save: an explicit `publishAt` wins (a future time schedules);
 * null publishes now unless already live; omitted keeps the current time, or publishes now when
 * an unpublished product becomes ACTIVE.
 */
function publishedAtFor(
  status: ProductInputParsed['status'],
  publishAt: string | null | undefined,
  existing: Date | null,
  now = new Date(),
): Date | null {
  if (publishAt) return new Date(publishAt);
  if (publishAt === null) {
    const live = existing && existing <= now ? existing : null;
    return status === 'ACTIVE' ? (live ?? now) : live;
  }
  return status === 'ACTIVE' ? (existing ?? now) : existing;
}

/** Escapes LIKE wildcards so merchant search text matches literally. */
function likeEscape(text: string): string {
  return text.replace(/[\\%_]/g, '\\$&');
}

interface ListRow {
  id: string;
}

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);

  constructor(
    private readonly tenantDb: TenantDb,
    private readonly audit: AuditService,
    private readonly images: ImageProcessor,
    private readonly media: MediaUrls,
    private readonly limits: PlanLimits,
    private readonly webhooks: WebhookEmitter,
    private readonly fetcher: RemoteImageFetcher,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
  ) {}

  async list(storeId: string, query: ProductListQuery): Promise<Paginated<ProductListItem>> {
    const empty = { items: [], page: query.page, pageSize: query.pageSize, total: 0 };
    const result = await this.tenantDb.run(storeId, async (tx) => {
      const filters: Prisma.Sql[] = [Prisma.sql`p."storeId" = ${storeId}::uuid`];
      if (query.status) filters.push(Prisma.sql`p.status = ${query.status}::"ProductStatus"`);
      if (query.vendor) filters.push(Prisma.sql`lower(p.vendor) = lower(${query.vendor})`);
      if (query.productType) {
        filters.push(Prisma.sql`lower(p."productType") = lower(${query.productType})`);
      }
      if (query.tag) filters.push(Prisma.sql`p.tags @> ARRAY[${query.tag}]::text[]`);
      if (query.supplierId) {
        filters.push(Prisma.sql`p."supplierId" = ${query.supplierId}::uuid`);
      }
      if (query.collectionId) {
        const collection = await tx.collection.findFirst({
          where: { id: query.collectionId, storeId },
        });
        if (!collection) return null;
        // Same membership as the collection itself: manual products, or ACTIVE tagged ones.
        filters.push(
          collection.ruleTag
            ? Prisma.sql`p.status = 'ACTIVE' AND p.tags @> ARRAY[${collection.ruleTag}]::text[]`
            : Prisma.sql`EXISTS (SELECT 1 FROM "CollectionProduct" cp WHERE cp."collectionId" = ${collection.id}::uuid AND cp."productId" = p.id)`,
        );
      }
      if (query.q) {
        const contains = `%${likeEscape(query.q)}%`;
        const prefix = `${likeEscape(query.q)}%`;
        filters.push(Prisma.sql`(
          p.title ILIKE ${contains}
          OR p.vendor ILIKE ${contains}
          OR p.tags @> ARRAY[${query.q.toLowerCase()}]::text[]
          OR EXISTS (SELECT 1 FROM "ProductVariant" sv WHERE sv."productId" = p.id AND sv.sku ILIKE ${prefix})
        )`);
      }
      const where = Prisma.join(filters, ' AND ');

      const direction =
        query.direction ?? (query.sort === 'updated' || query.sort === 'created' ? 'desc' : 'asc');
      const dir = Prisma.raw(direction === 'asc' ? 'ASC' : 'DESC');
      const column = {
        updated: Prisma.sql`p."updatedAt"`,
        created: Prisma.sql`p."createdAt"`,
        title: Prisma.sql`lower(p.title)`,
        price: Prisma.sql`agg.min_price`,
        inventory: Prisma.sql`agg.inventory`,
      }[query.sort];

      const rows = await tx.$queryRaw<ListRow[]>`
        SELECT p.id
        FROM "Product" p
        LEFT JOIN LATERAL (
          SELECT MIN(v.price) AS min_price,
                 COALESCE(SUM(v."inventoryQuantity") FILTER (WHERE v."trackInventory"), 0) AS inventory
          FROM "ProductVariant" v WHERE v."productId" = p.id
        ) agg ON true
        WHERE ${where}
        ORDER BY ${column} ${dir} NULLS LAST, p.id
        LIMIT ${query.pageSize} OFFSET ${(query.page - 1) * query.pageSize}`;
      const [counted] = await tx.$queryRaw<{ count: number }[]>`
        SELECT COUNT(*)::int AS count FROM "Product" p WHERE ${where}`;

      const products = await tx.product.findMany({
        where: { storeId, id: { in: rows.map((r) => r.id) } },
        include: {
          variants: { select: { price: true, inventoryQuantity: true, trackInventory: true } },
          images: {
            orderBy: { position: 'asc' },
            take: 1,
            select: { storageKey: true, renditionWidths: true },
          },
          supplier: { select: { name: true } },
        },
      });
      const byId = new Map(products.map((p) => [p.id, p]));
      return {
        rows: rows.flatMap((r) => byId.get(r.id) ?? []),
        total: counted?.count ?? 0,
      };
    });
    if (!result) return empty;

    return {
      items: result.rows.map((p) => {
        const prices = p.variants.map((v) => v.price);
        const image = p.images[0];
        const imageUrl = image ? this.media.url(image.storageKey) : null;
        return {
          id: p.id,
          title: p.title,
          handle: p.handle,
          status: p.status,
          vendor: p.vendor,
          productType: p.productType,
          tags: p.tags,
          isBundle: p.isBundle,
          supplierName: p.supplier?.name ?? null,
          variantCount: p.variants.length,
          totalInventory: p.variants
            .filter((v) => v.trackInventory)
            .reduce((sum, v) => sum + v.inventoryQuantity, 0),
          minPrice: prices.length ? Math.min(...prices) : 0,
          maxPrice: prices.length ? Math.max(...prices) : 0,
          imageUrl,
          thumbnailUrl:
            image && image.renditionWidths.includes(200)
              ? this.media.url(renditionKey(image.storageKey, 200))
              : imageUrl,
          publishedAt: p.publishedAt?.toISOString() ?? null,
          scheduled: isProductScheduled(p),
          createdAt: p.createdAt.toISOString(),
          updatedAt: p.updatedAt.toISOString(),
        };
      }),
      page: query.page,
      pageSize: query.pageSize,
      total: result.total,
    };
  }

  /** Distinct vendors, product types and tags in the store, for the list filters. */
  facets(storeId: string): Promise<ProductFacets> {
    return this.tenantDb.run(storeId, async (tx) => {
      const vendors = await tx.$queryRaw<{ value: string }[]>`
        SELECT DISTINCT p.vendor AS value FROM "Product" p
        WHERE p."storeId" = ${storeId}::uuid AND p.vendor IS NOT NULL
        ORDER BY 1 LIMIT 500`;
      const productTypes = await tx.$queryRaw<{ value: string }[]>`
        SELECT DISTINCT p."productType" AS value FROM "Product" p
        WHERE p."storeId" = ${storeId}::uuid AND p."productType" IS NOT NULL
        ORDER BY 1 LIMIT 500`;
      const tags = await tx.$queryRaw<{ value: string }[]>`
        SELECT DISTINCT t AS value FROM "Product" p, unnest(p.tags) AS t
        WHERE p."storeId" = ${storeId}::uuid
        ORDER BY 1 LIMIT 500`;
      const values = (rows: { value: string }[]) => rows.map((r) => r.value);
      return {
        vendors: values(vendors),
        productTypes: values(productTypes),
        tags: values(tags),
      };
    });
  }

  async get(storeId: string, productId: string): Promise<Product> {
    const product = await this.tenantDb.run(storeId, (tx) =>
      tx.product.findFirst({ where: { id: productId, storeId }, include: productDetailInclude }),
    );
    if (!product) throw new NotFoundException('Product not found.');
    return toProductDto(product, this.media);
  }

  async create(
    store: StoreContext,
    input: ProductInputParsed,
    actor: AuthUser,
    meta: RequestMeta,
  ): Promise<Product> {
    // A new product has no images yet, so no variant can point at one.
    if (input.variants.some((v) => v.imageId)) {
      throw new BadRequestException('Add images to the product before assigning them to variants.');
    }
    const product = await this.withConflicts(() =>
      this.tenantDb.run(store.id, async (tx) => {
        await this.limits.assertCanCreateProduct(tx, store.id);
        if (input.supplierId) await this.assertSupplier(tx, store.id, input.supplierId);
        const handle = await uniqueHandle(input.handle, input.title, async (h) =>
          Boolean(await tx.product.findFirst({ where: { storeId: store.id, handle: h } })),
        );

        const created = await tx.product.create({
          data: {
            storeId: store.id,
            title: input.title,
            handle,
            description: input.description,
            status: input.status,
            vendor: input.vendor ?? null,
            productType: input.productType ?? null,
            tags: input.tags,
            seoTitle: input.seoTitle ?? null,
            seoDescription: input.seoDescription ?? null,
            isGiftCard: input.isGiftCard,
            isBundle: input.isBundle,
            supplierId: input.supplierId ?? null,
            customizations: customizationsData(input.customizations ?? []),
            publishedAt: publishedAtFor(input.status, input.publishAt, null),
            options: { create: optionsData(input.options) },
          },
        });

        const variantIds: string[] = [];
        for (const [position, v] of input.variants.entries()) {
          const id = await this.createVariant(
            tx,
            store.id,
            created.id,
            v,
            position,
            actor,
            input.isBundle,
          );
          variantIds.push(id);
          if (input.isBundle) {
            await setBundleComponents(tx, store.id, created.id, id, v.components ?? []);
          }
        }
        if (input.isBundle) await refreshBundleVariants(tx, store.id, variantIds);
        if (input.metafields) await this.replaceMetafields(tx, store.id, created.id, input);

        await this.audit.record(tx, {
          storeId: store.id,
          actorUserId: actor.id,
          action: 'product.created',
          entityType: 'product',
          entityId: created.id,
          data: {
            title: created.title,
            variants: input.variants.length,
            publishedAt: created.publishedAt?.toISOString() ?? null,
          },
          meta,
        });
        await this.webhooks.emitProduct(tx, store.id, 'products/created', created.id);
        return tx.product.findUniqueOrThrow({
          where: { id: created.id },
          include: productDetailInclude,
        });
      }),
    );
    return toProductDto(product, this.media);
  }

  async update(
    store: StoreContext,
    productId: string,
    input: ProductInputParsed,
    actor: AuthUser,
    meta: RequestMeta,
  ): Promise<Product> {
    const product = await this.withConflicts(() =>
      this.tenantDb.run(store.id, async (tx) => {
        const existing = await tx.product.findFirst({
          where: { id: productId, storeId: store.id },
          include: { variants: { select: { id: true } }, images: { select: { id: true } } },
        });
        if (!existing) throw new NotFoundException('Product not found.');
        if (input.isBundle !== existing.isBundle) {
          throw new BadRequestException(
            existing.isBundle
              ? 'A bundle cannot become a regular product. Create a new product instead.'
              : 'A product with its own stock cannot become a bundle. Create a new bundle instead.',
          );
        }
        if (input.supplierId) await this.assertSupplier(tx, store.id, input.supplierId);
        const usedInBundles = await bundlesContaining(
          tx,
          store.id,
          existing.variants.map((v) => v.id),
        );
        if (input.isGiftCard && usedInBundles.length > 0) {
          throw new BadRequestException(
            'This product is part of a bundle, so it cannot become a gift card.',
          );
        }

        const imageIds = new Set(existing.images.map((i) => i.id));
        if (input.variants.some((v) => v.imageId && !imageIds.has(v.imageId))) {
          throw new BadRequestException('Variant images must be images of this product.');
        }

        const handle =
          input.handle && input.handle !== existing.handle
            ? await uniqueHandle(input.handle, input.title, async (h) =>
                Boolean(await tx.product.findFirst({ where: { storeId: store.id, handle: h } })),
              )
            : existing.handle;

        const publishedAt = publishedAtFor(input.status, input.publishAt, existing.publishedAt);
        await tx.product.update({
          where: { id: productId },
          data: {
            title: input.title,
            handle,
            description: input.description,
            status: input.status,
            vendor: input.vendor ?? null,
            productType: input.productType ?? null,
            tags: input.tags,
            seoTitle: input.seoTitle ?? null,
            seoDescription: input.seoDescription ?? null,
            isGiftCard: input.isGiftCard,
            publishedAt,
            ...(input.supplierId !== undefined && { supplierId: input.supplierId }),
            ...(input.customizations && {
              customizations: customizationsData(input.customizations),
            }),
          },
        });

        await tx.productOption.deleteMany({ where: { productId, storeId: store.id } });
        if (input.options.length > 0) {
          await tx.productOption.createMany({
            data: optionsData(input.options).map((o) => ({ ...o, storeId: store.id, productId })),
          });
        }

        const existingIds = new Set(existing.variants.map((v) => v.id));
        const keepIds = new Set(input.variants.flatMap((v) => (v.id ? [v.id] : [])));
        for (const id of keepIds) {
          if (!existingIds.has(id)) throw new BadRequestException('Unknown variant id.');
        }
        // Delete removed variants first so their SKUs can be reused by new variants.
        await tx.productVariant.deleteMany({
          where: { productId, storeId: store.id, id: { notIn: [...keepIds] } },
        });
        const variantIds: string[] = [];
        for (const [position, v] of input.variants.entries()) {
          if (v.id) {
            await tx.productVariant.update({ where: { id: v.id }, data: variantData(v, position) });
            variantIds.push(v.id);
          } else {
            variantIds.push(
              await this.createVariant(tx, store.id, productId, v, position, actor, input.isBundle),
            );
          }
          if (input.isBundle) {
            await setBundleComponents(
              tx,
              store.id,
              productId,
              variantIds.at(-1)!,
              v.components ?? [],
            );
          }
        }
        // Bundles derive their stock; bundles containing this product follow its stock settings
        // (and lose items whose variant was deleted).
        if (input.isBundle) await refreshBundleVariants(tx, store.id, variantIds);
        else await refreshBundleVariants(tx, store.id, usedInBundles);
        if (input.metafields) await this.replaceMetafields(tx, store.id, productId, input);

        await this.audit.record(tx, {
          storeId: store.id,
          actorUserId: actor.id,
          action: 'product.updated',
          entityType: 'product',
          entityId: productId,
          data: {
            title: input.title,
            status: input.status,
            variants: input.variants.length,
            publishedAt: publishedAt?.toISOString() ?? null,
            ...(input.metafields && { metafields: input.metafields.map((m) => m.key) }),
          },
          meta,
        });
        await this.webhooks.emitProduct(tx, store.id, 'products/updated', productId);
        return tx.product.findUniqueOrThrow({
          where: { id: productId },
          include: productDetailInclude,
        });
      }),
    );
    return toProductDto(product, this.media);
  }

  async remove(store: StoreContext, productId: string, actor: AuthUser, meta: RequestMeta) {
    const keys = await this.tenantDb.run(store.id, async (tx) => {
      const product = await tx.product.findFirst({
        where: { id: productId, storeId: store.id },
        include: {
          images: { select: { storageKey: true, renditionWidths: true } },
          variants: { select: { id: true } },
        },
      });
      if (!product) throw new NotFoundException('Product not found.');
      const bundles = await bundlesContaining(
        tx,
        store.id,
        product.variants.map((v) => v.id),
      );
      await tx.product.delete({ where: { id: productId } });
      // Bundles that held this product lose the item (and can no longer be sold without it).
      await refreshBundleVariants(tx, store.id, bundles);
      await this.audit.record(tx, {
        storeId: store.id,
        actorUserId: actor.id,
        action: 'product.deleted',
        entityType: 'product',
        entityId: productId,
        data: { title: product.title },
        meta,
      });
      await this.webhooks.emit(tx, store.id, 'products/deleted', () => ({
        id: product.id,
        handle: product.handle,
      }));
      return product.images.flatMap(imageKeys);
    });
    await this.deleteFiles(keys);
  }

  /**
   * Applies one action to up to 100 products in a single transaction: all of them or none.
   * Each product gets the same audit entry and webhook as its single-item counterpart.
   */
  async bulk(
    store: StoreContext,
    input: BulkInput,
    actor: AuthUser,
    meta: RequestMeta,
  ): Promise<ProductBulkResult> {
    const keys = await this.tenantDb.run(store.id, async (tx) => {
      const products = await tx.product.findMany({
        where: { storeId: store.id, id: { in: input.productIds } },
        include: {
          images: { select: { storageKey: true, renditionWidths: true } },
          variants: { select: { id: true } },
        },
      });
      const affectedBundles =
        input.action === 'delete'
          ? await bundlesContaining(
              tx,
              store.id,
              products.flatMap((p) => p.variants.map((v) => v.id)),
            )
          : [];
      if (products.length !== input.productIds.length) {
        throw new BadRequestException('Some of the selected products do not exist.');
      }
      const tags = input.tags ?? [];
      const now = new Date();
      const removed: string[] = [];

      for (const product of products) {
        if (input.action === 'delete') {
          await tx.product.delete({ where: { id: product.id } });
          await this.audit.record(tx, {
            storeId: store.id,
            actorUserId: actor.id,
            action: 'product.deleted',
            entityType: 'product',
            entityId: product.id,
            data: { title: product.title, bulk: true },
            meta,
          });
          await this.webhooks.emit(tx, store.id, 'products/deleted', () => ({
            id: product.id,
            handle: product.handle,
          }));
          removed.push(...product.images.flatMap(imageKeys));
          continue;
        }

        let data: Prisma.ProductUpdateInput;
        switch (input.action) {
          case 'activate':
            data = { status: 'ACTIVE', publishedAt: product.publishedAt ?? now };
            break;
          case 'draft':
            data = { status: 'DRAFT' };
            break;
          case 'archive':
            data = { status: 'ARCHIVED' };
            break;
          case 'add_tags': {
            const next = [...new Set([...product.tags, ...tags])];
            if (next.length > 50) {
              throw new BadRequestException(`"${product.title}" would have more than 50 tags.`);
            }
            data = { tags: next };
            break;
          }
          case 'remove_tags':
            data = { tags: product.tags.filter((t) => !tags.includes(t)) };
            break;
        }
        await tx.product.update({ where: { id: product.id }, data });
        await this.audit.record(tx, {
          storeId: store.id,
          actorUserId: actor.id,
          action: 'product.updated',
          entityType: 'product',
          entityId: product.id,
          data: { title: product.title, bulk: input.action, ...(tags.length > 0 && { tags }) },
          meta,
        });
        await this.webhooks.emitProduct(tx, store.id, 'products/updated', product.id);
      }
      await refreshBundleVariants(tx, store.id, affectedBundles);
      return removed;
    });
    await this.deleteFiles(keys);
    return { action: input.action, count: input.productIds.length };
  }

  /** Uploads (one or several files, all-or-nothing). */
  async addImages(
    store: StoreContext,
    productId: string,
    files: Buffer[],
    alt: string,
    actor: AuthUser,
    meta: RequestMeta,
  ): Promise<Product> {
    await this.assertRoomForImages(store.id, productId, files.length);
    const processed: ProcessedImage[] = [];
    for (const file of files) processed.push(await this.images.process(file));
    await this.saveImages(store, productId, processed, alt, actor, meta, { source: 'upload' });
    return this.get(store.id, productId);
  }

  /** Imports an image from a public https URL (SSRF-guarded), then processes it like an upload. */
  async importImage(
    store: StoreContext,
    productId: string,
    input: { url: string; alt: string },
    actor: AuthUser,
    meta: RequestMeta,
    source: 'url' | 'csv' = 'url',
  ): Promise<Product> {
    await this.assertRoomForImages(store.id, productId, 1);
    const image = await this.images.process(await this.download(input.url));
    await this.saveImages(store, productId, [image], input.alt, actor, meta, {
      source,
      url: input.url,
    });
    return this.get(store.id, productId);
  }

  /** Downloads a merchant-supplied image URL, turning network failures into 400s. */
  async download(url: string): Promise<Buffer> {
    try {
      return await this.fetcher.fetch(url);
    } catch (error) {
      if (error instanceof UnsafeUrlError) {
        throw new BadRequestException(
          'That URL cannot be imported: use a public https:// address.',
        );
      }
      const reason = error instanceof RemoteFetchError ? `: ${error.message}` : '';
      throw new BadRequestException(`The image could not be downloaded${reason}.`);
    }
  }

  async updateImage(
    store: StoreContext,
    productId: string,
    imageId: string,
    input: { alt?: string; position?: number },
    actor: AuthUser,
    meta: RequestMeta,
  ): Promise<Product> {
    await this.tenantDb.run(store.id, async (tx) => {
      const images = await this.productImages(tx, store.id, productId);
      const image = images.find((i) => i.id === imageId);
      if (!image) throw new NotFoundException('Image not found.');
      if (input.alt !== undefined && input.alt !== image.alt) {
        await tx.productImage.update({ where: { id: imageId }, data: { alt: input.alt } });
      }
      if (input.position !== undefined) {
        const order = images.map((i) => i.id).filter((id) => id !== imageId);
        order.splice(Math.min(input.position, order.length), 0, imageId);
        await this.writePositions(tx, images, order);
      }
      await this.audit.record(tx, {
        storeId: store.id,
        actorUserId: actor.id,
        action: 'product.image_updated',
        entityType: 'product',
        entityId: productId,
        data: { imageId, ...input },
        meta,
      });
    });
    return this.get(store.id, productId);
  }

  /** Sets the gallery order; `imageIds` must be exactly the product's images. */
  async reorderImages(
    store: StoreContext,
    productId: string,
    imageIds: string[],
    actor: AuthUser,
    meta: RequestMeta,
  ): Promise<Product> {
    await this.tenantDb.run(store.id, async (tx) => {
      const images = await this.productImages(tx, store.id, productId);
      const current = new Set(images.map((i) => i.id));
      if (imageIds.length !== current.size || imageIds.some((id) => !current.has(id))) {
        throw new BadRequestException('List every image of the product exactly once.');
      }
      await this.writePositions(tx, images, imageIds);
      await this.audit.record(tx, {
        storeId: store.id,
        actorUserId: actor.id,
        action: 'product.images_reordered',
        entityType: 'product',
        entityId: productId,
        data: { imageIds },
        meta,
      });
    });
    return this.get(store.id, productId);
  }

  async removeImage(
    store: StoreContext,
    productId: string,
    imageId: string,
    actor: AuthUser,
    meta: RequestMeta,
  ): Promise<Product> {
    const keys = await this.tenantDb.run(store.id, async (tx) => {
      const images = await this.productImages(tx, store.id, productId);
      const image = images.find((i) => i.id === imageId);
      if (!image) throw new NotFoundException('Image not found.');
      // Variants showing this image fall back to none (ON DELETE SET NULL).
      await tx.productImage.delete({ where: { id: imageId } });
      const rest = images.filter((i) => i.id !== imageId);
      await this.writePositions(
        tx,
        rest,
        rest.map((i) => i.id),
      );
      await this.audit.record(tx, {
        storeId: store.id,
        actorUserId: actor.id,
        action: 'product.image_removed',
        entityType: 'product',
        entityId: productId,
        data: { imageId },
        meta,
      });
      return imageKeys(image);
    });
    await this.deleteFiles(keys);
    return this.get(store.id, productId);
  }

  /** Points a variant at one of the product's images (null clears it). */
  async setVariantImage(
    store: StoreContext,
    productId: string,
    variantId: string,
    imageId: string | null,
    actor: AuthUser,
    meta: RequestMeta,
  ): Promise<Product> {
    await this.tenantDb.run(store.id, async (tx) => {
      const variant = await tx.productVariant.findFirst({
        where: { id: variantId, productId, storeId: store.id },
        select: { id: true },
      });
      if (!variant) throw new NotFoundException('Variant not found.');
      if (imageId) {
        const image = await tx.productImage.findFirst({
          where: { id: imageId, productId, storeId: store.id },
          select: { id: true },
        });
        if (!image) throw new BadRequestException('Variant images must be images of this product.');
      }
      await tx.productVariant.update({ where: { id: variantId }, data: { imageId } });
      await this.audit.record(tx, {
        storeId: store.id,
        actorUserId: actor.id,
        action: 'product.variant_image_set',
        entityType: 'product',
        entityId: productId,
        data: { variantId, imageId },
        meta,
      });
      await this.webhooks.emitProduct(tx, store.id, 'products/updated', productId);
    });
    return this.get(store.id, productId);
  }

  private async createVariant(
    tx: TenantTx,
    storeId: string,
    productId: string,
    v: VariantInput,
    position: number,
    actor: AuthUser,
    isBundle = false,
  ): Promise<string> {
    // A bundle's stock comes from its components (see bundles.ts), never from its own levels.
    const initial = v.trackInventory && !isBundle ? (v.inventoryQuantity ?? 0) : 0;
    const variant = await tx.productVariant.create({
      data: { storeId, productId, ...variantData(v, position), inventoryQuantity: initial },
    });
    if (isBundle) return variant.id;
    if (v.trackInventory) {
      const location = await defaultLocation(tx, storeId);
      await changeLevel(tx, storeId, variant.id, location.id, initial);
      if (initial !== 0) {
        await tx.inventoryAdjustment.create({
          data: {
            storeId,
            variantId: variant.id,
            delta: initial,
            quantityAfter: initial,
            reason: 'INITIAL',
            actorUserId: actor.id,
            locationId: location.id,
          },
        });
      }
    }
    return variant.id;
  }

  /** Clear error for an unknown supplier (a trigger also enforces the same store). */
  private async assertSupplier(tx: TenantTx, storeId: string, supplierId: string): Promise<void> {
    const supplier = await tx.supplier.findFirst({ where: { id: supplierId, storeId } });
    if (!supplier) throw new BadRequestException('Choose an existing supplier.');
  }

  /** Replace semantics: the input list becomes the product's metafields, in its order. */
  private async replaceMetafields(
    tx: TenantTx,
    storeId: string,
    productId: string,
    input: ProductInputParsed,
  ): Promise<void> {
    await tx.productMetafield.deleteMany({ where: { productId, storeId } });
    if (!input.metafields?.length) return;
    await tx.productMetafield.createMany({
      data: input.metafields.map((m, position) => ({
        storeId,
        productId,
        namespace: m.namespace,
        key: m.key,
        type: m.type,
        value: m.value,
        showOnStorefront: m.showOnStorefront,
        position,
      })),
    });
  }

  private async productImages(tx: TenantTx, storeId: string, productId: string) {
    const product = await tx.product.findFirst({
      where: { id: productId, storeId },
      select: { id: true },
    });
    if (!product) throw new NotFoundException('Product not found.');
    return tx.productImage.findMany({
      where: { productId, storeId },
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    });
  }

  /** Stores positions 0..n-1 in `order`, touching only images whose position changes. */
  private async writePositions(
    tx: TenantTx,
    images: { id: string; position: number }[],
    order: string[],
  ): Promise<void> {
    const current = new Map(images.map((i) => [i.id, i.position]));
    for (const [position, id] of order.entries()) {
      if (current.get(id) !== position) {
        await tx.productImage.update({ where: { id }, data: { position } });
      }
    }
  }

  /** Cheap early check (before decoding or downloading anything); saveImages re-checks. */
  private async assertRoomForImages(storeId: string, productId: string, adding: number) {
    const count = await this.tenantDb.run(storeId, async (tx) => {
      const product = await tx.product.findFirst({
        where: { id: productId, storeId },
        select: { id: true },
      });
      if (!product) throw new NotFoundException('Product not found.');
      return tx.productImage.count({ where: { productId, storeId } });
    });
    this.assertImageLimit(count, adding);
  }

  private assertImageLimit(count: number, adding: number): void {
    if (count + adding > MAX_IMAGES_PER_PRODUCT) {
      throw new ConflictException(
        `A product can have at most ${MAX_IMAGES_PER_PRODUCT} images (it has ${count}).`,
      );
    }
  }

  private async saveImages(
    store: StoreContext,
    productId: string,
    processed: ProcessedImage[],
    alt: string,
    actor: AuthUser,
    meta: RequestMeta,
    source: { source: 'upload' | 'url' | 'csv'; url?: string },
  ): Promise<void> {
    const stored = processed.map((image) => ({
      image,
      key: `stores/${store.id}/products/${randomUUID()}.webp`,
    }));
    const keys = stored.flatMap(({ image, key }) =>
      imageKeys({ storageKey: key, renditionWidths: image.renditions.map((r) => r.width) }),
    );
    try {
      for (const { image, key } of stored) {
        await this.storage.put(key, image.data, 'image/webp');
        for (const r of image.renditions) {
          await this.storage.put(renditionKey(key, r.width), r.data, 'image/webp');
        }
      }
      await this.tenantDb.run(store.id, async (tx) => {
        const product = await tx.product.findFirst({
          where: { id: productId, storeId: store.id },
          select: { id: true },
        });
        if (!product) throw new NotFoundException('Product not found.');
        const count = await tx.productImage.count({ where: { productId, storeId: store.id } });
        this.assertImageLimit(count, stored.length);
        const created: string[] = [];
        for (const [i, { image, key }] of stored.entries()) {
          const row = await tx.productImage.create({
            data: {
              storeId: store.id,
              productId,
              storageKey: key,
              alt: alt.slice(0, 512),
              width: image.width,
              height: image.height,
              renditionWidths: image.renditions.map((r) => r.width),
              position: count + i,
            },
          });
          created.push(row.id);
        }
        await this.audit.record(tx, {
          storeId: store.id,
          actorUserId: actor.id,
          action: 'product.image_added',
          entityType: 'product',
          entityId: productId,
          data: { imageIds: created, ...source },
          meta,
        });
      });
    } catch (error) {
      await this.deleteFiles(keys);
      throw error;
    }
  }

  private async deleteFiles(keys: string[]): Promise<void> {
    await Promise.all(
      keys.map(async (key) => {
        try {
          await this.storage.delete(key);
        } catch (error) {
          this.logger.warn(`Could not delete ${key}: ${String(error)}`);
        }
      }),
    );
  }

  private async withConflicts<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('A variant with this SKU already exists in your store.');
      }
      throw error;
    }
  }
}
