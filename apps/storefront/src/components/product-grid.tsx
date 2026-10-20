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
    return <p className="py-12 text-center text-zinc-500">No products found.</p>;
  }
  return (
    <ul className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
      {products.map((p) => (
        <li key={p.id}>
          <Link href={`/products/${p.handle}`} className="group block">
            <div className="aspect-square overflow-hidden rounded-lg bg-zinc-100">
              {p.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={p.imageUrl}
                  alt={p.imageAlt}
                  loading="lazy"
                  className="h-full w-full object-cover transition group-hover:scale-105"
                />
              ) : null}
            </div>
            <h3 className="mt-3 text-sm text-zinc-900 group-hover:underline">{p.title}</h3>
            <p className="mt-1 text-sm">
              <Price
                min={p.minPrice}
                max={p.maxPrice}
                compareAt={p.compareAtPrice}
                currency={currency}
              />
            </p>
            {!p.available ? <p className="mt-1 text-xs text-zinc-500">Sold out</p> : null}
          </Link>
        </li>
      ))}
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
    <nav aria-label="Pagination" className="mt-10 flex items-center justify-center gap-4 text-sm">
      {page > 1 ? (
        <Link href={hrefFor(page - 1)} className="hover:underline">
          ← Previous
        </Link>
      ) : null}
      <span className="text-zinc-500">
        Page {page} of {pages}
      </span>
      {page < pages ? (
        <Link href={hrefFor(page + 1)} className="hover:underline">
          Next →
        </Link>
      ) : null}
    </nav>
  );
}
