import { minorToDecimalString, type StorefrontProduct } from '@repo/contracts';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { cache } from 'react';
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

/** JSON-LD must not be able to close the script tag. */
function jsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

export default async function ProductPage({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const [product, shop] = await Promise.all([getProduct(handle), getShop()]);
  if (!product || !shop) notFound();

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
    <div className="grid gap-10 md:grid-cols-2">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(structured) }} />
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
  );
}
