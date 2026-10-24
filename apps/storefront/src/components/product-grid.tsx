import { formatMoney, type ProductCard } from '@repo/contracts';
import Link from 'next/link';

export function Price({
  min,
  max,
  compareAt,
  currency,
}: {
  min: number;
  max?: number;
  compareAt?: number | null;
  currency: string;
}) {
  const onSale = compareAt != null && compareAt > min;
  return (
    <span className="inline-flex items-baseline gap-2">
      <span className={onSale ? 'font-semibold text-red-700' : 'font-semibold'}>
        {max !== undefined && max !== min
          ? `From ${formatMoney(min, currency)}`
          : formatMoney(min, currency)}
      </span>
      {onSale ? (
        <s className="text-sm text-zinc-500">
          <span className="sr-only">Regular price </span>
          {formatMoney(compareAt, currency)}
        </s>
      ) : null}
    </span>
  );
}

export function ProductGrid({ products, currency }: { products: ProductCard[]; currency: string }) {
  if (products.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-zinc-300 py-16 text-center">
        <p className="font-medium text-zinc-900">No products found.</p>
        <p className="mt-1 text-sm text-zinc-500">Try another search or browse all products.</p>
      </div>
    );
  }
  return (
    <ul className="grid grid-cols-2 gap-x-4 gap-y-10 sm:grid-cols-3 sm:gap-x-6 lg:grid-cols-4">
      {products.map((p) => {
        const onSale = p.compareAtPrice != null && p.compareAtPrice > p.minPrice;
        return (
          <li key={p.id}>
            <Link href={`/products/${p.handle}`} className="group block">
              <div className="relative aspect-[4/5] overflow-hidden rounded-2xl bg-zinc-100 ring-1 ring-zinc-900/5">
                {p.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.imageUrl}
                    alt={p.imageAlt}
                    loading="lazy"
                    className={`h-full w-full object-cover transition duration-500 group-hover:scale-[1.04] ${p.available ? '' : 'opacity-60 grayscale'}`}
                  />
                ) : null}
                <div className="absolute top-3 left-3 flex flex-col items-start gap-1.5">
                  {!p.available ? (
                    <span className="rounded-full bg-zinc-900/85 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur">
                      Sold out
                    </span>
                  ) : onSale ? (
                    <span
                      aria-hidden
                      className="rounded-full bg-red-600 px-2.5 py-1 text-[11px] font-semibold text-white"
                    >
                      Sale
                    </span>
                  ) : null}
                </div>
              </div>
              <h3 className="mt-4 text-sm font-medium text-zinc-900 decoration-zinc-400 underline-offset-4 group-hover:underline">
                {p.title}
              </h3>
              <p className="mt-1 text-sm">
                <Price
                  min={p.minPrice}
                  max={p.maxPrice}
                  compareAt={p.compareAtPrice}
                  currency={currency}
                />
              </p>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export function PageLinks({
  page,
  pageSize,
  total,
  hrefFor,
}: {
  page: number;
  pageSize: number;
  total: number;
  hrefFor: (page: number) => string;
}) {
  const pages = Math.ceil(total / pageSize);
  if (pages <= 1) return null;
  return (
    <nav aria-label="Pagination" className="mt-12 flex items-center justify-center gap-3 text-sm">
      {page > 1 ? (
        <Link
          href={hrefFor(page - 1)}
          className="rounded-full border border-zinc-300 px-4 py-2 font-medium hover:border-zinc-900"
        >
          ← Previous
        </Link>
      ) : null}
      <span className="text-zinc-500">
        Page {page} of {pages}
      </span>
      {page < pages ? (
        <Link
          href={hrefFor(page + 1)}
          className="rounded-full border border-zinc-300 px-4 py-2 font-medium hover:border-zinc-900"
        >
          Next →
        </Link>
      ) : null}
    </nav>
  );
}
