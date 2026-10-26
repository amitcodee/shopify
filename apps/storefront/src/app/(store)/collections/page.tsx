import type { ProductCardPage, StorefrontCollection } from '@repo/contracts';
import Link from 'next/link';
import { Breadcrumbs } from '@/components/product/breadcrumbs';
import { sf } from '@/lib/api';
import { srcSetFor } from '@/lib/images';

export const metadata = { title: 'Collections' };

/** Each collection with its product count and the image of its newest product. */
async function withCovers(collections: StorefrontCollection[]) {
  return Promise.all(
    collections.map(async (collection) => {
      const first = await sf<ProductCardPage>('/products', {
        query: {
          collection: collection.handle === 'all' ? undefined : collection.handle,
          pageSize: 1,
        },
      });
      const product = first.items[0];
      return {
        ...collection,
        total: first.total,
        image: product?.imageUrl ?? null,
        imageSrcSet: product?.imageUrl
          ? srcSetFor(product.imageUrl, product.imageRenditions)
          : undefined,
      };
    }),
  );
}

export default async function CollectionsPage() {
  const collections = await withCovers([
    { title: 'All products', handle: 'all', description: 'Everything we sell.' },
    ...(await sf<StorefrontCollection[]>('/collections')),
  ]);
  return (
    <>
      <Breadcrumbs items={[{ label: 'Home', href: '/' }, { label: 'Collections' }]} />
      <h1 className="mb-8 page-title t-title text-zinc-900">Collections</h1>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">
        {collections.map((c) => (
          <li key={c.handle}>
            <Link
              href={`/collections/${c.handle}`}
              className={`group relative block aspect-[4/3] overflow-hidden rounded-xl ${
                c.image ? 'bg-zinc-100' : 'bg-brand'
              }`}
            >
              {c.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={c.image}
                  srcSet={c.imageSrcSet}
                  sizes={
                    c.imageSrcSet
                      ? '(min-width: 1312px) 422px, (min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw'
                      : undefined
                  }
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-cover transition duration-700 ease-out group-hover:scale-105"
                />
              ) : null}
              <div
                className={`absolute inset-x-0 bottom-0 px-5 pb-5 pt-20 ${
                  c.image
                    ? 'bg-gradient-to-t from-[#000000b3] via-[#00000033] via-45% to-transparent text-[#ffffff]'
                    : 'text-brand-contrast'
                }`}
              >
                <h2 className="text-xl font-semibold tracking-tight">{c.title}</h2>
                <p className="mt-1 flex items-center gap-2 text-sm opacity-85">
                  {c.total} {c.total === 1 ? 'product' : 'products'}
                  <span
                    aria-hidden="true"
                    className="transition-transform duration-300 group-hover:translate-x-1"
                  >
                    →
                  </span>
                </p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
