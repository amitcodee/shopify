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

    case 'bento': {
      const side = tiles.slice(0, 2);
      return (
        <section
          className={`store-section grid gap-3 sm:gap-4 ${side.length === 2 ? 'lg:grid-cols-[1.65fr_1fr]' : ''}`}
        >
          <div className="grid overflow-hidden rounded-[2rem] bg-[color-mix(in_oklab,var(--store-accent)_14%,var(--store-bg))] md:grid-cols-[1.05fr_1fr]">
            <div className="flex flex-col justify-center p-7 sm:p-10 lg:p-12">
              <p className="eyebrow text-accent">{shopName}</p>
              <h1 className="t-display mt-4 text-4xl text-brand break-words sm:text-5xl lg:text-6xl">
                {title}
              </h1>
              <p className="mt-5 max-w-sm text-base leading-relaxed text-zinc-600 sm:text-lg">
                {subtitle}
              </p>
              <div>
                <Cta label={cta} />
              </div>
            </div>
            <div className="relative order-first m-3 aspect-[4/3] overflow-hidden rounded-[1.5rem] bg-surface md:order-none md:aspect-auto md:min-h-[26rem]">
              {image ? <Photo image={image} sizes={HALF} /> : <Wash />}
            </div>
          </div>
          {side.length === 2 ? (
            <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-1">
              {side.map((tile, i) => (
                <Link
                  key={tile.href}
                  href={tile.href}
                  className={`group relative flex min-h-[10rem] overflow-hidden rounded-[2rem] p-5 sm:min-h-[12rem] sm:p-7 ${
                    i === 0
                      ? 'bg-[color-mix(in_oklab,var(--store-brand)_10%,var(--store-bg))]'
                      : 'bg-surface'
                  }`}
                >
                  {tile.image ? (
                    <span className="absolute inset-y-3 right-3 hidden w-[44%] overflow-hidden rounded-[1.4rem] bg-[var(--store-bg)] sm:block">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={tile.image}
                        srcSet={tile.imageSrcSet}
                        sizes={tile.imageSrcSet ? '(min-width: 1024px) 15vw, 25vw' : undefined}
                        alt=""
                        className="media-zoom absolute inset-0 h-full w-full object-cover"
                      />
                    </span>
                  ) : null}
                  <span className="relative flex flex-col justify-between sm:max-w-[52%]">
                    <span>
                      <span className="eyebrow text-zinc-500">Collection</span>
                      <span className="t-title mt-2 block text-xl text-brand break-words sm:text-2xl">
                        {tile.label}
                      </span>
                    </span>
                    <span
                      aria-hidden="true"
                      className="mt-5 grid size-10 place-items-center rounded-full bg-[var(--store-bg)] text-ink shadow-sm transition group-hover:translate-x-1"
                    >
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

    case 'market': {
      const side = tiles.slice(0, 2);
      const tall = extras[0];
      return (
        <section className="store-section grid gap-3 md:grid-cols-2 lg:grid-cols-[1.6fr_1fr_0.85fr]">
          <div className="relative flex min-h-[22rem] overflow-hidden rounded-lg bg-brand text-brand-contrast md:col-span-2 lg:col-span-1 lg:row-span-2 lg:min-h-[32rem]">
            {image ? (
              <>
                <Photo image={image} className="left-[35%] w-[65%]" sizes={HALF} />
                <div className="absolute inset-0 bg-gradient-to-r from-[var(--store-brand)] from-35% via-[color-mix(in_oklab,var(--store-brand)_55%,transparent)] via-55% to-transparent" />
              </>
            ) : (
              <Wash />
            )}
            <div className="relative flex max-w-md flex-col justify-center p-6 sm:p-10">
              <span className="inline-flex w-fit rounded-sm bg-accent px-2.5 py-1 text-xs font-bold tracking-wide text-accent-contrast uppercase">
                {shopName}
              </span>
              <h1 className="t-display mt-5 text-4xl break-words sm:text-5xl lg:text-6xl">
                {title}
              </h1>
              <p className="mt-4 max-w-sm text-base leading-relaxed opacity-90">{subtitle}</p>
              <div>
                <Cta label={cta} variant="btn-on-brand" className="mt-7" />
              </div>
            </div>
          </div>
          {side.map((tile, i) => (
            <Link
              key={tile.href}
              href={tile.href}
              className={`group relative flex min-h-[11rem] overflow-hidden rounded-lg p-5 lg:col-start-2 ${
                i === 0 ? 'bg-accent text-accent-contrast' : 'bg-ink text-[var(--store-bg)]'
              }`}
            >
              {tile.image ? (
                <span className="absolute right-0 bottom-0 h-[78%] w-[52%] overflow-hidden rounded-tl-lg">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={tile.image}
                    srcSet={tile.imageSrcSet}
                    sizes={tile.imageSrcSet ? '(min-width: 1024px) 14vw, 25vw' : undefined}
                    alt=""
                    className="media-zoom absolute inset-0 h-full w-full object-cover"
                  />
                </span>
              ) : null}
              <span className="relative max-w-[48%]">
                <span className="t-title block text-xl break-words">{tile.label}</span>
                <span className="mt-2 inline-flex items-center gap-1 text-xs font-semibold underline underline-offset-4">
                  Shop now
                </span>
              </span>
            </Link>
          ))}
          {tall ? (
            <Link
              href="/collections/all"
              className="group relative hidden min-h-[22rem] overflow-hidden rounded-lg bg-surface lg:col-start-3 lg:row-span-2 lg:row-start-1 lg:flex"
            >
              <Photo
                image={{ ...tall, alt: '' }}
                eager={false}
                sizes="22vw"
                className="media-zoom"
              />
              <span className="relative mt-auto m-3 flex w-[calc(100%-1.5rem)] items-center justify-between rounded-md bg-[var(--store-bg)] px-4 py-3 text-sm font-semibold text-ink">
                Shop everything
                <span aria-hidden="true" className="transition group-hover:translate-x-1">
                  →
                </span>
              </span>
            </Link>
          ) : null}
        </section>
      );
    }

    case 'fresh': {
      const cards = tiles.slice(0, 4);
      return (
        <section className="store-section">
          <div className="relative overflow-hidden rounded-[2rem] bg-brand text-brand-contrast [clip-path:ellipse(150%_100%_at_50%_0%)]">
            <div
              aria-hidden="true"
              className="absolute inset-0 bg-[radial-gradient(currentColor_1px,transparent_1.5px)] [background-size:22px_22px] opacity-[0.08]"
            />
            <div
              className={`relative grid items-center gap-10 px-6 pt-10 sm:px-12 sm:pt-14 md:grid-cols-[1.1fr_1fr] lg:px-16 ${
                cards.length > 0 ? 'pb-24 sm:pb-28' : 'pb-16 sm:pb-20'
              }`}
            >
              <div>
                <h1 className="t-display text-[2.6rem] break-words sm:text-6xl lg:text-[4.5rem]">
                  {title}
                </h1>
                <p className="mt-5 max-w-md text-lg leading-relaxed opacity-85">{subtitle}</p>
                <Cta label={cta} variant="btn-accent" />
              </div>
              {image ? (
                <div className="relative mx-auto w-full max-w-[24rem] md:max-w-[26rem]">
                  <div
                    aria-hidden="true"
                    className="absolute -inset-[5%] rounded-full border-2 border-dashed border-current opacity-25"
                  />
                  <div className="relative aspect-square overflow-hidden rounded-full bg-accent shadow-[0_30px_60px_-24px_rgb(0_0_0/0.55)]">
                    <Photo image={image} sizes="(min-width: 768px) 26rem, 90vw" />
                  </div>
                </div>
              ) : null}
            </div>
          </div>
          {cards.length > 0 ? (
            <ul className="relative z-10 -mt-14 grid grid-cols-2 gap-3 px-3 sm:px-8 md:grid-cols-4 lg:px-12">
              {cards.map((tile) => (
                <li key={tile.href}>
                  <Link
                    href={tile.href}
                    className="group flex h-full items-center justify-between gap-3 rounded-2xl bg-[var(--store-bg)] p-3 shadow-[0_18px_40px_-22px_rgb(0_0_0/0.4)] ring-1 ring-[color-mix(in_oklab,var(--store-text)_8%,transparent)] sm:p-4"
                  >
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold break-words text-ink sm:text-base">
                        {tile.label}
                      </span>
                      <span className="mt-0.5 block text-xs text-zinc-500">Shop now →</span>
                    </span>
                    {tile.image ? (
                      <span className="relative size-12 shrink-0 overflow-hidden rounded-xl bg-surface sm:size-14">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={tile.image}
                          srcSet={tile.imageSrcSet}
                          sizes={tile.imageSrcSet ? '56px' : undefined}
                          alt=""
                          className="media-zoom absolute inset-0 h-full w-full object-cover"
                        />
                      </span>
                    ) : null}
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      );
    }

    case 'poster': {
      const strip = image ? [image, ...extras.map((e) => ({ ...e, alt: '' }))].slice(0, 3) : [];
      return (
        <section className="store-section">
          <h1 className="t-display text-[clamp(3rem,11vw,9.5rem)] leading-[0.86] text-brand break-words">
            {title}
          </h1>
          <div className="mt-7 flex flex-col gap-5 border-t-4 border-accent pt-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="max-w-lg text-lg leading-relaxed text-zinc-600">{subtitle}</p>
            <Cta label={cta} className="self-start sm:self-auto" />
          </div>
          {strip.length > 0 ? (
            <div
              className={`mt-8 grid gap-2 sm:gap-3 ${strip.length === 3 ? 'grid-cols-[1fr_1.5fr_1fr]' : ''}`}
            >
              {strip.map((photo, i) => (
                <div
                  key={photo.src}
                  className={`relative overflow-hidden bg-surface ${
                    strip.length === 3 ? 'aspect-[3/4] sm:aspect-[4/5]' : 'aspect-[21/9]'
                  } ${i === 1 && strip.length === 3 ? 'aspect-auto sm:aspect-auto' : ''}`}
                >
                  <Photo
                    image={photo}
                    eager={i === 0}
                    sizes={strip.length === 3 ? '(min-width: 640px) 40vw, 33vw' : '100vw'}
                  />
                </div>
              ))}
            </div>
          ) : null}
        </section>
      );
    }

    case 'luxe': {
      const chips = tiles.slice(0, 6);
      return (
        <section className="store-section">
          <div className="relative flex min-h-[28rem] overflow-hidden rounded-md bg-surface sm:min-h-[36rem]">
            {image ? <Photo image={image} /> : <Wash className="opacity-50" />}
            <div className="absolute inset-0 bg-[linear-gradient(to_right,var(--store-bg)_0%,color-mix(in_oklab,var(--store-bg)_80%,transparent)_40%,transparent_75%)]" />
            <div className="absolute inset-0 bg-[color-mix(in_oklab,var(--store-bg)_40%,transparent)] md:hidden" />
            <div className="relative flex max-w-xl flex-col justify-center px-6 py-12 sm:px-12 lg:px-16">
              <p className="eyebrow text-zinc-600">{shopName}</p>
              <h1 className="t-display mt-5 text-[2.6rem] text-brand break-words sm:text-6xl">
                {title}
              </h1>
              <p className="mt-5 max-w-md text-base leading-relaxed text-zinc-700 sm:text-lg">
                {subtitle}
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-4">
                <Cta label={cta} className="" />
                <Link
                  href="/collections"
                  className="text-sm font-semibold text-ink underline underline-offset-4"
                >
                  Browse collections
                </Link>
              </div>
            </div>
          </div>
          {chips.length >= 2 ? (
            <ul className="mt-8 flex gap-6 overflow-x-auto pb-2 sm:justify-center sm:gap-10">
              {chips.map((tile) => (
                <li key={tile.href} className="shrink-0">
                  <Link
                    href={tile.href}
                    className="group flex w-24 flex-col items-center gap-3 text-center"
                  >
                    <span className="relative block size-20 overflow-hidden rounded-full bg-surface ring-1 ring-[color-mix(in_oklab,var(--store-text)_10%,transparent)]">
                      {tile.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={tile.image}
                          srcSet={tile.imageSrcSet}
                          sizes={tile.imageSrcSet ? '80px' : undefined}
                          alt=""
                          className="media-zoom absolute inset-0 h-full w-full object-cover"
                        />
                      ) : null}
                    </span>
                    <span className="text-sm font-medium break-words text-ink">{tile.label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      );
    }

    case 'rail': {
      const rail = tiles.slice(0, 6);
      const offers = extras.slice(0, 3);
      return (
        <section
          className={`store-section grid gap-3 ${rail.length > 0 ? 'lg:grid-cols-[15rem_minmax(0,1fr)]' : ''}`}
        >
          {rail.length > 0 ? (
            <nav
              aria-label="Shop by collection"
              className="rounded-md border border-[color-mix(in_oklab,var(--store-text)_12%,transparent)]"
            >
              <p className="hidden bg-brand px-4 py-3 text-sm font-semibold text-brand-contrast lg:block lg:rounded-t-md">
                Shop by collection
              </p>
              <ul className="flex gap-1 overflow-x-auto p-2 lg:block lg:space-y-0.5 lg:overflow-visible">
                {rail.map((tile) => (
                  <li key={tile.href} className="shrink-0">
                    <Link
                      href={tile.href}
                      className="flex items-center justify-between gap-3 rounded-sm px-3 py-2.5 text-sm font-medium text-ink hover:bg-surface"
                    >
                      <span className="break-words">{tile.label}</span>
                      <span aria-hidden="true" className="hidden text-zinc-500 lg:inline">
                        →
                      </span>
                    </Link>
                  </li>
                ))}
                <li className="shrink-0">
                  <Link
                    href="/collections/all"
                    className="block rounded-sm px-3 py-2.5 text-sm font-semibold text-ink underline underline-offset-4"
                  >
                    All products
                  </Link>
                </li>
              </ul>
            </nav>
          ) : null}
          <div className="min-w-0 space-y-3">
            <div
              className={`relative flex min-h-[20rem] overflow-hidden rounded-md sm:min-h-[24rem] ${
                image ? 'bg-[#111111] text-[#ffffff]' : 'bg-surface text-ink'
              }`}
            >
              {image ? (
                <>
                  <Photo image={image} />
                  <div className="absolute inset-0 bg-gradient-to-r from-[#000000b8] via-[#00000059] to-transparent" />
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
            {offers.length === 3 ? (
              <div className="hidden grid-cols-3 gap-3 sm:grid">
                {offers.map((photo) => (
                  <Link
                    key={photo.src}
                    href="/collections/all"
                    className="relative block aspect-[16/9] overflow-hidden rounded-md bg-surface"
                  >
                    <Photo
                      image={{ ...photo, alt: '' }}
                      eager={false}
                      sizes="(min-width: 1024px) 24vw, 33vw"
                      className="media-zoom"
                    />
                    <span className="sr-only">Shop all products</span>
                  </Link>
                ))}
              </div>
            ) : null}
          </div>
        </section>
      );
    }

    case 'mosaic': {
      const blocks = tiles.slice(0, 2);
      const [first, second, third] = extras;
      return (
        <section className="store-section grid grid-cols-2 md:grid-cols-4 md:grid-rows-[repeat(2,minmax(16rem,auto))]">
          <div className="col-span-2 flex flex-col justify-center bg-brand p-7 text-brand-contrast sm:p-10">
            <h1 className="t-display text-4xl break-words sm:text-5xl lg:text-6xl">{title}</h1>
            <p className="mt-5 max-w-sm text-base leading-relaxed opacity-90">{subtitle}</p>
            <div>
              <Cta label={cta} variant="btn-on-brand" className="mt-7" />
            </div>
          </div>
          <div className="relative col-span-2 min-h-[16rem] bg-surface">
            {image ? <Photo image={image} sizes={HALF} /> : <Wash />}
          </div>
          {first ? (
            <div className="relative min-h-[12rem] bg-surface">
              <Photo
                image={{ ...first, alt: '' }}
                eager={false}
                sizes="(min-width: 768px) 25vw, 50vw"
              />
            </div>
          ) : null}
          {blocks[0] ? (
            <Link
              href={blocks[0].href}
              className="group flex min-h-[12rem] flex-col justify-between bg-accent p-5 text-accent-contrast sm:p-7"
            >
              <span className="t-title text-2xl break-words">{blocks[0].label}</span>
              <span aria-hidden="true" className="text-2xl transition group-hover:translate-x-1">
                →
              </span>
            </Link>
          ) : null}
          {second ? (
            <div className="relative min-h-[12rem] bg-surface">
              <Photo
                image={{ ...second, alt: '' }}
                eager={false}
                sizes="(min-width: 768px) 25vw, 50vw"
              />
            </div>
          ) : null}
          {blocks[1] ? (
            <Link
              href={blocks[1].href}
              className="group flex min-h-[12rem] flex-col justify-between bg-ink p-5 text-[var(--store-bg)] sm:p-7"
            >
              <span className="t-title text-2xl break-words">{blocks[1].label}</span>
              <span aria-hidden="true" className="text-2xl transition group-hover:translate-x-1">
                →
              </span>
            </Link>
          ) : third ? (
            <div className="relative min-h-[12rem] bg-surface">
              <Photo
                image={{ ...third, alt: '' }}
                eager={false}
                sizes="(min-width: 768px) 25vw, 50vw"
              />
            </div>
          ) : null}
        </section>
      );
    }

    case 'showroom': {
      const pieces = extras.slice(0, 2);
      return (
        <section className="store-section rounded-md bg-surface p-6 sm:p-10 lg:p-14">
          <div className="grid items-end gap-8 md:grid-cols-[1fr_1.35fr] lg:gap-14">
            <div className="pb-2">
              <p className="eyebrow text-zinc-500">{shopName}</p>
              <h1 className="t-display mt-4 text-4xl text-brand break-words sm:text-5xl lg:text-6xl">
                {title}
              </h1>
              <p className="mt-5 max-w-sm text-base leading-relaxed text-zinc-600">{subtitle}</p>
              <Cta label={cta} className="mt-7" />
            </div>
            <figure>
              <div className="relative aspect-[4/3] overflow-hidden rounded-sm bg-[var(--store-bg)]">
                {image ? <Photo image={image} sizes={HALF} /> : <Wash className="opacity-50" />}
              </div>
              {image?.alt ? (
                <figcaption className="mt-2.5 text-xs text-zinc-500">{image.alt}</figcaption>
              ) : null}
            </figure>
          </div>
          {pieces.length === 2 ? (
            <div className="mt-8 hidden grid-cols-[1fr_1fr_1.2fr] items-start gap-6 md:grid lg:gap-10">
              {pieces.map((photo) => (
                <figure key={photo.src}>
                  <div className="relative aspect-square overflow-hidden rounded-sm bg-[var(--store-bg)]">
                    <Photo image={photo} eager={false} sizes="25vw" />
                  </div>
                  {photo.alt ? (
                    <figcaption className="mt-2.5 text-xs text-zinc-500">{photo.alt}</figcaption>
                  ) : null}
                </figure>
              ))}
              <ul className="space-y-0 self-end border-t border-[color-mix(in_oklab,var(--store-text)_18%,transparent)]">
                {tiles.slice(0, 3).map((tile) => (
                  <li
                    key={tile.href}
                    className="border-b border-[color-mix(in_oklab,var(--store-text)_18%,transparent)]"
                  >
                    <Link
                      href={tile.href}
                      className="flex items-center justify-between gap-3 py-3 text-sm font-medium text-ink"
                    >
                      <span className="break-words">{tile.label}</span>
                      <span aria-hidden="true">→</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      );
    }

    case 'arch': {
      const steps = image ? [extras[0], image, extras[1]] : [];
      return (
        <section className="store-section overflow-hidden rounded-[2rem] bg-surface">
          <div className="grid items-end gap-8 px-6 pt-10 sm:px-12 sm:pt-14 md:grid-cols-[1fr_1.25fr] lg:px-16">
            <div className="pb-4 sm:pb-14">
              <p className="eyebrow text-accent">{shopName}</p>
              <h1 className="t-display mt-4 text-[2.6rem] text-brand break-words sm:text-6xl">
                {title}
              </h1>
              <p className="mt-5 max-w-md text-lg leading-relaxed text-zinc-700">{subtitle}</p>
              <Cta label={cta} />
            </div>
            <div className="grid grid-cols-3 items-end gap-2 sm:gap-3">
              {steps.map((photo, i) =>
                photo ? (
                  <div
                    key={photo.src}
                    className={`relative overflow-hidden rounded-t-full bg-[var(--store-bg)] ${
                      i === 1 ? 'aspect-[3/5.4]' : i === 0 ? 'aspect-[3/4]' : 'aspect-[3/4.6]'
                    }`}
                  >
                    <Photo
                      image={i === 1 ? photo : { ...photo, alt: '' }}
                      eager={i === 1}
                      sizes="(min-width: 768px) 18vw, 30vw"
                    />
                  </div>
                ) : (
                  <span key={i} />
                ),
              )}
            </div>
          </div>
        </section>
      );
    }

    case 'spotlight': {
      const chips = tiles.slice(0, 3);
      return (
        <section className={`store-section ${FULL_BLEED} text-center`}>
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-[radial-gradient(46rem_30rem_at_50%_62%,color-mix(in_oklab,var(--store-accent)_42%,transparent),transparent_70%)]"
          />
          <div className="store-container relative pt-14 pb-14 sm:pt-20 sm:pb-20">
            <p className="eyebrow text-zinc-500">{shopName}</p>
            <h1 className="t-display mx-auto mt-4 max-w-5xl text-5xl text-brand break-words sm:text-7xl lg:text-[6rem]">
              {title}
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-zinc-600">
              {subtitle}
            </p>
            <Cta label={cta} variant="btn-accent" />
            {image ? (
              <div className="relative mx-auto mt-12 aspect-[16/10] max-w-3xl overflow-hidden rounded-[2rem] bg-surface shadow-[0_50px_120px_-30px_color-mix(in_oklab,var(--store-accent)_60%,transparent)] ring-1 ring-[color-mix(in_oklab,var(--store-text)_14%,transparent)]">
                <Photo image={image} sizes="(min-width: 768px) 48rem, 100vw" />
              </div>
            ) : null}
            {chips.length > 0 ? (
              <ul className="mt-8 flex flex-wrap justify-center gap-2">
                {chips.map((tile) => (
                  <li key={tile.href}>
                    <Link
                      href={tile.href}
                      className="block rounded-full bg-surface px-4 py-2 text-sm font-medium text-ink ring-1 ring-[color-mix(in_oklab,var(--store-text)_14%,transparent)]"
                    >
                      {tile.label}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </section>
      );
    }

    case 'duo':
      return (
        <section className={`store-section ${FULL_BLEED} grid md:grid-cols-2`}>
          <div className="relative min-h-[22rem] bg-surface md:min-h-[42rem]">
            {image ? <Photo image={image} sizes={HALF} /> : <Wash />}
          </div>
          <div className="relative flex flex-col justify-center bg-surface px-6 py-14 sm:px-14 lg:px-20">
            <p className="eyebrow text-zinc-500">{shopName}</p>
            <h1 className="t-display mt-5 max-w-lg text-[2.75rem] text-brand break-words sm:text-6xl">
              {title}
            </h1>
            <p className="mt-6 max-w-md text-lg leading-relaxed text-zinc-700">{subtitle}</p>
            <div>
              <Cta label={cta} />
            </div>
            {extras[0] ? (
              <div className="relative mt-10 hidden aspect-[16/9] max-w-sm overflow-hidden bg-[var(--store-bg)] lg:block">
                <Photo image={{ ...extras[0], alt: '' }} eager={false} sizes="24rem" />
              </div>
            ) : null}
          </div>
        </section>
      );

    case 'lookbook': {
      const looks = image ? [image, ...extras].slice(0, 4) : [];
      return (
        <section className="store-section">
          <div className="grid gap-6 md:grid-cols-[1.4fr_1fr] md:items-end">
            <h1 className="t-display text-5xl text-brand break-words sm:text-7xl">{title}</h1>
            <div>
              <p className="max-w-md text-lg leading-relaxed text-zinc-600">{subtitle}</p>
              <Cta label={cta} className="mt-6" />
            </div>
          </div>
          {looks.length > 0 ? (
            <div className="mt-10 flex snap-x gap-3 overflow-x-auto pb-2 sm:gap-5 md:grid md:grid-cols-4 md:overflow-visible md:pb-14">
              {looks.map((photo, i) => (
                <figure
                  key={photo.src}
                  className={`w-[68%] shrink-0 snap-start md:w-auto ${i % 2 === 1 ? 'md:translate-y-14' : ''}`}
                >
                  <div className="relative aspect-[3/4] overflow-hidden bg-surface">
                    <Photo image={photo} eager={i === 0} sizes="(min-width: 768px) 25vw, 68vw" />
                  </div>
                  <figcaption className="eyebrow mt-2.5 text-zinc-500">
                    Look {String(i + 1).padStart(2, '0')}
                  </figcaption>
                </figure>
              ))}
            </div>
          ) : null}
        </section>
      );
    }

    case 'ticker': {
      const phrase = `${title} — `;
      return (
        <section className="store-section">
          <div className={`${FULL_BLEED} bg-accent py-3 text-accent-contrast`}>
            <div aria-hidden="true" className="store-ticker flex w-max whitespace-nowrap">
              {[0, 1].map((group) => (
                <span key={group} className="t-title px-1 text-2xl sm:text-4xl">
                  {phrase.repeat(8)}
                </span>
              ))}
            </div>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-[1.5fr_1fr]">
            <div className="relative min-h-[20rem] overflow-hidden rounded-sm bg-surface md:min-h-[32rem]">
              {image ? <Photo image={image} /> : <Wash />}
            </div>
            <div className="flex flex-col justify-between rounded-sm bg-brand p-7 text-brand-contrast sm:p-10">
              <h1 className="t-display text-5xl break-words sm:text-6xl lg:text-7xl">{title}</h1>
              <div className="mt-8">
                <p className="max-w-sm text-base leading-relaxed opacity-90">{subtitle}</p>
                <Cta label={cta} variant="btn-on-brand" className="mt-6" />
              </div>
            </div>
          </div>
        </section>
      );
    }

    case 'pop': {
      const cards = image ? [extras[0], image, extras[1]] : [];
      return (
        <section className="store-section relative overflow-hidden rounded-[2.5rem] bg-[color-mix(in_oklab,var(--store-accent)_22%,var(--store-bg))] px-6 py-12 sm:px-12 sm:py-16">
          <div className="grid items-center gap-10 md:grid-cols-[1fr_1.15fr]">
            <div>
              <h1 className="t-display text-5xl text-brand break-words sm:text-6xl lg:text-7xl">
                {title}
              </h1>
              <p className="mt-5 max-w-md text-lg leading-relaxed text-zinc-700">{subtitle}</p>
              <Cta label={cta} />
            </div>
            <div className="relative mx-auto grid w-full max-w-xl grid-cols-3 items-center">
              {cards.map((photo, i) =>
                photo ? (
                  <div
                    key={photo.src}
                    className={`relative aspect-[3/4] overflow-hidden rounded-3xl bg-surface shadow-[0_24px_50px_-20px_rgb(0_0_0/0.45)] ring-4 ring-[var(--store-bg)] ${
                      i === 0
                        ? 'z-0 translate-x-3 -rotate-6'
                        : i === 1
                          ? 'z-10 scale-110'
                          : 'z-0 -translate-x-3 rotate-6'
                    }`}
                  >
                    <Photo
                      image={i === 1 ? photo : { ...photo, alt: '' }}
                      eager={i === 1}
                      sizes="(min-width: 768px) 16rem, 33vw"
                    />
                  </div>
                ) : (
                  <span key={i} />
                ),
              )}
              <span className="absolute -top-5 right-2 z-20 grid size-20 rotate-12 place-items-center rounded-full bg-accent text-center text-sm leading-tight font-bold text-accent-contrast sm:size-24">
                New
                <br />
                in
              </span>
            </div>
          </div>
        </section>
      );
    }

    case 'swiss': {
      const index = tiles.slice(0, 4);
      return (
        <section className="store-section border-t-2 border-ink">
          <div className="grid gap-6 py-6 md:grid-cols-12">
            <p className="eyebrow text-zinc-600 md:col-span-3">{shopName}</p>
            <h1 className="t-display text-5xl text-brand break-words sm:text-7xl md:col-span-9 lg:text-[6.5rem]">
              {title}
            </h1>
          </div>
          <div className="grid gap-6 border-t border-[color-mix(in_oklab,var(--store-text)_22%,transparent)] pt-6 md:grid-cols-12">
            <div className="md:col-span-3">
              <p className="text-sm leading-relaxed text-zinc-600">{subtitle}</p>
              <Cta label={cta} className="mt-5" />
              {index.length > 0 ? (
                <ol className="mt-8 border-t border-[color-mix(in_oklab,var(--store-text)_22%,transparent)]">
                  {index.map((tile, i) => (
                    <li
                      key={tile.href}
                      className="border-b border-[color-mix(in_oklab,var(--store-text)_22%,transparent)]"
                    >
                      <Link
                        href={tile.href}
                        className="flex gap-3 py-2.5 text-sm font-medium text-ink hover:underline"
                      >
                        <span className="text-zinc-500 tabular-nums">
                          {String(i + 1).padStart(2, '0')}
                        </span>
                        <span className="min-w-0 break-words">{tile.label}</span>
                      </Link>
                    </li>
                  ))}
                </ol>
              ) : null}
            </div>
            <div className="relative aspect-[16/9] bg-surface md:col-span-9">
              {image ? <Photo image={image} sizes="75vw" /> : <Wash className="opacity-40" />}
            </div>
          </div>
        </section>
      );
    }

    case 'atelier': {
      // Couture lookbook: an oversized serif headline (last word in italics), a layered collage
      // of up to three photos and a numbered index of the store's collections.
      const year = new Date().getFullYear();
      const words = title.trim().split(/\s+/);
      const lead = words.length > 1 ? `${words.slice(0, -1).join(' ')} ` : '';
      const last = words[words.length - 1] ?? title;
      const [front, back] = extras;
      const index = tiles.slice(0, 4);
      return (
        <section className="store-section">
          <div className="eyebrow flex items-center gap-4 text-zinc-600">
            <span>Collection {year}</span>
            <span
              aria-hidden="true"
              className="h-px flex-1 bg-[color-mix(in_oklab,var(--store-text)_25%,transparent)]"
            />
            <span className="hidden sm:inline">{shopName}</span>
            <span
              aria-hidden="true"
              className="hidden h-px w-10 bg-[color-mix(in_oklab,var(--store-text)_25%,transparent)] sm:block"
            />
            <span>Lookbook</span>
          </div>
          <div className="mt-8 grid gap-12 sm:mt-12 md:grid-cols-12 md:items-center md:gap-8 lg:gap-12">
            <div className="md:col-span-7 motion-safe:transition motion-safe:duration-1000 motion-safe:ease-out motion-safe:starting:translate-y-4 motion-safe:starting:opacity-0">
              <h1 className="t-display text-[clamp(3rem,10.5vw,8.75rem)] leading-[0.9] text-brand break-words">
                {lead}
                <em className="font-normal italic">{last}</em>
              </h1>
              <div className="mt-8 grid gap-6 sm:mt-10 sm:grid-cols-[auto_1fr] sm:gap-8">
                <span
                  aria-hidden="true"
                  className="hidden h-px w-14 translate-y-3 bg-accent sm:block"
                />
                <div>
                  <p className="max-w-md font-heading text-lg leading-relaxed text-zinc-700 italic sm:text-xl">
                    {subtitle}
                  </p>
                  <div className="mt-8 flex flex-wrap items-center gap-x-7 gap-y-4">
                    <Cta label={cta} className="" />
                    <Link
                      href="/collections"
                      className="eyebrow text-ink underline decoration-[color-mix(in_oklab,var(--store-text)_35%,transparent)] underline-offset-[6px] hover:decoration-current focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--store-text)]"
                    >
                      The collections
                    </Link>
                  </div>
                </div>
              </div>
            </div>
            <div className="relative mx-auto w-full max-w-md pb-14 pl-8 sm:pb-20 sm:pl-14 md:col-span-5 md:max-w-none">
              {back ? (
                <div className="absolute -top-8 right-0 hidden aspect-square w-[38%] overflow-hidden bg-surface sm:block">
                  <Photo
                    image={{ ...back, alt: '' }}
                    eager={false}
                    sizes="(min-width: 768px) 14vw, 30vw"
                  />
                </div>
              ) : null}
              <div className="relative z-10 aspect-[4/5] overflow-hidden bg-surface sm:mr-[14%] motion-safe:transition-[scale,opacity] motion-safe:duration-[1400ms] motion-safe:ease-out motion-safe:starting:scale-[1.03] motion-safe:starting:opacity-0">
                {image ? (
                  <Photo image={image} sizes="(min-width: 768px) 38vw, 90vw" />
                ) : (
                  <Wash className="opacity-60" />
                )}
              </div>
              {front ? (
                <div className="absolute bottom-0 left-0 z-20 aspect-[3/4] w-[44%] overflow-hidden border-[6px] border-[var(--store-bg)] bg-surface shadow-[0_30px_60px_-28px_rgb(0_0_0/0.45)] sm:border-8">
                  <Photo
                    image={{ ...front, alt: '' }}
                    eager={false}
                    sizes="(min-width: 768px) 17vw, 40vw"
                  />
                </div>
              ) : null}
              <p
                aria-hidden="true"
                className="eyebrow absolute top-0 left-0 text-zinc-500 [writing-mode:vertical-rl] rotate-180"
              >
                N° 01 — {shopName}
              </p>
            </div>
          </div>
          {index.length > 0 ? (
            <nav aria-label="Collections" className="mt-14 sm:mt-20">
              <ol
                className={`grid grid-cols-2 gap-x-6 ${index.length >= 3 ? 'md:grid-cols-4' : ''}`}
              >
                {index.map((tile, i) => (
                  <li
                    key={tile.href}
                    className="border-t border-[color-mix(in_oklab,var(--store-text)_30%,transparent)]"
                  >
                    <Link
                      href={tile.href}
                      className="group flex items-baseline gap-3 py-4 text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--store-text)] sm:py-5"
                    >
                      <span className="font-heading text-2xl text-zinc-400 tabular-nums italic sm:text-3xl">
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <span className="min-w-0 flex-1 text-sm font-medium break-words group-hover:underline group-hover:underline-offset-4">
                        {tile.label}
                      </span>
                      <span
                        aria-hidden="true"
                        className="text-zinc-500 transition group-hover:translate-x-1 motion-reduce:transition-none"
                      >
                        →
                      </span>
                    </Link>
                  </li>
                ))}
              </ol>
            </nav>
          ) : null}
        </section>
      );
    }

    case 'gallery': {
      // A white wall with one framed piece: a dark moulding, a wide white mat, a wall label beside
      // it and the collections listed as the rooms on view.
      const rooms = tiles.slice(0, 4);
      const year = new Date().getFullYear();
      return (
        <section className="store-section">
          <div className="grid gap-12 md:grid-cols-12 md:items-center md:gap-10 lg:gap-16">
            <div className="md:col-span-5 lg:col-span-4">
              <p className="eyebrow text-zinc-500">Now on view</p>
              <h1 className="t-display mt-5 text-[2.6rem] leading-[1.05] font-normal text-brand break-words sm:text-5xl lg:text-6xl">
                {title}
              </h1>
              <div aria-hidden="true" className="mt-7 h-px w-12 bg-ink" />
              <p className="mt-7 max-w-sm text-base leading-relaxed text-zinc-600 sm:text-lg">
                {subtitle}
              </p>
              <Cta label={cta} className="mt-9" />
            </div>
            <figure className="relative md:col-span-7 lg:col-span-8 lg:grid lg:grid-cols-[minmax(0,1fr)_11rem] lg:items-end lg:gap-8">
              <div
                aria-hidden="true"
                className="absolute inset-x-0 -top-12 bottom-1/3 bg-[radial-gradient(closest-side,color-mix(in_oklab,var(--store-accent)_14%,transparent),transparent)]"
              />
              <div className="relative mx-auto w-full max-w-[34rem] bg-ink p-2 shadow-[0_50px_90px_-45px_rgb(0_0_0/0.55),0_3px_8px_rgb(0_0_0/0.12)] motion-safe:transition motion-safe:duration-1000 motion-safe:ease-out motion-safe:starting:translate-y-3 motion-safe:starting:opacity-0 sm:p-3">
                <div className="bg-[color-mix(in_oklab,var(--store-bg)_55%,#ffffff)] p-5 shadow-[inset_0_2px_6px_rgb(0_0_0/0.18)] sm:p-9 lg:p-11">
                  <div className="relative aspect-[4/5] overflow-hidden bg-surface shadow-[0_0_0_1px_rgb(0_0_0/0.08)]">
                    {image ? (
                      <Photo image={image} sizes="(min-width: 768px) 30rem, 80vw" />
                    ) : (
                      <Wash className="opacity-60" />
                    )}
                  </div>
                </div>
              </div>
              <figcaption className="relative mx-auto mt-6 max-w-[34rem] border-l-2 border-accent pl-4 text-xs leading-relaxed text-zinc-600 sm:mt-8 lg:mx-0 lg:mt-0 lg:mb-10 lg:border-l-0 lg:bg-[color-mix(in_oklab,var(--store-bg)_55%,#ffffff)] lg:p-4 lg:shadow-[0_12px_30px_-18px_rgb(0_0_0/0.35)] lg:ring-1 lg:ring-[color-mix(in_oklab,var(--store-text)_8%,transparent)]">
                <span className="block text-sm font-semibold break-words text-ink">
                  {image?.alt || 'Featured piece'}
                </span>
                <span className="mt-1 block break-words">
                  {shopName}, {year}
                </span>
                <Link
                  href="/collections/all"
                  className="mt-3 inline-block font-medium text-ink underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--store-text)]"
                >
                  View the collection
                </Link>
              </figcaption>
            </figure>
          </div>
          {rooms.length > 0 ? (
            <nav
              aria-label="Collections on view"
              className="mt-16 flex flex-wrap items-baseline gap-x-8 gap-y-3 border-t border-[color-mix(in_oklab,var(--store-text)_14%,transparent)] pt-6 sm:mt-24"
            >
              <p className="eyebrow text-zinc-500">Rooms</p>
              <ul className="flex flex-wrap gap-x-8 gap-y-3">
                {rooms.map((tile, i) => (
                  <li key={tile.href}>
                    <Link
                      href={tile.href}
                      className="group inline-flex items-baseline gap-2 text-sm text-ink focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--store-text)]"
                    >
                      <span className="text-xs text-zinc-500 tabular-nums">
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <span className="break-words group-hover:underline group-hover:underline-offset-4">
                        {tile.label}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ) : null}
        </section>
      );
    }

    case 'cinema': {
      // Widescreen and letterboxed: black bars, a 2.39:1 frame with the title over it, and a
      // film strip of the store's photos that drifts sideways (still with reduced motion).
      const reelSource = image ? [image, ...extras] : extras;
      const reel =
        reelSource.length >= 2
          ? Array.from({ length: 10 }, (_, i) => reelSource[i % reelSource.length]!)
          : [];
      const sprockets =
        'h-2 bg-[repeating-linear-gradient(to_right,transparent_0_8px,#ffffff2e_8px_18px,transparent_18px_26px)]';
      return (
        <section className={`store-section ${FULL_BLEED} bg-[#000000] text-[#f4f4f5]`}>
          <div aria-hidden="true" className="h-6 sm:h-10" />
          <div className="relative flex min-h-[32rem] overflow-hidden bg-[#0b0b0e] sm:min-h-[34rem] lg:aspect-[2.39/1] lg:min-h-[32rem]">
            {image ? (
              <>
                <Photo
                  image={image}
                  className="motion-safe:transition-[scale] motion-safe:duration-[2400ms] motion-safe:ease-out motion-safe:starting:scale-110"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#000000f2] via-[#00000059] to-[#00000080]" />
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_45%,#000000b3)]" />
              </>
            ) : (
              <Wash className="opacity-50" />
            )}
            <div className="store-container relative flex w-full flex-col py-6 sm:py-8">
              <div className="eyebrow flex items-center justify-between gap-4 text-[#f4f4f5b3]">
                <span className="flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    className="size-1.5 rounded-full bg-accent motion-safe:animate-pulse"
                  />
                  Now showing
                </span>
                <span className="min-w-0 truncate">{shopName}</span>
              </div>
              <div className="mt-auto pt-16">
                <h1 className="t-display on-photo max-w-5xl text-[3.25rem] leading-[0.9] break-words sm:text-7xl lg:text-[7.5rem]">
                  {title}
                </h1>
                <div className="mt-6 flex flex-col gap-6 border-t border-[#ffffff33] pt-6 sm:flex-row sm:items-end sm:justify-between">
                  <p className="max-w-md text-base leading-relaxed text-[#f4f4f5d9] sm:text-lg">
                    {subtitle}
                  </p>
                  <div className="flex flex-wrap items-center gap-x-6 gap-y-4">
                    <Cta label={cta} variant="btn-on-image" className="" />
                    <Link
                      href="/collections"
                      className="eyebrow text-[#f4f4f5] underline decoration-[#ffffff66] underline-offset-[6px] hover:decoration-[#ffffff] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#ffffff]"
                    >
                      Collections
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
          {reel.length > 0 ? (
            <div
              aria-hidden="true"
              className="overflow-hidden py-2.5 [mask-image:linear-gradient(to_right,transparent,#000_6%,#000_94%,transparent)]"
            >
              <div className={sprockets} />
              <div className="store-ticker flex w-max py-2.5 hover:[animation-play-state:paused]">
                {[0, 1].map((group) =>
                  reel.map((photo, i) => (
                    <div key={`${group}-${i}`} className="shrink-0 pr-2.5">
                      <div className="relative aspect-[16/10] w-36 overflow-hidden rounded-sm bg-[#18181d] sm:w-52">
                        <Photo
                          image={{ ...photo, alt: '' }}
                          eager={false}
                          sizes="208px"
                          className="opacity-80 transition-opacity duration-500 hover:opacity-100"
                        />
                        <span className="absolute top-1 left-1.5 font-mono text-[10px] text-[#ffffffb3] tabular-nums">
                          {String(i + 1).padStart(2, '0')}
                        </span>
                      </div>
                    </div>
                  )),
                )}
              </div>
              <div className={sprockets} />
            </div>
          ) : (
            <div aria-hidden="true" className="h-6 sm:h-10" />
          )}
        </section>
      );
    }

    case 'magazine': {
      // A printed cover: issue line, the shop name as a huge masthead, cover lines either side
      // of one portrait photo, and a contents strip of the collections with page-style numbers.
      const now = new Date();
      const issue = String(now.getMonth() + 1).padStart(2, '0');
      const dateline = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      const masthead =
        shopName.length <= 8
          ? 'text-[clamp(3.5rem,17vw,13rem)]'
          : shopName.length <= 14
            ? 'text-[clamp(2.75rem,11vw,9rem)]'
            : 'text-[clamp(2.25rem,7.5vw,6.5rem)]';
      const lines = tiles.slice(0, 3);
      const contents = tiles.slice(0, 6);
      const rule = 'border-[color-mix(in_oklab,var(--store-text)_22%,transparent)]';
      return (
        <section className="store-section">
          <div className="eyebrow flex items-center justify-between gap-4 border-b border-ink pb-2.5 text-zinc-700">
            <span>Issue N° {issue}</span>
            <span className="hidden sm:inline">The {dateline} issue</span>
            <span>{dateline}</span>
          </div>
          <p
            className={`t-display mt-4 text-center leading-[0.82] tracking-[-0.03em] text-brand uppercase break-words motion-safe:transition motion-safe:duration-1000 motion-safe:ease-out motion-safe:starting:opacity-0 motion-safe:starting:-translate-y-2 sm:mt-6 ${masthead}`}
          >
            {shopName}
          </p>
          <div aria-hidden="true" className="mt-4 h-1 border-y border-ink sm:mt-6" />
          <div className="mt-6 grid gap-8 sm:mt-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1.45fr)_minmax(0,1fr)] md:gap-6 lg:gap-10">
            <div className="order-2 flex flex-col md:order-1 md:py-2">
              <p className="eyebrow text-accent">Cover story</p>
              <h1 className="t-display mt-3 text-4xl text-brand break-words sm:text-5xl md:text-4xl lg:text-[3.25rem]">
                {title}
              </h1>
              <p className="mt-5 max-w-sm font-heading text-lg leading-relaxed text-zinc-700 italic">
                {subtitle}
              </p>
              <div className="mt-8 md:mt-auto md:pt-8">
                <Cta label={cta} className="" />
              </div>
            </div>
            <figure className="relative order-1 md:order-2">
              <div className="relative aspect-[4/5] overflow-hidden bg-surface">
                {image ? (
                  <Photo
                    image={image}
                    sizes="(min-width: 768px) 42vw, 100vw"
                    className="motion-safe:transition-[scale] motion-safe:duration-[1600ms] motion-safe:ease-out motion-safe:starting:scale-105"
                  />
                ) : (
                  <Wash className="opacity-60" />
                )}
                <span className="absolute top-3 left-3 grid size-16 place-items-center rounded-full bg-accent text-center text-[0.625rem] leading-tight font-bold tracking-[0.12em] text-accent-contrast uppercase sm:top-4 sm:left-4 sm:size-20 sm:text-xs">
                  N° {issue}
                  <br />
                  {now.getFullYear()}
                </span>
                <div
                  aria-hidden="true"
                  className="absolute right-3 bottom-3 bg-[#ffffff] px-2 pt-2 pb-1 sm:right-4 sm:bottom-4"
                >
                  <div className="h-8 w-20 bg-[repeating-linear-gradient(to_right,#111111_0_2px,transparent_2px_4px,#111111_4px_5px,transparent_5px_8px,#111111_8px_11px,transparent_11px_12px)]" />
                  <p className="mt-0.5 text-center font-mono text-[8px] tracking-[0.2em] text-[#111111]">
                    {issue}
                    {now.getFullYear()}
                  </p>
                </div>
              </div>
              {image?.alt ? (
                <figcaption className="eyebrow mt-2.5 text-zinc-500">
                  On the cover: {image.alt}
                </figcaption>
              ) : null}
            </figure>
            <div className="order-3 flex flex-col md:py-2">
              <p className="eyebrow text-zinc-500">Inside</p>
              <ul className={`mt-3 border-t ${rule}`}>
                {(lines.length > 0
                  ? lines
                  : [{ label: 'The full collection', href: '/collections/all' }]
                ).map((tile, i) => (
                  <li key={tile.href} className={`border-b ${rule}`}>
                    <Link
                      href={tile.href}
                      className="group block py-4 text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--store-text)]"
                    >
                      <span className="eyebrow block text-accent">
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <span className="t-title mt-1.5 block text-2xl break-words uppercase group-hover:underline group-hover:underline-offset-4 lg:text-[1.75rem]">
                        {tile.label}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
              <Link
                href="/collections"
                className="eyebrow mt-auto self-start pt-6 text-ink underline underline-offset-[6px] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--store-text)]"
              >
                Every collection →
              </Link>
            </div>
          </div>
          {contents.length > 0 ? (
            <nav
              aria-label="Contents"
              className="mt-12 grid gap-4 border-t-2 border-ink pt-4 sm:mt-16 md:grid-cols-[8rem_minmax(0,1fr)]"
            >
              <p className="t-title text-xl text-brand uppercase">Contents</p>
              <ol className="grid grid-cols-2 gap-x-6 sm:grid-cols-3 lg:grid-cols-6">
                {contents.map((tile, i) => (
                  <li key={tile.href} className={`border-t ${rule} md:border-t-0`}>
                    <Link
                      href={tile.href}
                      className="group flex items-baseline gap-2.5 py-2.5 text-sm text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--store-text)]"
                    >
                      <span className="font-heading text-lg text-accent tabular-nums">
                        {String(i * 8 + 6).padStart(2, '0')}
                      </span>
                      <span className="min-w-0 break-words group-hover:underline group-hover:underline-offset-4">
                        {tile.label}
                      </span>
                    </Link>
                  </li>
                ))}
              </ol>
            </nav>
          ) : null}
        </section>
      );
    }

    case 'studio': {
      // A product stage: the lead photo on an accent-tinted stage with a floor shadow and a soft
      // reflection, the collections as feature chips, and a spotlight card carrying the CTA.
      const chips = tiles.slice(0, 3);
      const thumb = extras[0] ?? image;
      return (
        <section className="store-section relative overflow-hidden rounded-[2rem] bg-[color-mix(in_oklab,var(--store-accent)_14%,var(--store-bg))] px-6 py-12 sm:px-12 sm:py-16 lg:px-16">
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-[radial-gradient(55%_55%_at_68%_38%,color-mix(in_oklab,#ffffff_70%,transparent),transparent_72%)]"
          />
          <div
            aria-hidden="true"
            className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-[color-mix(in_oklab,var(--store-accent)_22%,var(--store-bg))] to-transparent"
          />
          <div className="relative grid items-center gap-12 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-16">
            <div>
              <p className="eyebrow text-accent">{shopName}</p>
              <h1 className="t-display mt-4 text-[2.75rem] text-brand break-words sm:text-6xl lg:text-7xl">
                {title}
              </h1>
              <p className="mt-6 max-w-md text-lg leading-relaxed text-zinc-700">{subtitle}</p>
              {chips.length > 0 ? (
                <ul aria-label="Shop by collection" className="mt-8 flex flex-wrap gap-2.5">
                  {chips.map((tile) => (
                    <li key={tile.href}>
                      <Link
                        href={tile.href}
                        className="inline-flex min-h-10 items-center gap-2 rounded-full bg-[color-mix(in_oklab,var(--store-bg)_80%,transparent)] px-4 py-2 text-sm font-medium text-ink ring-1 ring-[color-mix(in_oklab,var(--store-text)_12%,transparent)] backdrop-blur transition hover:ring-[color-mix(in_oklab,var(--store-text)_35%,transparent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--store-text)] motion-reduce:transition-none"
                      >
                        <span aria-hidden="true" className="size-1.5 rounded-full bg-accent" />
                        <span className="break-words">{tile.label}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
            <div className="relative mx-auto w-full max-w-md lg:max-w-lg">
              <div className="group relative motion-safe:transition motion-safe:duration-1000 motion-safe:ease-out motion-safe:starting:translate-y-6 motion-safe:starting:opacity-0">
                <div className="relative aspect-square overflow-hidden rounded-[1.75rem] bg-[var(--store-bg)] shadow-[0_40px_70px_-35px_rgb(0_0_0/0.45)] ring-1 ring-[color-mix(in_oklab,var(--store-text)_8%,transparent)] transition-transform duration-700 ease-out group-hover:-translate-y-1.5 motion-reduce:transition-none motion-reduce:group-hover:translate-y-0">
                  {image ? (
                    <Photo image={image} sizes="(min-width: 768px) 32rem, 90vw" />
                  ) : (
                    <Wash className="opacity-70" />
                  )}
                </div>
                <div
                  aria-hidden="true"
                  className="mx-auto -mt-2 h-6 w-4/5 bg-[radial-gradient(closest-side,rgb(0_0_0/0.28),transparent)]"
                />
                {image ? (
                  <div
                    aria-hidden="true"
                    className="relative -mt-3 h-14 overflow-hidden rounded-t-[1.75rem] opacity-25 [mask-image:linear-gradient(to_bottom,#000,transparent_85%)] sm:h-20"
                  >
                    <div className="absolute inset-x-0 top-0 aspect-square -scale-y-100">
                      <Photo
                        image={{ ...image, alt: '' }}
                        eager={false}
                        sizes="(min-width: 768px) 32rem, 90vw"
                      />
                    </div>
                  </div>
                ) : null}
              </div>
              <div className="relative mt-4 flex items-center gap-4 rounded-2xl bg-[var(--store-bg)] p-4 shadow-[0_24px_50px_-24px_rgb(0_0_0/0.4)] ring-1 ring-[color-mix(in_oklab,var(--store-text)_8%,transparent)] lg:absolute lg:right-[-1.5rem] lg:bottom-16 lg:mt-0 lg:w-80">
                {thumb ? (
                  <div className="relative size-14 shrink-0 overflow-hidden rounded-xl bg-surface">
                    <Photo image={{ ...thumb, alt: '' }} eager={false} sizes="56px" />
                  </div>
                ) : null}
                <div className="min-w-0 flex-1">
                  <p className="eyebrow text-accent">In the spotlight</p>
                  <p className="mt-1 truncate text-sm font-semibold text-ink">
                    {thumb?.alt || shopName}
                  </p>
                  <Cta label={cta} className="mt-3" />
                </div>
              </div>
            </div>
          </div>
        </section>
      );
    }

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
