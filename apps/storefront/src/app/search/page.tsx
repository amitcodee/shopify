import type { ProductCardPage } from '@repo/contracts';
import { PageLinks, ProductGrid } from '@/components/product-grid';
import { sf } from '@/lib/api';
import { getShop } from '@/lib/shop';

export const metadata = { title: 'Search' };

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const { q = '', page: rawPage } = await searchParams;
  const query = q.trim().slice(0, 100);
  const page = Math.max(1, Number(rawPage) || 1);
  const shop = await getShop();
  if (!shop) return null;
  const results = query
    ? await sf<ProductCardPage>('/products', { query: { q: query, page } })
    : null;

  return (
    <>
      <h1 className="mb-6 text-3xl font-bold tracking-tight">Search</h1>
      <form action="/search" role="search" className="mb-8 flex max-w-lg gap-2">
        <label htmlFor="q" className="sr-only">
          Search products
        </label>
        <input id="q" name="q" type="search" defaultValue={query} className="field flex-1" />
        <button
          type="submit"
          className="rounded-full bg-brand shadow-sm px-4 py-2 text-sm font-semibold text-brand-contrast"
        >
          Search
        </button>
      </form>
      {results ? (
        <>
          <p className="mb-6 text-sm text-zinc-600" aria-live="polite">
            {results.total} {results.total === 1 ? 'result' : 'results'} for “{query}”
          </p>
          <ProductGrid products={results.items} currency={shop.currency} />
          <PageLinks
            page={results.page}
            pageSize={results.pageSize}
            total={results.total}
            hrefFor={(p) => `/search?q=${encodeURIComponent(query)}&page=${p}`}
          />
        </>
      ) : null}
    </>
  );
}
