import type {
  ImageRendition,
  Product as ProductDto,
  ProductImage as ProductImageDto,
  Variant,
} from '@repo/contracts';
import type { Prisma } from '@repo/db';
import { renditionKey } from '../storage/storage.js';
import type { MediaUrls } from '../storage/storage.module.js';
import { isProductScheduled } from './product-visibility.js';

export const productDetailInclude = {
  options: { orderBy: { position: 'asc' } },
  variants: { orderBy: { position: 'asc' } },
  images: { orderBy: { position: 'asc' } },
  collections: { select: { collectionId: true } },
  metafields: { orderBy: { position: 'asc' } },
} satisfies Prisma.ProductInclude;

export type ProductWithDetail = Prisma.ProductGetPayload<{ include: typeof productDetailInclude }>;

export function variantTitle(options: string[]): string {
  return options.length > 0 ? options.join(' / ') : 'Default';
}

/** Resized copies of a stored image, narrowest first. */
export function imageRenditions(
  image: { storageKey: string; renditionWidths: number[] },
  media: MediaUrls,
): ImageRendition[] {
  return [...image.renditionWidths]
    .sort((a, b) => a - b)
    .map((width) => ({ width, url: media.url(renditionKey(image.storageKey, width)) }));
}

export function toImageDto(
  img: ProductWithDetail['images'][number],
  media: MediaUrls,
): ProductImageDto {
  return {
    id: img.id,
    url: media.url(img.storageKey),
    alt: img.alt,
    width: img.width,
    height: img.height,
    position: img.position,
    renditions: imageRenditions(img, media),
  };
}

/** Profit and margin (percent of price, one decimal) for a unit cost; null without a cost. */
export function profitAndMargin(price: number, cost: number | null) {
  if (cost === null) return { profit: null, margin: null };
  const profit = price - cost;
  return { profit, margin: price > 0 ? Math.round((profit / price) * 1000) / 10 : null };
}

export function toVariantDto(v: ProductWithDetail['variants'][number]): Variant {
  return {
    id: v.id,
    title: v.title,
    options: v.options,
    sku: v.sku,
    barcode: v.barcode,
    price: v.price,
    compareAtPrice: v.compareAtPrice,
    costPerItem: v.costPerItem,
    ...profitAndMargin(v.price, v.costPerItem),
    weightGrams: v.weightGrams,
    requiresShipping: v.requiresShipping,
    countryOfOrigin: v.countryOfOrigin,
    hsCode: v.hsCode,
    taxable: v.taxable,
    trackInventory: v.trackInventory,
    allowBackorder: v.allowBackorder,
    inventoryQuantity: v.inventoryQuantity,
    position: v.position,
    imageId: v.imageId,
  };
}

export function toProductDto(p: ProductWithDetail, media: MediaUrls): ProductDto {
  return {
    id: p.id,
    title: p.title,
    handle: p.handle,
    description: p.description,
    status: p.status,
    vendor: p.vendor,
    productType: p.productType,
    tags: p.tags,
    seoTitle: p.seoTitle,
    isGiftCard: p.isGiftCard,
    seoDescription: p.seoDescription,
    options: p.options.map((o) => ({ name: o.name, values: o.values })),
    variants: p.variants.map(toVariantDto),
    images: p.images.map((img) => toImageDto(img, media)),
    collectionIds: p.collections.map((c) => c.collectionId),
    metafields: p.metafields.map((m) => ({
      id: m.id,
      namespace: m.namespace,
      key: m.key,
      type: m.type,
      value: m.value,
      showOnStorefront: m.showOnStorefront,
    })),
    publishedAt: p.publishedAt?.toISOString() ?? null,
    scheduled: isProductScheduled(p),
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}
