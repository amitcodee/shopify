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
