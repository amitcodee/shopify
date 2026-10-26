import type { ThemeStyleId } from '@repo/contracts';
import Link from 'next/link';

/** A photo the hero can feature, optionally linking somewhere (catalog tiles). */
export interface HeroImage {
  src: string;
  alt: string;
  /** Smaller copies (product photos with renditions); the template photos have none. */
  srcSet?: string;
}

export interface HeroTile {
  label: string;
  href: string;
  image: string | null;
  imageSrcSet?: string;
}

export interface HeroProps {
  style: ThemeStyleId;
  shopName: string;
  title: string;
  subtitle: string;
  cta: string;
  /** The lead photo (a product photo, or the template's photo while previewing). */
  image: HeroImage | null;
  /** Further photos for layouts that use more than one (classic, split, editorial). */
  extras: HeroImage[];
  /** Collection shortcuts beside the catalog banner. */
  tiles: HeroTile[];
}

function Cta({
  label,
  variant = '',
  className = 'mt-8',
}: {
  label: string;
  variant?: string;
  className?: string;
}) {
  return (
    <Link
      href="/collections/all"
      className={`btn ${variant} ${className} min-h-12 px-7 py-3 text-sm`}
    >
      {label}
      <span aria-hidden="true" className="text-base leading-none">
        →
      </span>
    </Link>
  );
}

/** Half the page from md up (two-column hero layouts). */
const HALF = '(min-width: 768px) 50vw, 100vw';

/** The lead photo, filling its (relative) box. */
function Photo({
  image,
  className = '',
  eager = true,
  sizes = '100vw',
}: {
  image: HeroImage;
  className?: string;
  eager?: boolean;
  /** How wide the box is at each breakpoint (used with the photo's `srcSet`). */
  sizes?: string;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={image.src}
      srcSet={image.srcSet}
      sizes={image.srcSet ? sizes : undefined}
      alt={image.alt}
      fetchPriority={eager ? 'high' : undefined}
      loading={eager ? undefined : 'lazy'}
      className={`absolute inset-0 h-full w-full object-cover ${className}`}
    />
  );
}

/** Decorative stand-in when the store has no photos yet. */
function Wash({ className = '' }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`absolute inset-0 bg-[radial-gradient(120%_90%_at_80%_10%,color-mix(in_oklab,var(--store-accent)_45%,transparent),transparent_60%),radial-gradient(90%_80%_at_10%_100%,color-mix(in_oklab,var(--store-brand)_30%,transparent),transparent_65%)] ${className}`}
    />
  );
}

/** Pulls a full-bleed section out of the page column and up against the header. */
const FULL_BLEED =
  'relative -mt-[var(--store-main-y)] ml-[calc(50%-50vw)] w-screen overflow-hidden';

/**
 * The homepage hero. Each design style has its own composition: photo-led for most, type-led for
 * editorial and bold, banner-and-tiles for catalog. Copy over photos sits on a gradient scrim.
 */
