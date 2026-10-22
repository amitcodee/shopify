import Link from 'next/link';
import { SectionHeader } from './section-header';

export interface CollectionFeature {
  title: string;
  handle: string;
  /** Products in the collection (null when it could not be counted). */
  total: number | null;
  imageUrl: string | null;
}

const productCount = (total: number) => `${total} ${total === 1 ? 'product' : 'products'}`;

/** Grid classes by card count, so a short list still fills the row evenly. */
function gridFor(count: number): string {
  if (count === 1) return 'grid-cols-1';
  if (count === 2 || count === 4) return 'grid-cols-2 lg:grid-cols-4';
  return 'grid-cols-2 md:grid-cols-3';
}

/**
 * The store's collections. Catalog stores get dense tiles with a thumbnail; every other layout
 * gets photo cards with the title over the image.
 */
export function FeaturedCollections({
  collections,
  dense,
}: {
  collections: CollectionFeature[];
  dense: boolean;
}) {
  // On two-column phones an odd last card spans the row (three-column grids are md and up).
  const lastOdd =
    collections.length > 1 && collections.length % 2 === 1 ? collections.length - 1 : -1;
  return (
    <section aria-labelledby="collections-heading" className="store-section">
      <SectionHeader
        id="collections-heading"
        title="Collections"
        eyebrow={dense ? undefined : 'Shop by category'}
      />
      {dense ? (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {collections.map((c) => (
            <li key={c.handle}>
              <Link
                href={`/collections/${c.handle}`}
                className="group flex items-center gap-4 rounded-lg border border-zinc-200 bg-surface p-3 transition hover:border-zinc-900"
              >
                <div className="h-16 w-16 shrink-0 overflow-hidden rounded-md bg-zinc-100">
                  {c.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={c.imageUrl}
                      alt=""
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                  ) : null}
                </div>
                <div className="min-w-0 flex-1">
                  <span className="block font-heading text-base font-semibold leading-tight break-words group-hover:underline">
                    {c.title}
                  </span>
                  {c.total != null ? (
                    <span className="mt-1 block text-xs text-zinc-500">
                      {productCount(c.total)}
                    </span>
                  ) : null}
                </div>
                <span
                  aria-hidden="true"
                  className="text-accent transition group-hover:translate-x-0.5"
                >
                  →
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <ul className={`grid gap-3 sm:gap-4 lg:gap-6 ${gridFor(collections.length)}`}>
          {collections.map((c, i) => (
            <li key={c.handle} className={i === lastOdd ? 'col-span-2 md:col-span-1' : undefined}>
              <Link
                href={`/collections/${c.handle}`}
                className={`group relative block overflow-hidden rounded-xl bg-surface ${
                  collections.length === 1
                    ? 'aspect-[16/7]'
                    : i === lastOdd
                      ? 'aspect-[2/1] md:aspect-[3/4]'
                      : 'aspect-[4/5] sm:aspect-[3/4]'
                }`}
              >
                {c.imageUrl ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={c.imageUrl}
                      alt=""
                      loading="lazy"
                      className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#000000b3] via-[#00000033] to-transparent" />
                  </>
                ) : (
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_75%_20%,var(--store-accent),transparent_65%)] opacity-25" />
                )}
                <div
                  className={`absolute inset-x-0 bottom-0 p-4 sm:p-6 ${
                    c.imageUrl ? 'text-[#ffffff]' : 'text-ink'
                  }`}
                >
                  <h3 className="font-heading text-lg font-semibold leading-tight break-words sm:text-2xl">
                    {c.title}
                  </h3>
                  <p className="mt-1 flex items-center gap-2 text-xs opacity-90 sm:text-sm">
                    {c.total != null ? <span>{productCount(c.total)}</span> : null}
                    <span
                      aria-hidden="true"
                      className="transition duration-300 group-hover:translate-x-1"
                    >
                      →
                    </span>
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
