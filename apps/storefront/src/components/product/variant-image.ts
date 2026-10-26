import type { StorefrontProduct } from '@repo/contracts';

/**
 * The variant picker and the gallery are separate client components (the page between them is
 * server-rendered), so choosing a variant with its own image is announced as a window event.
 */
export const VARIANT_IMAGE_EVENT = 'product:variant-image';

export interface VariantImageDetail {
  productId: string;
  imageId: string;
}

/** Tells the gallery to show `imageId` (an `images[].id` of `productId`). */
export function announceVariantImage(detail: VariantImageDetail) {
  window.dispatchEvent(new CustomEvent<VariantImageDetail>(VARIANT_IMAGE_EVENT, { detail }));
}

/** The variant selected when the page opens: the first one that can be bought. */
export function initialVariant(product: StorefrontProduct) {
  return product.variants.find((v) => v.available) ?? product.variants[0];
}
