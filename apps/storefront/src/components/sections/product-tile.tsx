import type { ProductCard, ThemeSettings } from '@repo/contracts';
import { ProductCardLink } from '@/components/product-grid';

/** A product card for carousels, styled like the grid's (same card component). */
export function ProductTile({
  product,
  currency,
  theme,
  sizes,
}: {
  product: ProductCard;
  currency: string;
  theme: ThemeSettings;
  /** `sizes` for the card image (the tile's width at each breakpoint). */
  sizes?: string;
}) {
  return <ProductCardLink product={product} currency={currency} theme={theme} sizes={sizes} />;
}
