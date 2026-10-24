import { type StorefrontSitemap, THEME_TEMPLATES } from '@repo/contracts';
import type { MetadataRoute } from 'next';
import { FEATURE_AREAS } from '@/components/landing/features-data';
import { GUIDES } from '@/components/landing/guides-data';
import { LEGAL_DOCS } from '@/components/landing/legal-data';
import { requestHost, sf } from '@/lib/api';
import { getShop, isRootHost, storeOrigin } from '@/lib/shop';

/** The platform's own marketing pages, for the root host's sitemap. */
function platformSitemap(origin: string): MetadataRoute.Sitemap {
  const paths = [
    '/',
    '/pricing',
    '/templates',
    '/features',
    '/switch',
    '/security',
    '/guides',
    '/contact',
    '/about',
    '/legal',
    ...FEATURE_AREAS.map((f) => `/features/${f.slug}`),
    ...THEME_TEMPLATES.map((t) => `/templates/${t.id}`),
    ...GUIDES.map((g) => `/guides/${g.slug}`),
    ...LEGAL_DOCS.map((d) => `/legal/${d.slug}`),
  ];
  return paths.map((path) => ({ url: `${origin}${path}`, priority: path === '/' ? 1 : undefined }));
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  if (!(await getShop())) {
    return isRootHost(await requestHost()) ? platformSitemap(await storeOrigin()) : [];
  }
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
    { url: `${origin}/blog` },
    ...data.posts.map((p) => ({ url: `${origin}/blog/${p.handle}`, lastModified: p.updatedAt })),
    ...data.pages.map((p) => ({ url: `${origin}/pages/${p.handle}`, lastModified: p.updatedAt })),
    ...data.policies.map((kind) => ({ url: `${origin}/policies/${kind}` })),
  ];
}
