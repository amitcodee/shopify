/** A smaller WebP copy of a product image (the API lists them narrowest first). */
export interface Rendition {
  width: number;
  url: string;
}

/**
 * `srcset` for an image and its renditions, or undefined when there are none (older images),
 * so the plain `src` is used. The original joins at its own width; when that is unknown
 * (product cards) it is listed just above the widest rendition, which is a safe lower bound:
 * renditions only exist for widths smaller than the original.
 */
export function srcSetFor(
  url: string,
  renditions: readonly Rendition[] | null | undefined,
  width?: number,
): string | undefined {
  if (!renditions || renditions.length === 0) return undefined;
  const sorted = [...renditions].sort((a, b) => a.width - b.width);
  const widest = sorted[sorted.length - 1]?.width ?? 0;
  const originalWidth = width && width > 0 ? width : widest + 1;
  const candidates = sorted.map((r) => `${r.url} ${r.width}w`);
  if (originalWidth > widest) candidates.push(`${url} ${originalWidth}w`);
  return candidates.join(', ');
}

/** Widest store page (`--store-page-width`, 82rem); slots never get wider than this. */
const PAGE_WIDTH = 1312;

/**
 * `sizes` for product cards laid out `columns` across on wide screens (two on phones, at most
 * three on tablets), matching the grid classes in `product-grid.tsx`.
 */
export function cardSizes(columns: number): string {
  const lg = Math.max(2, columns);
  const sm = Math.min(3, lg);
  return [
    `(min-width: ${PAGE_WIDTH}px) ${Math.ceil(PAGE_WIDTH / lg)}px`,
    `(min-width: 1024px) ${Math.ceil(100 / lg)}vw`,
    `(min-width: 640px) ${Math.ceil(100 / sm)}vw`,
    '50vw',
  ].join(', ');
}
