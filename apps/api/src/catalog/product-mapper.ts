import type { Product as ProductDto, Variant } from '@repo/contracts';
import type { Prisma } from '@repo/db';
import type { MediaUrls } from '../storage/storage.module.js';

export const productDetailInclude = {
  options: { orderBy: { position: 'asc' } },
  variants: { orderBy: { position: 'asc' } },
  images: { orderBy: { position: 'asc' } },
  collections: { select: { collectionId: true } },
} satisfies Prisma.ProductInclude;

export type ProductWithDetail = Prisma.ProductGetPayload<{ include: typeof productDetailInclude }>;

export function variantTitle(options: string[]): string {
  return options.length > 0 ? options.join(' / ') : 'Default';
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
    weightGrams: v.weightGrams,
    requiresShipping: v.requiresShipping,
    taxable: v.taxable,
    trackInventory: v.trackInventory,
    allowBackorder: v.allowBackorder,
    inventoryQuantity: v.inventoryQuantity,
    position: v.position,
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
    images: p.images.map((img) => ({
      id: img.id,
      url: media.url(img.storageKey),
      alt: img.alt,
      width: img.width,
      height: img.height,
      position: img.position,
    })),
    collectionIds: p.collections.map((c) => c.collectionId),
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}
