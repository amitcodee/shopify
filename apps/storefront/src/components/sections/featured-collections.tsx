import Link from 'next/link';
import { SectionHeader } from './section-header';

export interface CollectionFeature {
  title: string;
  handle: string;
  /** Products in the collection (null when it could not be counted). */
  total: number | null;
  imageUrl: string | null;
  /** `srcset` for the photo (product photos with renditions). */
  imageSrcSet?: string;
}

const productCount = (total: number) => `${total} ${total === 1 ? 'product' : 'products'}`;

/** Grid classes by card count, so a short list still fills the row evenly. */
function gridFor(count: number): string {
  if (count === 1) return 'grid-cols-1';
  if (count === 2 || count === 4) return 'grid-cols-2 lg:grid-cols-4';
  return 'grid-cols-2 md:grid-cols-3';
}

/** Card widths matching `gridFor` (an odd last card spans the row on phones). */
function sizesFor(count: number, spansRow: boolean): string {
  if (count === 1) return '100vw';
  if (count === 2 || count === 4) return '(min-width: 1024px) 25vw, 50vw';
  return `(min-width: 768px) 33vw, ${spansRow ? '100vw' : '50vw'}`;
}

/**
 * The store's collections. Catalog stores get dense tiles with a thumbnail; every other layout
 * gets photo cards with the title over the image.
 */
export function FeaturedCollections({
  collections,
  dense,
  captionBelow = false,
}: {
  collections: CollectionFeature[];
  dense: boolean;
  /** Title under the photo instead of over it (editorial and classic layouts). */
  captionBelow?: boolean;
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
                className="group flex items-center gap-4 rounded-lg border border-zinc-200 bg-page p-2.5 pr-4 transition hover:border-zinc-900"
              >
                <div className="h-16 w-16 shrink-0 overflow-hidden rounded-md bg-zinc-100">
                  {c.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={c.imageUrl}
                      srcSet={c.imageSrcSet}
                      sizes={c.imageSrcSet ? '64px' : undefined}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      className="h-full w-full object-cover"
                    />
                  ) : null}
                </div>
                <div className="min-w-0 flex-1">
                  <span className="block text-[0.9375rem] leading-tight font-semibold break-words group-hover:underline">
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
      ) : captionBelow ? (
        <ul className={`grid gap-x-4 gap-y-8 lg:gap-x-8 ${gridFor(collections.length)}`}>
          {collections.map((c, i) => (
            <li key={c.handle} className={i === lastOdd ? 'col-span-2 md:col-span-1' : undefined}>
              <Link href={`/collections/${c.handle}`} className="group block">
                <div
                  className={`relative overflow-hidden rounded-lg bg-surface ${
                    collections.length === 1
                      ? 'aspect-[16/7]'
                      : i === lastOdd
                        ? 'aspect-[2/1] md:aspect-[4/5]'
                        : 'aspect-[4/5]'
                  }`}
                >
                  {c.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={c.imageUrl}
                      srcSet={c.imageSrcSet}
                      sizes={
                        c.imageSrcSet ? sizesFor(collections.length, i === lastOdd) : undefined
                      }
                      alt=""
                      loading="lazy"
                      decoding="async"
                      className="media-zoom absolute inset-0 h-full w-full object-cover"
                    />
                  ) : (
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_75%_20%,var(--store-accent),transparent_65%)] opacity-25" />
                  )}
                </div>
                <h3 className="t-title mt-4 text-xl break-words decoration-1 underline-offset-4 group-hover:underline sm:text-2xl">
                  {c.title}
                </h3>
                {c.total != null ? (
                  <p className="eyebrow mt-1.5 text-zinc-500">{productCount(c.total)}</p>
                ) : null}
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
                      srcSet={c.imageSrcSet}
                      sizes={
                        c.imageSrcSet ? sizesFor(collections.length, i === lastOdd) : undefined
                      }
                      alt=""
                      loading="lazy"
                      decoding="async"
                      className="media-zoom absolute inset-0 h-full w-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#000000c7] via-[#00000033] to-transparent" />
                  </>
                ) : (
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_75%_20%,var(--store-accent),transparent_65%)] opacity-25" />
                )}
                <div
                  className={`absolute inset-x-0 bottom-0 p-4 sm:p-6 ${
                    c.imageUrl ? 'text-[#ffffff]' : 'text-ink'
                  }`}
                >
                  <h3 className="t-title text-lg break-words sm:text-[1.75rem]">{c.title}</h3>
                  <p className="mt-2 flex items-center gap-2 text-xs font-medium opacity-90 sm:text-sm">
                    {c.total != null ? (
                      <>
                        <span>{productCount(c.total)}</span>
                        <span aria-hidden="true" className="hidden sm:inline">
                          ·
                        </span>
                      </>
                    ) : null}
                    <span className="hidden underline decoration-1 underline-offset-4 sm:inline">
                      Shop now
                    </span>
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
