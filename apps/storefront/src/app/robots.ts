import type { MetadataRoute } from 'next';
import { getShop, storeOrigin } from '@/lib/shop';

/** Shopper-specific pages (carts, checkout, accounts, order and invoice links) stay unindexed. */
export default async function robots(): Promise<MetadataRoute.Robots> {
  const shop = await getShop();
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/cart', '/checkout', '/account', '/orders/', '/invoices/', '/search'],
    },
    ...(shop ? { sitemap: `${await storeOrigin()}/sitemap.xml` } : {}),
  };
}
