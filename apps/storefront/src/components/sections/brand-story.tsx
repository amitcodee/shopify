import type { ThemeStyleId } from '@repo/contracts';
import Link from 'next/link';

/**
 * Image beside a short story about the brand, with a link into the catalog. Editorial sets the
 * first paragraph as a large lede; bold and banner sit on a surface panel.
 */
export function BrandStory({
  title,
  text,
  imageUrl,
  imageSrcSet,
  imageFirst,
  style,
}: {
  title: string;
  text: string;
  imageUrl: string | null;
  /** `srcset` for the image (a product photo with renditions). */
  imageSrcSet?: string;
  /** Image on the left on wide screens (varies by layout). */
  imageFirst: boolean;
  style: ThemeStyleId;
}) {
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
  const editorial = style === 'editorial';
  const panel = style === 'bold' || style === 'banner' || style === 'fresh' || style === 'bento';
  return (
    <section
      aria-labelledby={title ? 'story-heading' : undefined}
      aria-label={title ? undefined : 'Our story'}
      className={`store-section grid items-center gap-8 md:grid-cols-2 md:gap-12 lg:gap-20 ${
        panel ? 'overflow-hidden rounded-2xl bg-surface md:gap-0 lg:gap-0' : ''
      }`}
    >
      <div
        className={`relative overflow-hidden bg-surface ${
          panel
            ? 'aspect-[4/3] md:aspect-auto md:h-full md:min-h-[30rem]'
            : `aspect-[4/3] rounded-2xl ${style === 'catalog' ? '' : 'md:aspect-[4/5]'}`
        } ${imageFirst ? '' : 'md:order-2'}`}
      >
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            srcSet={imageSrcSet}
            sizes={imageSrcSet ? '(min-width: 768px) 50vw, 100vw' : undefined}
            alt=""
            loading="lazy"
            decoding="async"
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_70%,var(--store-accent),transparent_60%)] opacity-30" />
        )}
      </div>
      <div className={`max-w-xl ${panel ? 'px-6 pb-10 md:px-12 md:py-14 lg:px-16' : ''}`}>
        <p className="eyebrow text-accent">Our story</p>
        {title ? (
          <h2
            id="story-heading"
            className={`t-title mt-4 break-words ${editorial ? 'text-4xl sm:text-6xl' : 'text-3xl sm:text-[2.75rem]'}`}
          >
            {title}
          </h2>
        ) : null}
        <div className="mt-6 space-y-4 text-base leading-relaxed text-zinc-600 sm:text-[1.0625rem]">
          {paragraphs.map((p, i) => (
            <p
              key={i}
              className={`break-words whitespace-pre-line ${
                editorial && i === 0
                  ? 'font-heading text-xl leading-snug text-zinc-800 sm:text-2xl'
                  : ''
              }`}
            >
              {p}
            </p>
          ))}
        </div>
        <Link href="/collections/all" className="btn mt-9 min-h-12 px-7 py-3 text-sm">
          Explore the collection
        </Link>
      </div>
    </section>
  );
}
