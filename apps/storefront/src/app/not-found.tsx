import Link from 'next/link';
import { SearchIcon } from '@/components/header/icons';
import { getShop } from '@/lib/shop';

export default async function NotFound() {
  const shop = await getShop();
  // Hosts without a store (the platform site) keep a plain message.
  if (!shop) {
    return (
      <div className="py-24 text-center">
        <h1 className="text-3xl font-bold tracking-tight">Page not found</h1>
        <p className="mt-2 text-zinc-600">The page you are looking for does not exist.</p>
        <Link href="/" className="mt-6 inline-block text-sm font-medium underline">
          Back to the store
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-xl flex-col items-center py-14 text-center sm:py-24">
      <p className="t-display text-[7rem] leading-none text-zinc-200 sm:text-[10rem]">404</p>
      <h1 className="page-title t-title mt-4">Page not found</h1>
      <p className="mt-3 text-zinc-600">
        The page you are looking for has moved or no longer exists. Try a search, or keep browsing{' '}
        {shop.name}.
      </p>
      <form action="/search" role="search" className="relative mt-8 flex w-full max-w-md gap-2">
        <label htmlFor="not-found-search" className="sr-only">
          Search products
        </label>
        <div className="relative flex-1">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-zinc-500" />
          <input
            id="not-found-search"
            name="q"
            type="search"
            placeholder="Search products"
            className="w-full rounded-md border border-zinc-300 bg-transparent py-3 pr-3 pl-10 text-sm placeholder:text-zinc-500"
          />
        </div>
        <button type="submit" className="btn px-5 text-sm">
          Search
        </button>
      </form>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-sm">
        <Link href="/collections/all" className="btn px-6 py-3">
          Continue shopping
        </Link>
        <Link href="/" className="font-medium underline underline-offset-4">
          Back to home
        </Link>
      </div>
      {shop.collections.length > 0 ? (
        <nav aria-label="Popular collections" className="mt-12 w-full">
          <p className="eyebrow text-zinc-500">Popular collections</p>
          <ul className="mt-4 flex flex-wrap justify-center gap-2">
            {shop.collections.slice(0, 6).map((c) => (
              <li key={c.handle}>
                <Link
                  href={`/collections/${c.handle}`}
                  className="inline-block rounded-full border border-zinc-300 px-4 py-1.5 text-sm text-zinc-700 hover:border-zinc-900 hover:text-zinc-950"
                >
                  {c.title}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}
    </div>
  );
}
