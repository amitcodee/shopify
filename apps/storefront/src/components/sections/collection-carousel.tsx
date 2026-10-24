import type { ProductCard, ThemeSettings } from '@repo/contracts';
import { ProductTile } from './product-tile';
import { ScrollRow } from './scroll-row';

/** Card widths in the row (see the `li` classes below; the page is at most 82rem wide). */
const CAROUSEL_SIZES =
  '(min-width: 1312px) 314px, (min-width: 1024px) 24vw, (min-width: 640px) 30vw, 44vw';

/** One collection's products in a horizontally scrolling row. */
export function CollectionCarousel({
  title,
  handle,
  products,
  currency,
  theme,
}: {
  title: string;
  handle: string;
  products: ProductCard[];
  currency: string;
  theme: ThemeSettings;
}) {
  if (products.length === 0) return null;
  const id = `carousel-${handle}-heading`;
  return (
    <section aria-labelledby={id} className="store-section">
      <ScrollRow id={id} title={title} eyebrow="Collection" href={`/collections/${handle}`}>
        {products.map((p) => (
          <li
            key={p.id}
            className="relative w-[44%] shrink-0 snap-start sm:w-[30%] lg:w-[calc(25%-1.125rem)]"
          >
            <ProductTile product={p} currency={currency} theme={theme} sizes={CAROUSEL_SIZES} />
          </li>
        ))}
      </ScrollRow>
    </section>
  );
}
