import {
  minorToDecimalString,
  type ProductCardPage,
  type StorefrontProduct,
} from '@repo/contracts';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { ProductGrid } from '@/components/product-grid';
import { isNotFound, sf } from '@/lib/api';
import { getShop } from '@/lib/shop';
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

/** JSON-LD must not be able to close the script tag. */
function jsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

export default async function ProductPage({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const [product, shop] = await Promise.all([getProduct(handle), getShop()]);
  if (!product || !shop) notFound();
  const related = await getRelated(product);

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

  return (
    <>
      <div className="grid gap-10 md:grid-cols-2">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLd(structured) }}
        />
        <div className="space-y-4">
          {product.images.length === 0 ? (
            <div className="aspect-square rounded-xl bg-zinc-100" />
          ) : (
            product.images.map((image, index) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={image.url}
                src={image.url}
                alt={image.alt}
                width={image.width}
                height={image.height}
                loading={index === 0 ? 'eager' : 'lazy'}
                className="w-full rounded-xl bg-zinc-100 object-cover"
              />
            ))
          )}
        </div>
        <div>
          {product.vendor ? (
            <p className="text-sm uppercase tracking-wide text-zinc-500">{product.vendor}</p>
          ) : null}
          <h1 className="mt-1 text-3xl font-bold tracking-tight">{product.title}</h1>
          {product.isGiftCard ? (
            <p className="mt-2 text-sm text-zinc-600">
              Delivered by email: you receive a gift card code as soon as your order is paid.
            </p>
          ) : null}
          <div className="mt-6">
            <VariantPicker product={product} currency={shop.currency} />
          </div>
          <div className="mt-8 space-y-4 text-zinc-700">
            {paragraphs.map((p, i) => (
              <p key={i} className="whitespace-pre-line">
                {p}
              </p>
            ))}
          </div>
        </div>
      </div>
      {related.length > 0 ? (
        <section aria-labelledby="related-heading" className="mt-16">
          <h2 id="related-heading" className="mb-6 text-xl font-semibold">
            You may also like
          </h2>
          <ProductGrid products={related} currency={shop.currency} />
        </section>
      ) : null}
    </>
  );
}
