import type { ProductCardPage, StorefrontCollection } from '@repo/contracts';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Breadcrumbs } from '@/components/product/breadcrumbs';
import {
  type CatalogSearchParams,
  catalogHref,
  catalogParams,
} from '@/components/product/catalog-params';
import { CatalogToolbar } from '@/components/product/catalog-toolbar';
import { EmptyState } from '@/components/product/empty-state';
import { PageLinks, ProductGrid } from '@/components/product-grid';
import { isNotFound, sf } from '@/lib/api';
import { getShop } from '@/lib/shop';

async function getCollection(handle: string): Promise<StorefrontCollection | null> {
  if (handle === 'all') return { title: 'All products', handle: 'all', description: '' };
  try {
    return await sf<StorefrontCollection>(`/collections/${encodeURIComponent(handle)}`);
  } catch (error) {
    if (isNotFound(error)) return null;
    throw error;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ handle: string }>;
}): Promise<Metadata> {
  const collection = await getCollection((await params).handle);
  return collection
    ? { title: collection.title, description: collection.description || undefined }
    : {};
}

export default async function CollectionPage({
  params,
  searchParams,
}: {
  params: Promise<{ handle: string }>;
  searchParams: Promise<CatalogSearchParams>;
}) {
  const { handle } = await params;
  const { sort, inStock, page } = catalogParams(await searchParams);

  const [shop, collection] = await Promise.all([getShop(), getCollection(handle)]);
  if (!shop || !collection) notFound();
  const products = await sf<ProductCardPage>('/products', {
    query: {
      collection: handle === 'all' ? undefined : handle,
      sort,
      page,
      inStock: inStock ? 'true' : undefined,
    },
  });
  const path = `/collections/${collection.handle}`;

  return (
    <>
      <Breadcrumbs
        items={[
          { label: 'Home', href: '/' },
          { label: 'Collections', href: '/collections' },
          { label: collection.title },
        ]}
      />
      <header className="mb-8 max-w-3xl">
        <h1 className="page-title t-title text-zinc-900">{collection.title}</h1>
        {collection.description ? (
          <p className="mt-3 text-base leading-relaxed text-zinc-600">{collection.description}</p>
        ) : null}
      </header>
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4 border-y border-zinc-200 py-3">
        <p className="text-sm text-zinc-500" aria-live="polite">
          {products.total} {products.total === 1 ? 'product' : 'products'}
        </p>
        {products.total > 0 || inStock ? (
          <CatalogToolbar action={path} sort={sort} inStock={inStock} />
        ) : null}
      </div>
      {products.items.length === 0 ? (
        inStock ? (
          <EmptyState
            title="Nothing in stock right now"
            action={{
              href: catalogHref(path, { sort, inStock: false }),
              label: 'Show all products',
            }}
          >
            Everything in this collection is sold out at the moment.
          </EmptyState>
        ) : (
          <EmptyState
            icon="bag"
            title={page > 1 ? 'No more products' : 'This collection is empty'}
            action={
              page > 1
                ? { href: catalogHref(path, { sort, inStock }), label: 'Back to the first page' }
                : { href: '/collections/all', label: 'Browse all products' }
            }
          >
            {page > 1
              ? 'There are no products on this page.'
              : 'There are no products here yet. Take a look around the rest of the store.'}
          </EmptyState>
        )
      ) : (
        <ProductGrid
          products={products.items}
          currency={shop.currency}
          theme={shop.theme.settings}
          collection={collection.handle === 'all' ? undefined : collection.handle}
          eagerFirstRow
        />
      )}
      <PageLinks
        page={products.page}
        pageSize={products.pageSize}
        total={products.total}
        hrefFor={(p) => catalogHref(path, { sort, inStock, page: p })}
      />
    </>
  );
}
