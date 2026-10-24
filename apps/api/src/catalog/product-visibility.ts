import { Prisma } from '@repo/db';

/**
 * Products shoppers can see and buy: ACTIVE and published. An ACTIVE product whose publishedAt
 * is in the future is scheduled and stays hidden (storefront, search, collections, sitemap,
 * carts and checkout) until then.
 */
export function liveProductWhere(now = new Date()): Prisma.ProductWhereInput {
  return { status: 'ACTIVE', OR: [{ publishedAt: null }, { publishedAt: { lte: now } }] };
}

/** The same rule for raw SQL over `"Product"` aliased as `p`. */
export const LIVE_PRODUCT_SQL = Prisma.sql`p.status = 'ACTIVE' AND (p."publishedAt" IS NULL OR p."publishedAt" <= now())`;

export function isProductLive(
  product: { status: string; publishedAt: Date | null },
  now = new Date(),
): boolean {
  return (
    product.status === 'ACTIVE' && (product.publishedAt === null || product.publishedAt <= now)
  );
}

/** ACTIVE but waiting for its publish time. */
export function isProductScheduled(
  product: { status: string; publishedAt: Date | null },
  now = new Date(),
): boolean {
  return product.status === 'ACTIVE' && product.publishedAt !== null && product.publishedAt > now;
}
