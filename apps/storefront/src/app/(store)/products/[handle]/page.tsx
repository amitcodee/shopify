import {
  minorToDecimalString,
  type ProductCardPage,
  type Shop,
  type StorefrontCollection,
  type StorefrontProduct,
} from '@repo/contracts';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { Accordion } from '@/components/product/accordion';
import { Breadcrumbs, type Crumb } from '@/components/product/breadcrumbs';
import { ProductIcon } from '@/components/product/icons';
import { ProductGallery } from '@/components/product/product-gallery';
import { Specifications } from '@/components/product/specs';
import { initialVariant } from '@/components/product/variant-image';
import { ProductGrid, RATIOS } from '@/components/product-grid';
import { isNotFound, sf } from '@/lib/api';
import { getShop, storeOrigin } from '@/lib/shop';
import { VariantPicker } from './variant-picker';

const getProduct = cache(async (handle: string): Promise<StorefrontProduct | null> => {
  try {
    return await sf<StorefrontProduct>(`/products/${encodeURIComponent(handle)}`);
  } catch (error) {
    if (isNotFound(error)) return null;
    throw error;
  }
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ handle: string }>;
}): Promise<Metadata> {
  const product = await getProduct((await params).handle);
  if (!product) return {};
  const description = product.seoDescription ?? product.description.slice(0, 160);
  return {
    title: product.seoTitle ?? product.title,
    description,
    // `?collection=` only changes the breadcrumbs; search engines get one URL per product.
    alternates: { canonical: `${await storeOrigin()}/products/${product.handle}` },
    openGraph: {
      title: product.title,
      description,
      images: product.images.slice(0, 1).map((i) => i.url),
    },
  };
}

/** Up to four other products: ones sharing the first tag, topped up with the newest. */
async function getRelated(product: StorefrontProduct) {
  const [tagged, latest] = await Promise.all([
    product.tags[0]
      ? sf<ProductCardPage>('/products', { query: { q: product.tags[0], pageSize: 5 } })
      : null,
    sf<ProductCardPage>('/products', { query: { pageSize: 5 } }),
  ]);
  const seen = new Set([product.id]);
  return [...(tagged?.items ?? []), ...latest.items]
    .filter((p) => !seen.has(p.id) && seen.add(p.id))
    .slice(0, 4);
}

/** The collection the shopper came from (for the breadcrumbs), falling back to all products. */
async function getCrumbCollection(handle: string | undefined): Promise<Crumb> {
  const all = { label: 'All products', href: '/collections/all' };
  if (!handle || handle === 'all' || handle.length > 120) return all;
  try {
    const collection = await sf<StorefrontCollection>(`/collections/${encodeURIComponent(handle)}`);
    return { label: collection.title, href: `/collections/${collection.handle}` };
  } catch (error) {
    if (isNotFound(error)) return all;
    throw error;
  }
}

/** JSON-LD must not be able to close the script tag. */
function jsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

/** Links to the store's own shipping and refund policies; no promises beyond what they say. */
function ShippingAndReturns({ shop }: { shop: Shop }) {
  const published = new Set(shop.policies.map((p) => p.kind));
  return (
    <div className="space-y-3">
      <p>Shipping options and costs for your address are shown at checkout.</p>
      {published.has('shipping') ? (
        <p>
          See our{' '}
          <Link href="/policies/shipping" className="font-medium text-zinc-900 underline">
            shipping policy
          </Link>{' '}
          for delivery details.
        </p>
      ) : null}
      {published.has('refund') ? (
        <p>
          Returns and refunds follow our{' '}
          <Link href="/policies/refund" className="font-medium text-zinc-900 underline">
            refund policy
          </Link>
          .
        </p>
      ) : shop.contactEmail ? (
        <p>
          Questions about returns? Email{' '}
          <a href={`mailto:${shop.contactEmail}`} className="font-medium text-zinc-900 underline">
            {shop.contactEmail}
          </a>
          .
        </p>
      ) : null}
    </div>
  );
}

