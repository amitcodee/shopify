/* eslint-disable @next/next/no-img-element -- static same-origin photos with explicit sizes; next/image adds nothing here. */

/** Marketing photography in public/media/marketing, with intrinsic sizes and default alt text. */
export const PHOTOS = {
  'packing-orders': {
    w: 1500,
    h: 1000,
    alt: 'A shop owner checking an order on her phone beside a stack of parcels',
  },
  'laptop-shop-counter': {
    w: 1600,
    h: 900,
    alt: 'A clothing shop owner working on a laptop at her counter',
  },
  'boutique-interior': {
    w: 1422,
    h: 1000,
    alt: 'A bright boutique with wooden shelves of products',
  },
  'product-photography': {
    w: 680,
    h: 1000,
    alt: 'A photographer shooting products in a studio',
  },
  'shipping-boxes': {
    w: 1497,
    h: 1000,
    alt: 'A seller packing a parcel at a desk next to a laptop',
  },
  'card-payment': {
    w: 1333,
    h: 1000,
    alt: 'A customer paying by card at a café counter',
  },
  'team-planning': {
    w: 1600,
    h: 900,
    alt: 'A team planning work with sticky notes on a glass wall',
  },
  'phone-shopping': {
    w: 1500,
    h: 1000,
    alt: 'A shopper browsing an online store on a phone',
  },
  'market-stall': {
    w: 1333,
    h: 1000,
    alt: 'A busy flower stall at an outdoor market',
  },
  'coffee-roaster': {
    w: 1500,
    h: 1000,
    alt: 'Freshly roasted coffee beans being scooped from a roaster',
  },
  'checkout-counter': {
    w: 1500,
    h: 1000,
    alt: 'A shop assistant taking a payment on a tablet at the counter',
  },
} as const;

export type PhotoName = keyof typeof PHOTOS;

/**
 * A marketing photo that fills its box (object-cover). Lazy by default; pass `priority` for the
 * main image above the fold. `alt=""` marks a purely decorative use.
 */
export function Photo({
  name,
  alt,
  className = '',
  priority = false,
  position,
}: {
  name: PhotoName;
  alt?: string;
  className?: string;
  priority?: boolean;
  /** CSS object-position, e.g. "30% center". */
  position?: string;
}) {
  const p = PHOTOS[name];
  return (
    <img
      src={`/media/marketing/${name}.webp`}
      width={p.w}
      height={p.h}
      alt={alt ?? p.alt}
      loading={priority ? 'eager' : 'lazy'}
      fetchPriority={priority ? 'high' : undefined}
      decoding="async"
      className={`size-full object-cover ${className}`}
      style={position ? { objectPosition: position } : undefined}
    />
  );
}

/** Photo shown for each industry (public/media/templates/<industry>/hero.webp). */
export function industryPhoto(industry: string): string {
  return `/media/templates/${industry}/hero.webp`;
}

/** Product photo `n` (1–4) for an industry. */
export function productPhoto(industry: string, n: number): string {
  return `/media/templates/${industry}/p${((((n - 1) % 4) + 4) % 4) + 1}.webp`;
}

/** A plain industry photo (hero or product), lazy unless `priority`. */
export function IndustryImage({
  src,
  alt = '',
  className = '',
  priority = false,
  square = false,
}: {
  src: string;
  alt?: string;
  className?: string;
  priority?: boolean;
  square?: boolean;
}) {
  return (
    <img
      src={src}
      width={square ? 600 : 1500}
      height={square ? 600 : 1000}
      alt={alt}
      loading={priority ? 'eager' : 'lazy'}
      fetchPriority={priority ? 'high' : undefined}
      decoding="async"
      className={`size-full object-cover ${className}`}
    />
  );
}
