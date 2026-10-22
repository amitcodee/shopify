import type { ProductCardPage } from '@repo/contracts';
import {
  type CatalogSearchParams,
  catalogHref,
  catalogParams,
} from '@/components/product/catalog-params';
import { CatalogToolbar } from '@/components/product/catalog-toolbar';
import { EmptyState } from '@/components/product/empty-state';
import { ProductIcon } from '@/components/product/icons';
import { PageLinks, ProductGrid } from '@/components/product-grid';
import { sf } from '@/lib/api';
import { getShop } from '@/lib/shop';

export const metadata = { title: 'Search' };

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<CatalogSearchParams>;
}) {
  const params = await searchParams;
  const q = typeof params.q === 'string' ? params.q : '';
  const query = q.trim().slice(0, 100);
  const { sort, inStock, page } = catalogParams(params);
  const shop = await getShop();
  if (!shop) return null;
  const results = query
    ? await sf<ProductCardPage>('/products', {
        query: { q: query, page, sort, inStock: inStock ? 'true' : undefined },
      })
    : null;

  return (
    <>
      <h1 className="mb-6 text-3xl font-semibold tracking-tight text-zinc-900 md:text-4xl">
        Search
      </h1>
      <form action="/search" role="search" className="mb-8 flex max-w-xl gap-2">
        <label htmlFor="q" className="sr-only">
          Search products
        </label>
        <div className="relative flex-1">
          <ProductIcon
            name="search"
            className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-zinc-400"
          />
          <input
            id="q"
            name="q"
            type="search"
            defaultValue={query}
            placeholder="What are you looking for?"
            className="h-12 w-full rounded-md border border-zinc-300 bg-page pl-10 pr-3 text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none"
          />
        </div>
        <button type="submit" className="btn h-12 px-5 text-sm">
          Search
        </button>
      </form>
      {results ? (
        <>
          <div className="mb-8 flex flex-wrap items-center justify-between gap-4 border-y border-zinc-200 py-3">
            <p className="text-sm text-zinc-600" aria-live="polite">
              {results.total} {results.total === 1 ? 'result' : 'results'} for “{query}”
            </p>
            {results.total > 0 || inStock ? (
              <CatalogToolbar action="/search" sort={sort} inStock={inStock} keep={{ q: query }} />
            ) : null}
          </div>
          {results.items.length === 0 ? (
            inStock && page === 1 ? (
              <EmptyState
                title="Nothing in stock matches"
                action={{
                  href: catalogHref('/search', { q: query, sort, inStock: false }),
                  label: 'Include sold-out products',
                }}
              >
                Products matching your search are sold out at the moment.
              </EmptyState>
            ) : (
              <EmptyState
                title="No products found"
                action={{ href: '/collections/all', label: 'Browse all products' }}
              >
                Check the spelling, or try a shorter or more general word.
              </EmptyState>
            )
          ) : (
            <ProductGrid
              products={results.items}
              currency={shop.currency}
              theme={shop.theme.settings}
            />
          )}
          <PageLinks
            page={results.page}
            pageSize={results.pageSize}
            total={results.total}
            hrefFor={(p) => catalogHref('/search', { q: query, sort, inStock, page: p })}
          />
        </>
      ) : (
        <EmptyState
          title="Search the store"
          action={{ href: '/collections/all', label: 'Browse all products' }}
        >
          Type a product name, a brand or a kind of product above.
        </EmptyState>
      )}
    </>
  );
}
