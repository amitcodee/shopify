import { minorToDecimalString, type StorefrontProduct } from '@repo/contracts';
import type { Metadata } from 'next';
import Link from 'next/link';
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
    <div className="grid gap-10 md:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:gap-16">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(structured) }} />
      <div className="grid grid-cols-2 gap-3 self-start sm:gap-4">
        {product.images.length === 0 ? (
          <div className="col-span-2 aspect-[4/5] rounded-3xl bg-zinc-100" />
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
              className={`w-full rounded-3xl bg-zinc-100 object-cover ring-1 ring-zinc-900/5 ${
                index === 0 ? 'col-span-2' : 'aspect-square'
              }`}
            />
          ))
        )}
      </div>
      <div className="md:sticky md:top-24 md:self-start">
        <nav aria-label="Breadcrumb" className="mb-6 text-sm text-zinc-500">
          <Link href="/" className="hover:text-zinc-900">
            Home
          </Link>
          <span aria-hidden className="mx-2 text-zinc-300">
            /
          </span>
          <Link href="/collections/all" className="hover:text-zinc-900">
            Shop
          </Link>
        </nav>
        {product.vendor ? (
          <p className="text-xs font-semibold tracking-[0.18em] text-zinc-500 uppercase">
            {product.vendor}
          </p>
        ) : null}
        <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">{product.title}</h1>
        {product.isGiftCard ? (
          <p className="mt-3 rounded-xl bg-zinc-50 px-4 py-3 text-sm text-zinc-600">
            Delivered by email: you receive a gift card code as soon as your order is paid.
          </p>
        ) : null}
        <div className="mt-8 border-t border-zinc-200 pt-8">
          <VariantPicker product={product} currency={shop.currency} />
        </div>
        {paragraphs.length > 0 ? (
          <div className="mt-10 border-t border-zinc-200 pt-8">
            <h2 className="text-sm font-semibold text-zinc-900">Description</h2>
            <div className="mt-3 space-y-4 leading-relaxed text-zinc-600">
              {paragraphs.map((p, i) => (
                <p key={i} className="whitespace-pre-line">
                  {p}
                </p>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