export default async function ProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ handle: string }>;
  searchParams: Promise<{ collection?: string | string[] }>;
}) {
  const { handle } = await params;
  const { collection: rawCollection } = await searchParams;
  const [product, shop] = await Promise.all([getProduct(handle), getShop()]);
  if (!product || !shop) notFound();
  const [related, crumbCollection, origin] = await Promise.all([
    getRelated(product),
    getCrumbCollection(typeof rawCollection === 'string' ? rawCollection : undefined),
    storeOrigin(),
  ]);
  const settings = shop.theme.settings;

  const crumbs: Crumb[] = [{ label: 'Home', href: '/' }, crumbCollection, { label: product.title }];
  const paragraphs = product.description.split(/\n\s*\n/).filter((p) => p.trim() !== '');
  const structured = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.title,
    description: product.description,
    image: product.images.map((i) => i.url),
    brand: product.vendor ? { '@type': 'Brand', name: product.vendor } : undefined,
    offers: product.variants.map((v) => ({
      '@type': 'Offer',
      sku: v.sku ?? undefined,
      price: minorToDecimalString(v.price, shop.currency),
      priceCurrency: shop.currency,
      availability: v.available ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
    })),
  };
  const breadcrumbList = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((crumb, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: crumb.label,
      item: `${origin}${crumb.href ?? `/products/${product.handle}`}`,
    })),
  };
  const trust = [
    { icon: 'lock' as const, label: settings.trustItem1 || 'Secure checkout' },
    { icon: 'box' as const, label: settings.trustItem2 || 'Order tracking' },
  ];

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd([structured, breadcrumbList]) }}
      />
      <Breadcrumbs items={crumbs} />
      <div className="grid gap-8 md:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-16 xl:gap-20">
        {/* The gallery stays in view beside long descriptions, unless a sticky header is there. */}
        <div className={settings.stickyHeader ? '' : 'md:sticky md:top-6 md:self-start'}>
          <ProductGallery
            images={product.images}
            title={product.title}
            ratio={RATIOS[settings.imageRatio]}
            productId={product.id}
            initialImageId={initialVariant(product)?.imageId}
          />
        </div>
        <div className="min-w-0">
          {product.vendor ? <p className="eyebrow mb-2 text-zinc-500">{product.vendor}</p> : null}
          <h1 className="t-title text-3xl break-words text-zinc-900 sm:text-4xl lg:text-[2.75rem]">
            {product.title}
          </h1>
          {product.isGiftCard ? (
            <p className="mt-3 rounded-lg bg-surface px-4 py-3 text-sm text-zinc-700">
              Delivered by email: you receive a gift card code as soon as your order is paid.
            </p>
          ) : null}
          <div className="mt-5">
            <VariantPicker product={product} currency={shop.currency}>
              <ul className="mt-6 grid grid-cols-2 gap-3 border-b border-zinc-200 pb-6 text-xs text-zinc-600 sm:text-sm">
                {trust.map((item) => (
                  <li key={item.icon} className="flex items-center gap-2">
                    <ProductIcon name={item.icon} className="size-5 shrink-0 text-zinc-900" />
                    {item.label}
                  </li>
                ))}
              </ul>
              {paragraphs.length > 0 ? (
                <Accordion title="Description" open>
                  <div className="space-y-4 text-[0.9375rem] text-zinc-700">
                    {paragraphs.map((p, i) => (
                      <p key={i} className="whitespace-pre-line">
                        {p}
                      </p>
                    ))}
                  </div>
                </Accordion>
              ) : null}
              <Specifications specs={product.specs} />
              <Accordion title="Shipping & returns">
                <ShippingAndReturns shop={shop} />
              </Accordion>
            </VariantPicker>
          </div>
        </div>
      </div>
      {related.length > 0 ? (
        <section
          aria-labelledby="related-heading"
          className="mt-20 border-t border-zinc-200 pt-14 sm:mt-28"
        >
          <div className="section-header">
            <div>
              <h2 id="related-heading" className="section-title t-title text-zinc-900">
                You may also like
              </h2>
              <span aria-hidden="true" className="section-rule" />
            </div>
          </div>
          <ProductGrid
            products={related}
            currency={shop.currency}
            theme={settings}
            maxColumns={4}
            layout="row"
          />
        </section>
      ) : null}
    </>
  );
}
