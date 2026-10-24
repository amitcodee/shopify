import type { ProductImage } from '@repo/contracts';

/** `srcset` from an image's renditions plus the original at its own width. */
export function imageSrcSet(image: Pick<ProductImage, 'url' | 'width' | 'renditions'>): string {
  return [
    ...image.renditions.map((r) => `${r.url} ${r.width}w`),
    `${image.url} ${image.width}w`,
  ].join(', ');
}

/** The smallest copy at least `min` px wide (or the original). */
export function imageSrc(image: Pick<ProductImage, 'url' | 'renditions'>, min = 200): string {
  return image.renditions.find((r) => r.width >= min)?.url ?? image.url;
}
