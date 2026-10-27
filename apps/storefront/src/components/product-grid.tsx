import { formatMoney, type ProductCard, type ThemeSettings } from '@repo/contracts';
import Link from 'next/link';
import { cardSizes, srcSetFor } from '@/lib/images';

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
  const saleClass = inverse ? 'text-[#fecaca]' : 'text-red-700';
  return (
    <span className="card-price inline-flex flex-wrap items-baseline gap-x-2">
      <span className={onSale ? `price-now ${saleClass}` : 'price-now'}>
        {max !== undefined && max !== min
          ? `From ${formatMoney(min, currency)}`
          : formatMoney(min, currency)}
      </span>
      {onSale ? (
        <s
          className={
            inverse ? 'text-[0.8125rem] text-[#ffffffb3]' : 'text-[0.8125rem] text-zinc-500'
          }
        >
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
  plain: { card: '', image: 'rounded-lg', caption: 'pt-3.5' },
  bordered: {
    card: 'overflow-hidden rounded-lg border border-zinc-200 bg-page transition duration-300 hover:border-zinc-400',
    image: '',
    caption: 'border-t border-zinc-200 px-3.5 py-3',
  },
  shadow: {
    card: 'overflow-hidden rounded-xl bg-page shadow-[0_1px_2px_rgb(0_0_0/0.06),0_12px_32px_-16px_rgb(0_0_0/0.25)] ring-1 ring-zinc-200/70 transition duration-300 hover:-translate-y-1 hover:shadow-[0_1px_2px_rgb(0_0_0/0.06),0_22px_44px_-18px_rgb(0_0_0/0.35)]',
    image: '',
    caption: 'px-4 pt-3.5 pb-4',
  },
  framed: {
    card: 'rounded-xl bg-surface p-2.5 transition duration-300 hover:bg-zinc-100 sm:p-3',
    image: 'rounded-lg',
    caption: 'px-1 pt-3 pb-1',
  },
};

/**
 * One product card in the theme's card style: the grid, carousels and suggestions all use it.
 * Overlay cards set the title and price over the photo on a gradient.
 */
export function ProductCardLink({
  product: p,
  currency,
  theme,
  href = `/products/${p.handle}`,
  sizes = cardSizes(theme.gridColumns),
  eager = false,
}: {
  product: ProductCard;
  currency: string;
  theme: ThemeSettings;
  href?: string;
  /** `sizes` for the card image: how wide the card is at each breakpoint. */
  sizes?: string;
  /** Load the image straight away (cards in the first row, above the fold). */
  eager?: boolean;
}) {
  const ratio = RATIOS[theme.imageRatio];
  if (theme.cardStyle === 'overlay') {
    return (
      <OverlayCard
        product={p}
        currency={currency}
        ratio={ratio}
        href={href}
        sizes={sizes}
        eager={eager}
      />
    );
  }
  const style = CARDS[theme.cardStyle];
  return (
    <Link href={href} className={`group block h-full ${style.card}`}>
      <div className={`relative ${ratio} overflow-hidden bg-zinc-100 ${style.image}`}>
        <CardImage product={p} sizes={sizes} eager={eager} />
        <CardBadges product={p} />
      </div>
      <div className={`card-caption ${style.caption}`}>
        <h3 className="card-title line-clamp-2 text-zinc-900 decoration-1 underline-offset-4 group-hover:underline">
          {p.title}
        </h3>
        <p className="mt-1.5 text-zinc-900">
          <Price
            min={p.minPrice}
            max={p.maxPrice}
            compareAt={p.compareAtPrice}
            currency={currency}
          />
        </p>
      </div>
    </Link>
  );
}

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
  eagerFirstRow = false,
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
  /** The grid starts the page: load the first row's images straight away. */
  eagerFirstRow?: boolean;
}) {
  if (products.length === 0) {
    return <p className="py-12 text-center text-zinc-500">No products found.</p>;
  }
  const columnCount = Math.min(theme.gridColumns, maxColumns);
  const columns = COLUMNS[columnCount] ?? COLUMNS[4];
  const sizes = cardSizes(COLUMNS[columnCount] ? columnCount : 4);
  const gap =
    theme.density === 'compact'
      ? 'gap-x-3 gap-y-6 lg:gap-x-4'
      : theme.density === 'spacious'
        ? 'gap-x-4 gap-y-10 lg:gap-x-8 lg:gap-y-14'
        : 'gap-x-4 gap-y-8 lg:gap-x-6 lg:gap-y-10';
  const query = collection ? `?collection=${encodeURIComponent(collection)}` : '';
  const list =
    layout === 'row'
      ? `-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] sm:mx-0 sm:grid sm:overflow-visible sm:px-0 sm:pb-0 ${gap} [&::-webkit-scrollbar]:hidden`
      : `grid grid-cols-2 ${gap}`;
  return (
    <ul data-reveal="stagger" className={`${list} ${columns}`}>
      {products.map((p, i) => (
        <li
          key={p.id}
          className={
            layout === 'row' ? 'relative w-[46%] shrink-0 snap-start sm:w-auto' : 'relative'
          }
        >
          <ProductCardLink
            product={p}
            currency={currency}
            theme={theme}
            href={`/products/${p.handle}${query}`}
            sizes={sizes}
            eager={eagerFirstRow && i < columnCount}
          />
        </li>
      ))}
    </ul>
  );
}

