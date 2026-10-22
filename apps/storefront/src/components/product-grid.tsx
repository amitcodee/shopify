import { formatMoney, type ProductCard, type ThemeSettings } from '@repo/contracts';
import Link from 'next/link';

export function Price({
  min,
  max,
  compareAt,
  currency,
  inverse = false,
}: {
  min: number;
  max?: number;
  compareAt?: number | null;
  currency: string;
  /** Light text for use over a dark image. */
  inverse?: boolean;
}) {
  const onSale = compareAt != null && compareAt > min;
  const saleClass = inverse ? 'text-[#fca5a5]' : 'text-red-700';
  return (
    <span className="inline-flex items-baseline gap-2">
      <span className={onSale ? `font-semibold ${saleClass}` : 'font-semibold'}>
        {max !== undefined && max !== min
          ? `From ${formatMoney(min, currency)}`
          : formatMoney(min, currency)}
      </span>
      {onSale ? (
        <s className={inverse ? 'text-sm text-[#ffffffb3]' : 'text-sm text-zinc-500'}>
          <span className="sr-only">Regular price </span>
          {formatMoney(compareAt, currency)}
        </s>
      ) : null}
    </span>
  );
}

/** Static class names (Tailwind only generates classes it can see). Phones stay at two. */
const COLUMNS: Record<number, string> = {
  2: 'sm:grid-cols-2',
  3: 'sm:grid-cols-3',
  4: 'sm:grid-cols-3 lg:grid-cols-4',
  5: 'sm:grid-cols-3 lg:grid-cols-5',
};

const RATIOS: Record<ThemeSettings['imageRatio'], string> = {
  square: 'aspect-square',
  portrait: 'aspect-[3/4]',
  landscape: 'aspect-[4/3]',
};

/** Per card style: the card itself, its image box, and the caption under the image. */
const CARDS: Record<
  Exclude<ThemeSettings['cardStyle'], 'overlay'>,
  { card: string; image: string; caption: string }
> = {
  plain: { card: '', image: 'rounded-lg', caption: 'pt-3' },
  bordered: {
    card: 'overflow-hidden rounded-lg border border-zinc-200 transition hover:border-zinc-400',
    image: '',
    caption: 'border-t border-zinc-200 p-3',
  },
  shadow: {
    card: 'overflow-hidden rounded-xl bg-page shadow-[0_10px_30px_-12px_rgb(0_0_0/0.28)] ring-1 ring-zinc-200 transition hover:-translate-y-0.5 hover:shadow-[0_16px_36px_-12px_rgb(0_0_0/0.35)]',
    image: '',
    caption: 'p-4',
  },
  framed: {
    card: 'rounded-xl bg-surface p-3 transition hover:bg-zinc-100',
    image: 'rounded-lg',
    caption: 'px-1 pb-1 pt-3',
  },
};

export function ProductGrid({
  products,
  currency,
  theme,
  maxColumns = 5,
}: {
  products: ProductCard[];
  currency: string;
  theme: ThemeSettings;
  /** Caps the theme's column count (e.g. a short "you may also like" row). */
  maxColumns?: number;
}) {
  if (products.length === 0) {
    return <p className="py-12 text-center text-zinc-500">No products found.</p>;
  }
  const columns = COLUMNS[Math.min(theme.gridColumns, maxColumns)] ?? COLUMNS[4];
  const gap = theme.density === 'compact' ? 'gap-x-3 gap-y-6' : 'gap-x-4 gap-y-8 lg:gap-x-6';
  return (
    <ul className={`grid grid-cols-2 ${gap} ${columns}`}>
      {products.map((p) => (
        <li key={p.id}>
          {theme.cardStyle === 'overlay' ? (
            <OverlayCard product={p} currency={currency} ratio={RATIOS[theme.imageRatio]} />
          ) : (
            <Link
              href={`/products/${p.handle}`}
              className={`group block h-full ${CARDS[theme.cardStyle].card}`}
            >
              <div
                className={`${RATIOS[theme.imageRatio]} overflow-hidden bg-zinc-100 ${CARDS[theme.cardStyle].image}`}
              >
                <CardImage product={p} />
              </div>
              <div className={CARDS[theme.cardStyle].caption}>
                <h3 className="text-sm text-zinc-900 group-hover:underline">{p.title}</h3>
                <p className="mt-1 text-sm">
                  <Price
                    min={p.minPrice}
                    max={p.maxPrice}
                    compareAt={p.compareAtPrice}
                    currency={currency}
                  />
                </p>
                {!p.available ? <p className="mt-1 text-xs text-zinc-500">Sold out</p> : null}
              </div>
            </Link>
          )}
        </li>
      ))}
    </ul>
  );
}

function CardImage({ product }: { product: ProductCard }) {
  return product.imageUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={product.imageUrl}
      alt={product.imageAlt}
      loading="lazy"
      className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
    />
  ) : null;
}

/** Title and price over the bottom of the image, on a gradient so they stay readable. */
function OverlayCard({
  product: p,
  currency,
  ratio,
}: {
  product: ProductCard;
  currency: string;
  ratio: string;
}) {
  return (
    <Link
      href={`/products/${p.handle}`}
      className={`group relative block overflow-hidden rounded-lg bg-zinc-100 ${ratio}`}
    >
      <CardImage product={p} />
      {!p.available ? (
        <p className="absolute left-2 top-2 rounded-sm bg-[#000000b3] px-2 py-0.5 text-xs text-[#ffffff]">
          Sold out
        </p>
      ) : null}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#000000d9] via-[#00000066] to-transparent px-3 pb-3 pt-14 text-[#ffffff]">
        <h3 className="text-sm font-medium group-hover:underline">{p.title}</h3>
        <p className="mt-0.5 text-sm">
          <Price
            min={p.minPrice}
            max={p.maxPrice}
            compareAt={p.compareAtPrice}
            currency={currency}
            inverse
          />
        </p>
      </div>
    </Link>
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
