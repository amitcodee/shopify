import Link from 'next/link';

/** Image beside a short story about the brand, with a link into the catalog. */
export function BrandStory({
  title,
  text,
  imageUrl,
  imageFirst,
}: {
  title: string;
  text: string;
  imageUrl: string | null;
  /** Image on the left on wide screens (varies by layout). */
  imageFirst: boolean;
}) {
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
  return (
    <section
      aria-labelledby={title ? 'story-heading' : undefined}
      aria-label={title ? undefined : 'Our story'}
      className="store-section grid items-center gap-8 md:grid-cols-2 md:gap-12 lg:gap-16"
    >
      <div
        className={`relative aspect-[4/3] overflow-hidden rounded-2xl bg-surface md:aspect-square ${
          imageFirst ? '' : 'md:order-2'
        }`}
      >
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt=""
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_70%,var(--store-accent),transparent_60%)] opacity-30" />
        )}
      </div>
      <div className="max-w-lg">
        <p className="eyebrow text-zinc-500">Our story</p>
        {title ? (
          <h2
            id="story-heading"
            className="mt-3 font-heading text-3xl font-semibold leading-tight tracking-tight break-words sm:text-4xl"
          >
            {title}
          </h2>
        ) : null}
        <div className="mt-5 space-y-4 text-base leading-relaxed text-zinc-600 sm:text-lg">
          {paragraphs.map((p, i) => (
            <p key={i} className="break-words whitespace-pre-line">
              {p}
            </p>
          ))}
        </div>
        <Link href="/collections/all" className="btn mt-8 px-6 py-3 text-sm">
          Explore the collection
        </Link>
      </div>
    </section>
  );
}