/**
 * The product image. Where there is a second image it fades in on hover or keyboard focus, on
 * devices that can hover only (a tap on a phone just opens the product).
 */
function CardImage({
  product,
  sizes,
  eager = false,
}: {
  product: ProductCard;
  sizes: string;
  eager?: boolean;
}) {
  if (!product.imageUrl) return null;
  const second = product.secondImageUrl;
  const srcSet = srcSetFor(product.imageUrl, product.imageRenditions);
  const secondSrcSet = second ? srcSetFor(second, product.secondImageRenditions) : undefined;
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={product.imageUrl}
        srcSet={srcSet}
        sizes={srcSet ? sizes : undefined}
        alt={product.imageAlt}
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
        className="media-zoom h-full w-full object-cover"
      />
      {second ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={second}
          srcSet={secondSrcSet}
          sizes={secondSrcSet ? sizes : undefined}
          alt=""
          aria-hidden="true"
          loading="lazy"
          decoding="async"
          className="media-zoom absolute inset-0 hidden h-full w-full object-cover opacity-0 group-focus-visible:opacity-100 [@media(hover:hover)]:block [@media(hover:hover)]:group-hover:opacity-100"
        />
      ) : null}
    </>
  );
}

/** "Sold out" or "Sale −X%" in the image's top corner. */
function CardBadges({ product: p }: { product: ProductCard }) {
  const off = percentOff(p.minPrice, p.compareAtPrice);
  if (p.available && off === 0 && !p.isNew) return null;
  return (
    <span className="pointer-events-none absolute left-2 top-2 flex flex-col items-start gap-1 sm:left-3 sm:top-3">
      {p.isNew && p.available ? (
        <span className="rounded-sm bg-brand px-2 py-1.5 text-[10px] font-semibold uppercase leading-none tracking-[0.12em] text-brand-contrast sm:text-[11px]">
          New
        </span>
      ) : null}
      {!p.available ? (
        <span className="rounded-sm bg-page/95 px-2 py-1.5 text-[10px] font-semibold uppercase leading-none tracking-[0.12em] text-zinc-900 shadow-sm sm:text-[11px]">
          Sold out
        </span>
      ) : off > 0 ? (
        <span className="rounded-sm bg-accent px-2 py-1.5 text-[10px] font-semibold uppercase leading-none tracking-[0.12em] text-accent-contrast sm:text-[11px]">
          Sale −{off}%
        </span>
      ) : null}
    </span>
  );
}

/** Title and price over the bottom of the image, on a gradient so they stay readable. */
function OverlayCard({
  product: p,
  currency,
  ratio,
  href,
  sizes,
  eager,
}: {
  product: ProductCard;
  currency: string;
  ratio: string;
  href: string;
  sizes: string;
  eager: boolean;
}) {
  return (
    <Link
      href={href}
      className={`group relative block overflow-hidden rounded-lg bg-zinc-100 ${ratio}`}
    >
      <CardImage product={p} sizes={sizes} eager={eager} />
      <CardBadges product={p} />
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#000000e6] via-[#00000080] to-transparent px-3.5 pt-16 pb-3.5 text-[#ffffff] sm:px-4 sm:pb-4">
        <h3 className="card-title line-clamp-2 underline-offset-4 group-hover:underline">
          {p.title}
        </h3>
        <p className="mt-1">
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
