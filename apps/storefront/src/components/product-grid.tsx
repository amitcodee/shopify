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

export const RATIOS: Record<ThemeSettings['imageRatio'], string> = {
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

/** Whole-number percentage saved, or 0 when there is no real discount. */
export function percentOff(price: number, compareAt: number | null | undefined): number {
  if (compareAt == null || compareAt <= price || compareAt <= 0) return 0;
  return Math.round(((compareAt - price) / compareAt) * 100);
}

export function ProductGrid({
  products,
  currency,
  theme,
  maxColumns = 5,
  collection,
  layout = 'grid',
}: {
  products: ProductCard[];
  currency: string;
  theme: ThemeSettings;
  /** Caps the theme's column count (e.g. a short "you may also like" row). */
  maxColumns?: number;
  /** Collection the shopper is browsing; product links carry it for the breadcrumbs. */
  collection?: string;
  /** `row`: a swipeable row on phones (a grid from sm up), for short rows of suggestions. */
  layout?: 'grid' | 'row';
}) {
  if (products.length === 0) {
    return <p className="py-12 text-center text-zinc-500">No products found.</p>;
  }
  const columns = COLUMNS[Math.min(theme.gridColumns, maxColumns)] ?? COLUMNS[4];
  const gap = theme.density === 'compact' ? 'gap-x-3 gap-y-6' : 'gap-x-4 gap-y-8 lg:gap-x-6';
  const query = collection ? `?collection=${encodeURIComponent(collection)}` : '';
  const list =
    layout === 'row'
      ? `-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] sm:mx-0 sm:grid sm:overflow-visible sm:px-0 sm:pb-0 ${gap} [&::-webkit-scrollbar]:hidden`
      : `grid grid-cols-2 ${gap}`;
  return (
    <ul className={`${list} ${columns}`}>
      {products.map((p) => (
        <li
          key={p.id}
          className={
            layout === 'row' ? 'relative w-[46%] shrink-0 snap-start sm:w-auto' : 'relative'
          }
        >
          {theme.cardStyle === 'overlay' ? (
            <OverlayCard
              product={p}
              currency={currency}
              ratio={RATIOS[theme.imageRatio]}
              href={`/products/${p.handle}${query}`}
            />
          ) : (
            <Link
              href={`/products/${p.handle}${query}`}
              className={`group block h-full ${CARDS[theme.cardStyle].card}`}
            >
              <div
                className={`relative ${RATIOS[theme.imageRatio]} overflow-hidden bg-zinc-100 ${CARDS[theme.cardStyle].image}`}
              >
                <CardImage product={p} />
                <CardBadges product={p} />
              </div>
              <div className={CARDS[theme.cardStyle].caption}>
                <h3 className="text-sm text-zinc-900 underline-offset-4 group-hover:underline">
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
              </div>
            </Link>
          )}
        </li>
      ))}
    </ul>
  );
}

/**
 * The product image. Where there is a second image it fades in on hover or keyboard focus, on
 * devices that can hover only (a tap on a phone just opens the product).
 */
function CardImage({ product }: { product: ProductCard }) {
  if (!product.imageUrl) return null;
  const second = product.secondImageUrl;
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={product.imageUrl}
        alt={product.imageAlt}
        loading="lazy"
        className={`h-full w-full object-cover transition duration-700 ease-out ${
          second
            ? '[@media(hover:hover)]:group-hover:scale-[1.03]'
            : 'group-hover:scale-105 group-focus-visible:scale-105'
        }`}
      />
      {second ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={second}
          alt=""
          aria-hidden="true"
          loading="lazy"
          className="absolute inset-0 hidden h-full w-full object-cover opacity-0 transition duration-500 ease-out group-focus-visible:opacity-100 [@media(hover:hover)]:block [@media(hover:hover)]:group-hover:opacity-100"
        />
      ) : null}
    </>
  );
}

/** "Sold out" or "Sale −X%" in the image's top corner. */
function CardBadges({ product: p }: { product: ProductCard }) {
  const off = percentOff(p.minPrice, p.compareAtPrice);
  if (p.available && off === 0) return null;
  return (
    <span className="pointer-events-none absolute left-2 top-2 flex flex-col items-start gap-1 sm:left-3 sm:top-3">
      {!p.available ? (
        <span className="rounded-sm bg-zinc-900 px-2 py-1 text-[10px] font-semibold uppercase leading-none tracking-wider text-white sm:text-[11px]">
          Sold out
        </span>
      ) : (
        <span className="rounded-sm bg-accent px-2 py-1 text-[10px] font-semibold uppercase leading-none tracking-wider text-accent-contrast sm:text-[11px]">
          Sale −{off}%
        </span>
      )}
    </span>
  );
}

/** Title and price over the bottom of the image, on a gradient so they stay readable. */
function OverlayCard({
  product: p,
  currency,
  ratio,
  href,
}: {
  product: ProductCard;
  currency: string;
  ratio: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className={`group relative block overflow-hidden rounded-lg bg-zinc-100 ${ratio}`}
    >
      <CardImage product={p} />
      <CardBadges product={p} />
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#000000d9] via-[#00000066] to-transparent px-3 pb-3 pt-14 text-[#ffffff]">
        <h3 className="text-sm font-medium underline-offset-4 group-hover:underline">{p.title}</h3>
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

/** Page numbers to show: the first, the last and a window around the current page. */
function pageWindow(page: number, pages: number): (number | 'gap')[] {
  const shown = [...new Set([1, page - 1, page, page + 1, pages])]
    .filter((n) => n >= 1 && n <= pages)
    .sort((a, b) => a - b);
  const out: (number | 'gap')[] = [];
  shown.forEach((n, i) => {
    const prev = shown[i - 1];
    if (prev !== undefined && n - prev === 2) out.push(prev + 1);
    else if (prev !== undefined && n - prev > 2) out.push('gap');
    out.push(n);
  });
  return out;
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
  const box = 'flex h-10 min-w-10 items-center justify-center gap-1.5 rounded-md px-3 transition';
  return (
    <nav aria-label="Pagination" className="mt-12 flex justify-center text-sm">
      <ul className="flex flex-wrap items-center justify-center gap-1">
        {page > 1 ? (
          <li>
            <Link href={hrefFor(page - 1)} rel="prev" className={`${box} hover:bg-zinc-100`}>
              <span aria-hidden="true">←</span>
              <span className="sr-only sm:not-sr-only">Previous</span>
            </Link>
          </li>
        ) : null}
        {pageWindow(page, pages).map((n, i) => (
          <li key={n === 'gap' ? `gap-${i}` : n}>
            {n === 'gap' ? (
              <span className="px-1 text-zinc-400">…</span>
            ) : n === page ? (
              <span aria-current="page" className={`${box} bg-zinc-900 font-semibold text-white`}>
                <span className="sr-only">Page </span>
                {n}
              </span>
            ) : (
              <Link href={hrefFor(n)} className={`${box} hover:bg-zinc-100`}>
                <span className="sr-only">Page </span>
                {n}
              </Link>
            )}
          </li>
        ))}
        {page < pages ? (
          <li>
            <Link href={hrefFor(page + 1)} rel="next" className={`${box} hover:bg-zinc-100`}>
              <span className="sr-only sm:not-sr-only">Next</span>
              <span aria-hidden="true">→</span>
            </Link>
          </li>
        ) : null}
      </ul>
    </nav>
  );
}
