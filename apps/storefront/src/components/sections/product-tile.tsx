import type { ProductCard, ThemeSettings } from '@repo/contracts';
import Link from 'next/link';
import { Price } from '@/components/product-grid';

const RATIOS: Record<ThemeSettings['imageRatio'], string> = {
  square: 'aspect-square',
  portrait: 'aspect-[3/4]',
  landscape: 'aspect-[4/3]',
};

/** Card, image box and caption per card style, matching the product grid. */
const CARDS: Record<ThemeSettings['cardStyle'], { card: string; image: string; caption: string }> =
  {
    plain: { card: '', image: 'rounded-lg', caption: 'pt-3' },
    overlay: { card: '', image: 'rounded-lg', caption: 'pt-3' },
    bordered: {
      card: 'overflow-hidden rounded-lg border border-zinc-200 transition hover:border-zinc-400',
      image: '',
      caption: 'border-t border-zinc-200 p-3',
    },
    shadow: {
      card: 'overflow-hidden rounded-xl bg-page shadow-[0_10px_30px_-12px_rgb(0_0_0/0.28)] ring-1 ring-zinc-200',
      image: '',
      caption: 'p-4',
    },
    framed: {
      card: 'rounded-xl bg-surface p-3 transition hover:bg-zinc-100',
      image: 'rounded-lg',
      caption: 'px-1 pb-1 pt-3',
    },
  };

/** A product card for carousels, styled like the grid's; swaps to the second photo on hover. */
export function ProductTile({
  product: p,
  currency,
  theme,
}: {
  product: ProductCard;
  currency: string;
  theme: ThemeSettings;
}) {
  const style = CARDS[theme.cardStyle];
  // Text over the image, like the product grid's overlay cards.
  const overlay = theme.cardStyle === 'overlay';
  const off =
    p.compareAtPrice != null && p.compareAtPrice > p.minPrice
      ? Math.round((1 - p.minPrice / p.compareAtPrice) * 100)
      : 0;
  return (
    <Link
      href={`/products/${p.handle}`}
      className={`group block h-full ${overlay ? 'relative' : ''} ${style.card}`}
    >
      <div
        className={`relative ${RATIOS[theme.imageRatio]} overflow-hidden bg-zinc-100 ${style.image}`}
      >
        {p.imageUrl ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={p.imageUrl}
              alt={p.imageAlt}
              loading="lazy"
              className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-105"
            />
            {p.secondImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={p.secondImageUrl}
                alt=""
                loading="lazy"
                className="absolute inset-0 h-full w-full object-cover opacity-0 transition duration-500 group-hover:scale-105 group-hover:opacity-100"
              />
            ) : null}
          </>
        ) : null}
        {!p.available || off > 0 ? (
          <span
            className={`pointer-events-none absolute left-2 top-2 rounded-sm px-2 py-1 text-[10px] font-semibold uppercase leading-none tracking-wider sm:left-3 sm:top-3 sm:text-[11px] ${
              p.available ? 'bg-accent text-accent-contrast' : 'bg-zinc-900 text-white'
            }`}
          >
            {p.available ? `Sale −${off}%` : 'Sold out'}
          </span>
        ) : null}
      </div>
      <div
        className={
          overlay
            ? 'absolute inset-x-0 bottom-0 rounded-b-lg bg-gradient-to-t from-[#000000d9] via-[#00000066] to-transparent px-3 pb-3 pt-14 text-[#ffffff]'
            : style.caption
        }
      >
        <h3
          className={`line-clamp-2 text-sm group-hover:underline ${overlay ? 'font-medium' : 'text-zinc-900'}`}
        >
          {p.title}
        </h3>
        <p className={overlay ? 'mt-0.5 text-sm' : 'mt-1 text-sm'}>
          <Price
            min={p.minPrice}
            max={p.maxPrice}
            compareAt={p.compareAtPrice}
            currency={currency}
            inverse={overlay}
          />
        </p>
      </div>
    </Link>
  );
}