export function Hero(props: HeroProps) {
  const { style, title, subtitle, cta, image, extras, tiles, shopName } = props;

  switch (style) {
    case 'bold':
      return (
        <section className="store-section grid overflow-hidden rounded-2xl bg-brand text-brand-contrast md:grid-cols-[1.15fr_1fr]">
          <div className="relative flex flex-col justify-center px-6 py-12 sm:px-12 sm:py-16 lg:px-16 lg:py-24">
            <div aria-hidden="true" className="mb-8 h-2 w-20 rounded-full bg-accent" />
            <h1 className="t-display text-[2.75rem] break-words sm:text-6xl lg:text-[5.25rem]">
              {title}
            </h1>
            <p className="mt-6 max-w-md text-lg leading-relaxed opacity-85">{subtitle}</p>
            <div>
              <Cta label={cta} variant="btn-on-brand" />
            </div>
          </div>
          <div className="relative order-first aspect-[4/3] bg-accent md:order-none md:aspect-auto md:min-h-[34rem]">
            {image ? <Photo image={image} sizes={HALF} /> : <Wash />}
            <div
              aria-hidden="true"
              className="absolute inset-y-0 left-0 hidden w-24 bg-gradient-to-r from-[var(--store-brand)] to-transparent md:block"
            />
          </div>
        </section>
      );

    case 'classic': {
      const strip = image ? [image, ...extras.map((e) => ({ ...e, alt: '' }))].slice(0, 3) : [];
      return (
        <section className="store-section">
          <div className="mx-auto max-w-3xl px-2 pt-4 pb-10 text-center sm:pt-8 sm:pb-14">
            <p className="eyebrow text-zinc-500">{shopName}</p>
            <h1 className="t-display mt-5 text-4xl text-brand break-words sm:text-6xl">{title}</h1>
            <div aria-hidden="true" className="mx-auto mt-6 h-px w-16 bg-accent" />
            <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-zinc-600 sm:text-lg">
              {subtitle}
            </p>
            <Cta label={cta} />
          </div>
          {strip.length === 3 ? (
            <div className="grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-[1fr_1.6fr_1fr]">
              {strip.map((photo, i) => (
                <div
                  key={photo.src}
                  className={`relative overflow-hidden rounded-lg bg-surface ${
                    i === 1
                      ? 'col-span-2 aspect-[16/9] md:col-span-1 md:aspect-auto'
                      : 'aspect-[3/4]'
                  } ${i === 1 ? 'order-first md:order-none' : ''}`}
                >
                  <Photo
                    image={photo}
                    eager={i === 1}
                    sizes={
                      i === 1 ? '(min-width: 768px) 45vw, 100vw' : '(min-width: 768px) 28vw, 50vw'
                    }
                  />
                </div>
              ))}
            </div>
          ) : image ? (
            <div className="relative aspect-[16/10] overflow-hidden rounded-lg bg-surface sm:aspect-[21/9]">
              <Photo image={image} />
            </div>
          ) : null}
        </section>
      );
    }

    case 'split':
      return (
        <section className="store-section grid items-center gap-8 md:grid-cols-[1fr_1.1fr] md:gap-12 lg:gap-20">
          <div className="order-2 md:order-1">
            <p className="eyebrow text-accent">{shopName}</p>
            <h1 className="t-display mt-4 text-[2.5rem] text-brand break-words sm:text-6xl lg:text-[4.25rem]">
              {title}
            </h1>
            <p className="mt-6 max-w-md text-lg leading-relaxed text-zinc-600">{subtitle}</p>
            <Cta label={cta} />
          </div>
          <div className="relative order-1 md:order-2">
            <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-surface md:aspect-[4/5]">
              {image ? <Photo image={image} sizes={HALF} /> : <Wash className="opacity-60" />}
            </div>
            {extras[0] ? (
              <div className="absolute -bottom-6 -left-6 hidden aspect-square w-40 overflow-hidden rounded-xl border-[6px] border-[var(--store-bg)] bg-surface shadow-[0_24px_48px_-20px_rgb(0_0_0/0.35)] lg:block xl:w-48">
                <Photo image={{ ...extras[0], alt: '' }} eager={false} sizes="192px" />
              </div>
            ) : null}
          </div>
        </section>
      );

    case 'fullbleed':
      return (
        <section
          className={`store-section ${FULL_BLEED} ${
            image ? 'bg-[#111111] text-[#ffffff]' : 'bg-brand text-brand-contrast'
          }`}
        >
          {image ? (
            <>
              <Photo image={image} />
              <div className="absolute inset-0 bg-gradient-to-t from-[#000000cc] via-[#00000040] to-[#00000026]" />
            </>
          ) : (
            <Wash />
          )}
          <div className="store-container relative flex min-h-[34rem] flex-col justify-end py-14 sm:min-h-[44rem] sm:py-20">
            <h1
              className={`t-display max-w-5xl text-5xl break-words sm:text-7xl lg:text-[7rem] ${image ? 'on-photo' : ''}`}
            >
              {title}
            </h1>
            <div className="mt-8 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
              <p className="max-w-md text-lg leading-relaxed opacity-90">{subtitle}</p>
              <Cta
                label={cta}
                variant={image ? 'btn-on-image' : 'btn-on-brand'}
                className="self-start sm:self-auto"
              />
            </div>
          </div>
        </section>
      );

    case 'editorial': {
      const issue = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      return (
        <section className="store-section">
          <div className="eyebrow flex justify-between gap-4 border-y border-zinc-900 py-2.5 text-zinc-700">
            <span>{issue}</span>
            <span className="hidden sm:inline">{shopName}</span>
            <span>The edit</span>
          </div>
          <div className="mt-10 grid gap-10 sm:mt-14 md:grid-cols-12 md:gap-8">
            <div className="flex flex-col md:col-span-7">
              <h1 className="t-display text-5xl text-brand break-words sm:text-7xl lg:text-[6.5rem]">
                {title}
              </h1>
              <div className="mt-auto grid gap-6 pt-10 sm:grid-cols-[auto_1fr] sm:gap-8">
                <span
                  aria-hidden="true"
                  className="hidden h-px w-16 translate-y-3 bg-accent sm:block"
                />
                <div>
                  <p className="max-w-md font-heading text-xl leading-relaxed text-zinc-700 italic">
                    {subtitle}
                  </p>
                  <Cta label={cta} />
                </div>
              </div>
            </div>
            {image ? (
              <figure className="md:col-span-5">
                <div className="relative aspect-[5/6] overflow-hidden bg-surface">
                  <Photo image={image} sizes={HALF} />
                </div>
                <figcaption className="eyebrow mt-3 text-zinc-500">
                  {shopName} — this season
                </figcaption>
              </figure>
            ) : null}
          </div>
        </section>
      );
    }

    case 'catalog': {
      const sideTiles = tiles.slice(0, 2);
      return (
        <section
          className={`store-section grid gap-3 sm:gap-4 ${sideTiles.length > 0 ? 'lg:grid-cols-[2fr_1fr]' : ''}`}
        >
          <div
            className={`relative flex min-h-[20rem] overflow-hidden rounded-lg sm:min-h-[26rem] ${
              image ? 'bg-[#111111] text-[#ffffff]' : 'bg-surface text-ink'
            }`}
          >
            {image ? (
              <>
                <Photo image={image} />
                <div className="absolute inset-0 bg-gradient-to-r from-[#000000b3] via-[#00000059] to-transparent" />
              </>
            ) : (
              <Wash className="opacity-50" />
            )}
            <div className="relative flex max-w-lg flex-col justify-center p-6 sm:p-10">
              <h1
                className={`t-display text-3xl break-words sm:text-5xl ${image ? 'on-photo' : 'text-brand'}`}
              >
                {title}
              </h1>
              <p
                className={`mt-4 text-sm leading-relaxed sm:text-base ${image ? 'opacity-90' : 'text-zinc-600'}`}
              >
                {subtitle}
              </p>
              <div>
                <Cta label={cta} variant={image ? 'btn-on-image' : ''} className="mt-6" />
              </div>
            </div>
          </div>
          {sideTiles.length > 0 ? (
            <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-1">
              {sideTiles.map((tile) => (
                <Link
                  key={tile.href}
                  href={tile.href}
                  className="group relative flex min-h-[9rem] items-end overflow-hidden rounded-lg bg-surface sm:min-h-[12rem]"
                >
                  {tile.image ? (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={tile.image}
                        srcSet={tile.imageSrcSet}
                        sizes={tile.imageSrcSet ? '(min-width: 1024px) 33vw, 50vw' : undefined}
                        alt=""
                        className="media-zoom absolute inset-0 h-full w-full object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-[#000000b3] via-[#00000033] to-transparent" />
                    </>
                  ) : null}
                  <span
                    className={`relative flex w-full items-center justify-between gap-2 p-4 text-sm font-semibold ${
                      tile.image ? 'text-[#ffffff]' : 'text-ink'
                    }`}
                  >
                    <span className="min-w-0 break-words">{tile.label}</span>
                    <span aria-hidden="true" className="transition group-hover:translate-x-1">
                      →
                    </span>
                  </span>
                </Link>
              ))}
            </div>
          ) : null}
        </section>
      );
    }

    case 'banner':
      return (
        <section className="store-section relative overflow-hidden rounded-3xl bg-[linear-gradient(135deg,var(--store-banner-from),var(--store-banner-to))] text-[var(--store-banner-text)]">
          <div
            aria-hidden="true"
            className="absolute -top-24 -right-24 size-80 rounded-full bg-[var(--store-banner-text)] opacity-[0.07]"
          />
          <div className="relative grid items-center gap-8 p-6 sm:p-10 md:grid-cols-2 lg:gap-14 lg:p-14">
            <div className="text-center md:text-left">
              <h1 className="t-display text-4xl break-words sm:text-6xl">{title}</h1>
              <p className="mx-auto mt-5 max-w-md text-lg leading-relaxed opacity-90 md:mx-0">
                {subtitle}
              </p>
              <Cta label={cta} variant="btn-on-banner" />
            </div>
            {image ? (
              <div className="relative aspect-[4/3] overflow-hidden rounded-2xl shadow-[0_30px_60px_-24px_rgb(0_0_0/0.5)] ring-1 ring-[#ffffff33] md:rotate-[1.5deg]">
                <Photo image={image} sizes={HALF} />
              </div>
            ) : null}
          </div>
        </section>
      );

    case 'noir':
      return (
        <section className={`store-section ${FULL_BLEED} bg-[#050506] text-[#f4f4f5]`}>
          {image ? (
            <>
              <Photo image={image} className="opacity-70" />
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,#00000033,#000000cc_75%)]" />
            </>
          ) : (
            <Wash className="opacity-40" />
          )}
          <div className="store-container relative flex min-h-[32rem] flex-col items-center justify-center py-20 text-center sm:min-h-[40rem]">
            <p className="eyebrow text-[#f4f4f5cc]">{shopName}</p>
            <h1 className="t-display on-photo mt-6 max-w-4xl text-4xl break-words sm:text-6xl lg:text-7xl">
              {title}
            </h1>
            <div aria-hidden="true" className="mt-8 h-px w-16 bg-accent" />
            <p className="mt-8 max-w-md text-base leading-relaxed text-[#f4f4f5d9] sm:text-lg">
              {subtitle}
            </p>
            <Cta label={cta} variant="btn-on-image" className="mt-10" />
          </div>
        </section>
      );

    default:
      // Minimal: one large photo with the headline set into its lower corner.
      return image ? (
        <section className="store-section relative flex min-h-[30rem] overflow-hidden rounded-2xl bg-[#111111] text-[#ffffff] sm:min-h-[36rem] lg:min-h-[40rem]">
          <Photo image={image} />
          <div className="absolute inset-0 bg-gradient-to-tr from-[#000000b3] via-[#00000033] to-transparent" />
          <div className="relative mt-auto max-w-2xl p-6 sm:p-12 lg:p-16">
            <h1 className="t-display on-photo text-[2.75rem] break-words sm:text-6xl lg:text-7xl">
              {title}
            </h1>
            <p className="mt-5 max-w-md text-lg leading-relaxed opacity-90">{subtitle}</p>
            <Cta label={cta} variant="btn-on-image" />
          </div>
        </section>
      ) : (
        <section className="store-section relative overflow-hidden rounded-2xl bg-surface px-6 py-16 sm:px-12 sm:py-24">
          <Wash className="opacity-40" />
          <div className="relative">
            <h1 className="t-display max-w-3xl text-5xl text-brand break-words sm:text-7xl">
              {title}
            </h1>
            <p className="mt-6 max-w-xl text-lg text-zinc-600">{subtitle}</p>
            <Cta label={cta} />
          </div>
        </section>
      );
  }
}
