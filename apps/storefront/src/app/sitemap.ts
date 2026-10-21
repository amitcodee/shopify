import type { StorefrontSitemap } from '@repo/contracts';
import type { MetadataRoute } from 'next';
import { sf } from '@/lib/api';
import { getShop, storeOrigin } from '@/lib/shop';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  if (!(await getShop())) return [];
  const [origin, data] = await Promise.all([storeOrigin(), sf<StorefrontSitemap>('/sitemap')]);
  return [
    { url: `${origin}/`, changeFrequency: 'daily', priority: 1 },
    { url: `${origin}/collections/all`, changeFrequency: 'daily' },
    ...data.collections.map((c) => ({
      url: `${origin}/collections/${c.handle}`,
      lastModified: c.updatedAt,
    })),
    ...data.products.map((p) => ({
      url: `${origin}/products/${p.handle}`,
      lastModified: p.updatedAt,
    })),
    ...data.pages.map((p) => ({ url: `${origin}/pages/${p.handle}`, lastModified: p.updatedAt })),
    ...data.policies.map((kind) => ({ url: `${origin}/policies/${kind}` })),
  ];
}
