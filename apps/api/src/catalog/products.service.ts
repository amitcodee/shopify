import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type {
  Paginated,
  Product,
  ProductInputParsed,
  ProductListItem,
  ProductListQuery,
} from '@repo/contracts';
import type { Prisma, TenantTx } from '@repo/db';
import { AuditService } from '../audit/audit.service.js';
import type { AuthUser, RequestMeta, StoreContext } from '../common/request.js';
import { TenantDb } from '../database/database.module.js';
import { ImageProcessor } from '../storage/image-processor.js';
import { OBJECT_STORAGE, type ObjectStorage } from '../storage/storage.js';
import { MediaUrls } from '../storage/storage.module.js';
import { uniqueHandle } from './handles.js';
import { productDetailInclude, toProductDto, variantTitle } from './product-mapper.js';
import { PlanLimits } from '../platform/plans.service.js';
import { WebhookEmitter } from '../webhooks/webhooks.service.js';
import { changeLevel, defaultLocation } from './inventory-levels.js';

type VariantInput = ProductInputParsed['variants'][number];

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
  };
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
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
  ) {}

  async list(storeId: string, query: ProductListQuery): Promise<Paginated<ProductListItem>> {
    const where: Prisma.ProductWhereInput = { storeId };
    if (query.status) where.status = query.status;
    if (query.q) {
      where.OR = [
        { title: { contains: query.q, mode: 'insensitive' } },
        { variants: { some: { sku: { equals: query.q, mode: 'insensitive' } } } },
        { tags: { has: query.q.toLowerCase() } },
      ];
    }

    const [rows, total] = await this.tenantDb.run(storeId, (tx) =>
      Promise.all([
        tx.product.findMany({
          where,
          orderBy: { updatedAt: 'desc' },
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
          include: {
            variants: { select: { price: true, inventoryQuantity: true, trackInventory: true } },
            images: { orderBy: { position: 'asc' }, take: 1, select: { storageKey: true } },
          },
        }),
        tx.product.count({ where }),
      ]),
    );

    return {
      items: rows.map((p) => {
        const prices = p.variants.map((v) => v.price);
        return {
          id: p.id,
          title: p.title,
          handle: p.handle,
          status: p.status,
          vendor: p.vendor,
          variantCount: p.variants.length,
          totalInventory: p.variants
            .filter((v) => v.trackInventory)
            .reduce((sum, v) => sum + v.inventoryQuantity, 0),
          minPrice: prices.length ? Math.min(...prices) : 0,
          maxPrice: prices.length ? Math.max(...prices) : 0,
          imageUrl: p.images[0] ? this.media.url(p.images[0].storageKey) : null,
          updatedAt: p.updatedAt.toISOString(),
        };
      }),
      page: query.page,
      pageSize: query.pageSize,
      total,
    };
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
    const product = await this.withConflicts(() =>
      this.tenantDb.run(store.id, async (tx) => {
        await this.limits.assertCanCreateProduct(tx, store.id);
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
            publishedAt: input.status === 'ACTIVE' ? new Date() : null,
            options: {
              create: input.options.map((o, position) => ({
                name: o.name,
                values: o.values,
                position,
              })),
            },
          },
        });

        for (const [position, v] of input.variants.entries()) {
          await this.createVariant(tx, store.id, created.id, v, position, actor);
        }

        await this.audit.record(tx, {
          storeId: store.id,
          actorUserId: actor.id,
          action: 'product.created',
          entityType: 'product',
          entityId: created.id,
          data: { title: created.title, variants: input.variants.length },
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
          include: { variants: { select: { id: true } } },
        });
        if (!existing) throw new NotFoundException('Product not found.');

        const handle =
          input.handle && input.handle !== existing.handle
            ? await uniqueHandle(input.handle, input.title, async (h) =>
                Boolean(await tx.product.findFirst({ where: { storeId: store.id, handle: h } })),
              )
            : existing.handle;

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
            publishedAt:
              input.status === 'ACTIVE'
                ? (existing.publishedAt ?? new Date())
                : existing.publishedAt,
          },
        });

        await tx.productOption.deleteMany({ where: { productId, storeId: store.id } });
        if (input.options.length > 0) {
          await tx.productOption.createMany({
            data: input.options.map((o, position) => ({
              storeId: store.id,
              productId,
              name: o.name,
              values: o.values,
              position,
            })),
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
        for (const [position, v] of input.variants.entries()) {
          if (v.id) {
            await tx.productVariant.update({ where: { id: v.id }, data: variantData(v, position) });
          } else {
            await this.createVariant(tx, store.id, productId, v, position, actor);
          }
        }

        await this.audit.record(tx, {
          storeId: store.id,
          actorUserId: actor.id,
          action: 'product.updated',
          entityType: 'product',
          entityId: productId,
          data: { title: input.title, status: input.status, variants: input.variants.length },
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
        include: { images: { select: { storageKey: true } } },
      });
      if (!product) throw new NotFoundException('Product not found.');
      await tx.product.delete({ where: { id: productId } });
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
      return product.images.map((i) => i.storageKey);
    });
    await Promise.all(keys.map((key) => this.deleteFile(key)));
  }

  async addImage(
    store: StoreContext,
    productId: string,
    file: Buffer,
    alt: string,
    actor: AuthUser,
    meta: RequestMeta,
  ): Promise<Product> {
    await this.ensureProduct(store.id, productId);
    const image = await this.images.process(file);
    const key = `stores/${store.id}/products/${randomUUID()}.webp`;
    await this.storage.put(key, image.data, 'image/webp');
    try {
      await this.tenantDb.run(store.id, async (tx) => {
        const count = await tx.productImage.count({ where: { productId, storeId: store.id } });
        await tx.productImage.create({
          data: {
            storeId: store.id,
            productId,
            storageKey: key,
            alt: alt.slice(0, 200),
            width: image.width,
            height: image.height,
            position: count,
          },
        });
        await this.audit.record(tx, {
          storeId: store.id,
          actorUserId: actor.id,
          action: 'product.image_added',
          entityType: 'product',
          entityId: productId,
          meta,
        });
      });
    } catch (error) {
      await this.deleteFile(key);
      throw error;
    }
    return this.get(store.id, productId);
  }

  async updateImage(
    store: StoreContext,
    productId: string,
    imageId: string,
    input: { alt?: string; position?: number },
  ): Promise<Product> {
    await this.tenantDb.run(store.id, async (tx) => {
      const result = await tx.productImage.updateMany({
        where: { id: imageId, productId, storeId: store.id },
        data: input,
      });
      if (result.count === 0) throw new NotFoundException('Image not found.');
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
    const key = await this.tenantDb.run(store.id, async (tx) => {
      const image = await tx.productImage.findFirst({
        where: { id: imageId, productId, storeId: store.id },
      });
      if (!image) throw new NotFoundException('Image not found.');
      await tx.productImage.delete({ where: { id: imageId } });
      await this.audit.record(tx, {
        storeId: store.id,
        actorUserId: actor.id,
        action: 'product.image_removed',
        entityType: 'product',
        entityId: productId,
        meta,
      });
      return image.storageKey;
    });
    await this.deleteFile(key);
    return this.get(store.id, productId);
  }

  private async createVariant(
    tx: TenantTx,
    storeId: string,
    productId: string,
    v: VariantInput,
    position: number,
    actor: AuthUser,
  ): Promise<void> {
    const initial = v.trackInventory ? (v.inventoryQuantity ?? 0) : 0;
    const variant = await tx.productVariant.create({
      data: { storeId, productId, ...variantData(v, position), inventoryQuantity: initial },
    });
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
  }

  private async ensureProduct(storeId: string, productId: string): Promise<void> {
    const exists = await this.tenantDb.run(storeId, (tx) =>
      tx.product.findFirst({ where: { id: productId, storeId }, select: { id: true } }),
    );
    if (!exists) throw new NotFoundException('Product not found.');
  }

  private async deleteFile(key: string): Promise<void> {
    try {
      await this.storage.delete(key);
    } catch (error) {
      this.logger.warn(`Could not delete ${key}: ${String(error)}`);
    }
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
