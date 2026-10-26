import type { ReactNode } from 'react';
import { EmailCapture } from './email-capture';
import { Icon, type IconName } from './icons';
import { Photo, type PhotoName } from './photos';
import { signupUrl } from './urls';

/**
 * The marketing site's design system: layout, type scale, buttons and the building blocks every
 * page shares, so the whole site reads as one product.
 *
 * Surfaces: white, `paper` (cool mist) and `ink` (deep navy) sections alternate; azure blue is
 * the accent and leaf green highlights a phrase in a heading. Type: the display face for h1/h2,
 * Inter Tight for text (both set by MarketingShell). Buttons are crisp 6px rectangles; floating
 * UI sits on frosted `glass`.
 */

export const container = 'mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8';
export const paper = 'bg-mist';
export const ink = 'bg-navy-950';
export const section = 'py-20 sm:py-24 lg:py-28';

/** The display typeface (TASA Orbiter), for headings. */
export const displayFace = 'font-[family-name:var(--font-display)]';
export const display = `${displayFace} text-[2.5rem] leading-[1.08] font-medium tracking-[-0.03em] text-balance sm:text-[3.25rem] lg:text-[3.75rem]`;
export const headline = `${displayFace} text-[2rem] leading-[1.1] font-semibold tracking-[-0.025em] text-balance sm:text-[2.75rem] lg:text-[3.25rem]`;
export const lead = 'text-lg leading-8 text-pretty sm:text-xl sm:leading-[1.6]';
/** Frosted glass for chips and cards floating over photos and gradients. */
export const glass =
  'bg-white/60 shadow-[0_8px_32px_-12px_rgb(10_34_54/0.25)] ring-1 ring-white/70 backdrop-blur-xl backdrop-saturate-150';
export const glassDark = 'bg-white/[0.07] ring-1 ring-white/15 backdrop-blur-xl';

export const focusRing =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-azure-600';
const focusRingLight =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white';
const button =
  'inline-flex items-center justify-center gap-2 rounded-md px-5 py-3 text-sm font-semibold whitespace-nowrap transition';

/** Primary action on light surfaces. */
export const buttonPrimary = `${button} bg-azure-600 text-white shadow-[0_1px_2px_rgb(10_34_54/0.2)] hover:bg-azure-700 ${focusRing}`;
/** Secondary action on light surfaces. */
export const buttonSecondary = `${button} bg-white text-azure-700 ring-1 ring-azure-600/60 hover:bg-azure-50 ${focusRing}`;
/** Primary action on dark surfaces and photos. */
export const buttonLight = `${button} bg-white text-navy-900 hover:bg-azure-50 ${focusRingLight}`;
/** Secondary action on dark surfaces and photos. */
export const buttonGhostDark = `${button} text-white ring-1 ring-white/35 hover:bg-white/10 ${focusRingLight}`;
export const textLink = `rounded font-semibold text-azure-700 underline-offset-4 hover:underline ${focusRing}`;
export const textLinkDark = `rounded font-semibold text-azure-200 underline-offset-4 hover:underline ${focusRingLight}`;

/** Small → used after link text. */
export function Arrow() {
  return (
    <span aria-hidden="true" className="transition-transform group-hover:translate-x-0.5">
      →
    </span>
  );
}

/** Small uppercase label above a heading. */
export function Eyebrow({
  children,
  dark = false,
  className = '',
}: {
  children: ReactNode;
  dark?: boolean;
  className?: string;
}) {
  return (
    <p
      className={`flex items-center gap-2 text-xs font-semibold tracking-[0.14em] uppercase ${
        dark ? 'text-azure-200' : 'text-azure-700'
      } ${className}`}
    >
      <span
        aria-hidden="true"
        className={`h-px w-6 ${dark ? 'bg-azure-300/60' : 'bg-azure-600/50'}`}
      />
      {children}
    </p>
  );
}

/** A rounded icon tile in the site's single icon style. */
export function IconTile({
  name,
  dark = false,
  className = '',
}: {
  name: IconName;
  dark?: boolean;
  className?: string;
}) {
  return (
    <span
      className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${
        dark
          ? 'bg-white/10 text-azure-200 ring-1 ring-white/15'
          : 'bg-white text-azure-600 shadow-sm ring-1 ring-slate-900/10'
      } ${className}`}
    >
      <Icon name={name} />
    </span>
  );
}

/** Breadcrumb trail above a page title (the last item is the current page). */
export function Breadcrumbs({
  items,
  dark = false,
}: {
  items: { label: string; href?: string }[];
  dark?: boolean;
}) {
  return (
    <nav aria-label="Breadcrumb">
      <ol
        className={`flex flex-wrap items-center gap-x-2 gap-y-1 text-sm ${dark ? 'text-slate-400' : 'text-slate-500'}`}
      >
        {items.map((item, i) => (
          <li key={item.label} className="flex items-center gap-2">
            {i > 0 ? <span aria-hidden="true">/</span> : null}
            {item.href ? (
              <a
                href={item.href}
                className={`rounded ${dark ? `hover:text-white ${focusRingLight}` : `hover:text-slate-900 ${focusRing}`}`}
              >
                {item.label}
              </a>
            ) : (
              <span
                aria-current="page"
                className={`max-w-[16rem] truncate ${dark ? 'text-slate-200' : 'text-slate-800'}`}
              >
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

/** The hero every marketing page opens with: warm paper by default, or ink with `dark`. */
export function PageHero({
  eyebrow,
  title,
  subtitle,
  breadcrumbs,
  actions,
  aside,
  center = false,
  dark = false,
}: {
  eyebrow?: string;
  title: ReactNode;
  subtitle?: ReactNode;
  breadcrumbs?: { label: string; href?: string }[];
  actions?: ReactNode;
  aside?: ReactNode;
  center?: boolean;
  dark?: boolean;
}) {
  const centered = center && !aside;
  return (
    <section
      className={`relative isolate overflow-hidden ${dark ? `${ink} text-white` : `${paper} text-navy-900`}`}
    >
      <div
        aria-hidden="true"
        className={`absolute inset-0 -z-10 ${
          dark
            ? 'bg-[radial-gradient(48rem_28rem_at_85%_-10%,rgb(48_94_255/0.35),transparent),radial-gradient(36rem_24rem_at_-10%_110%,rgb(22_163_95/0.18),transparent)]'
            : 'bg-[radial-gradient(44rem_26rem_at_90%_-10%,rgb(48_94_255/0.12),transparent),radial-gradient(30rem_20rem_at_0%_100%,rgb(251_191_36/0.10),transparent)]'
        }`}
      />
      <div
        className={`${container} grid items-center gap-12 pt-12 pb-16 sm:pt-16 sm:pb-20 lg:gap-16 lg:pt-20 lg:pb-24 ${
          aside ? 'lg:grid-cols-[1.05fr_1fr]' : ''
        }`}
      >
        <div className={centered ? 'mx-auto max-w-3xl text-center' : 'max-w-2xl'}>
          {breadcrumbs ? <Breadcrumbs items={breadcrumbs} dark={dark} /> : null}
          {eyebrow ? (
            <Eyebrow
              dark={dark}
              className={`${breadcrumbs ? 'mt-8' : ''} ${centered ? 'justify-center' : ''}`}
            >
              {eyebrow}
            </Eyebrow>
          ) : null}
          <h1 className={`mt-5 ${display}`}>{title}</h1>
          {subtitle ? (
            <p className={`mt-6 ${lead} ${dark ? 'text-slate-300' : 'text-slate-600'}`}>
              {subtitle}
            </p>
          ) : null}
          {actions ? (
            <div
              className={`mt-9 flex flex-wrap items-center gap-3 ${centered ? 'justify-center' : ''}`}
            >
              {actions}
            </div>
          ) : null}
        </div>
        {aside ? <div className="min-w-0">{aside}</div> : null}
      </div>
    </section>
  );
}

/** Eyebrow + h2 + optional intro for a section. */
export function SectionHeading({
  eyebrow,
  title,
  intro,
  center = false,
  dark = false,
  id,
  size = 'lg',
}: {
  eyebrow?: string;
  title: ReactNode;
  intro?: ReactNode;
  center?: boolean;
  dark?: boolean;
  id?: string;
  size?: 'lg' | 'md';
}) {
  return (
    <div data-reveal className={center ? 'mx-auto max-w-3xl text-center' : 'max-w-3xl'}>
      {eyebrow ? (
        <Eyebrow dark={dark} className={center ? 'justify-center' : ''}>
          {eyebrow}
        </Eyebrow>
      ) : null}
      <h2
        id={id}
        className={`${eyebrow ? 'mt-4' : ''} ${
          size === 'lg'
            ? headline
            : 'text-2xl leading-tight font-semibold tracking-[-0.02em] text-balance sm:text-3xl'
        } ${dark ? 'text-white' : 'text-navy-900'}`}
      >
        {title}
      </h2>
      {intro ? (
        <p className={`mt-5 ${lead} ${dark ? 'text-slate-300' : 'text-slate-600'}`}>{intro}</p>
      ) : null}
    </div>
  );
}

/** A grid of icon + title + text cards. */
export function IconGrid({
  items,
  columns = 3,
}: {
  items: { icon: IconName; title: string; body: ReactNode; href?: string }[];
  columns?: 2 | 3;
}) {
  return (
    <ul
      data-reveal="stagger"
      className={`grid gap-4 sm:grid-cols-2 sm:gap-5 ${columns === 3 ? 'lg:grid-cols-3' : ''}`}
    >
      {items.map((item) => {
        const inner = (
          <>
            <IconTile name={item.icon} />
            <h3 className="mt-5 text-base font-semibold text-navy-900">{item.title}</h3>
            <p className="mt-2 text-[0.9375rem] leading-7 text-slate-600">{item.body}</p>
            {item.href ? (
              <span className="mt-auto inline-flex items-center gap-1 pt-5 text-sm font-semibold text-azure-700">
                Learn more <Arrow />
              </span>
            ) : null}
          </>
        );
        return (
          <li key={item.title} className="flex">
            {item.href ? (
              <a
                href={item.href}
                className={`group flex flex-1 flex-col rounded-2xl bg-white p-6 ring-1 ring-slate-900/[0.08] transition hover:-translate-y-0.5 hover:shadow-[0_18px_40px_-20px_rgb(15_23_42/0.35)] hover:ring-slate-900/15 sm:p-7 ${focusRing}`}
              >
                {inner}
              </a>
            ) : (
              <div className="flex flex-1 flex-col rounded-2xl bg-white p-6 ring-1 ring-slate-900/[0.08] sm:p-7">
                {inner}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** Numbered steps joined by a line. */
export function Steps({
  steps,
  dark = false,
}: {
  steps: { title: string; body: ReactNode }[];
  dark?: boolean;
}) {
  return (
    <ol
      data-reveal="stagger"
      className={`relative grid gap-10 md:gap-8 ${steps.length >= 3 ? 'md:grid-cols-3' : 'md:grid-cols-2'}`}
    >
      {steps.map((step, i) => (
        <li key={step.title} className="relative">
          <div className="flex items-center gap-4">
            <span
              className={`flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
                dark
                  ? 'bg-white text-navy-900'
                  : 'bg-navy-950 text-white shadow-[0_0_0_6px_rgb(48_94_255/0.12)]'
              }`}
            >
              {i + 1}
            </span>
            {i < steps.length - 1 ? (
              <span
                aria-hidden="true"
                className={`hidden h-px flex-1 md:block ${dark ? 'bg-white/15' : 'bg-slate-900/15'}`}
              />
            ) : null}
          </div>
          <h3 className={`mt-6 text-lg font-semibold ${dark ? 'text-white' : 'text-navy-900'}`}>
            {step.title}
          </h3>
          <p className={`mt-2 leading-7 ${dark ? 'text-slate-300' : 'text-slate-600'}`}>
            {step.body}
          </p>
        </li>
      ))}
    </ol>
  );
}

/** The closing call to action used at the bottom of every page: a photo band with sign-up. */
export function CtaBand({
  title = 'Start selling with Commerce Platform',
  body = 'Create your store, pick a template and add your first product in a few minutes.',
  template,
  photo = 'market-stall',
}: {
  title?: string;
  body?: string;
  /** Template id the sign-up should start with. */
  template?: string;
  photo?: PhotoName;
}) {
  return (
    <section className="px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
      <div className="relative isolate mx-auto max-w-7xl overflow-hidden rounded-xl bg-navy-950 text-white">
        <div className="absolute inset-0 -z-20">
          <Photo name={photo} alt="" />
        </div>
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 bg-[linear-gradient(100deg,rgb(10_34_54/0.94)_0%,rgb(10_34_54/0.82)_45%,rgb(10_34_54/0.35)_100%)]"
        />
        <div className="max-w-2xl px-6 py-16 sm:px-12 sm:py-20 lg:px-16 lg:py-24">
          <h2 className={headline}>{title}</h2>
          <p className="mt-5 max-w-xl text-lg leading-8 text-slate-200">{body}</p>
          <div className="mt-9">
            <EmailCapture signupUrl={signupUrl} template={template} />
          </div>
          <p className="mt-3 text-sm text-slate-300">Every new store starts with a 14-day trial.</p>
        </div>
      </div>
    </section>
  );
}

/** A check-marked list. */
export function CheckList({ items, dark = false }: { items: ReactNode[]; dark?: boolean }) {
  return (
    <ul className={`space-y-3.5 ${dark ? 'text-slate-200' : 'text-slate-700'}`}>
      {items.map((item, i) => (
        <li key={i} className="flex gap-3">
          <span
            className={`mt-1 flex size-5 shrink-0 items-center justify-center rounded-full ${
              dark ? 'bg-azure-400/20 text-azure-200' : 'bg-azure-600/10 text-azure-700'
            }`}
          >
            <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" className="size-3.5">
              <path
                fillRule="evenodd"
                d="M16.7 5.3a1 1 0 0 1 0 1.4l-8 8a1 1 0 0 1-1.4 0l-4-4a1 1 0 1 1 1.4-1.4L8 12.58l7.3-7.3a1 1 0 0 1 1.4 0Z"
                clipRule="evenodd"
              />
            </svg>
          </span>
          <span className="leading-7">{item}</span>
        </li>
      ))}
    </ul>
  );
}

/** A rounded photo with an optional floating card over one corner (a UI mock, a caption...). */
export function PhotoPanel({
  photo,
  alt,
  priority = false,
  position,
  ratio = 'aspect-[4/3]',
  overlay,
  overlayPosition = 'bottom-left',
  className = '',
}: {
  photo: PhotoName;
  alt?: string;
  priority?: boolean;
  position?: string;
  ratio?: string;
  overlay?: ReactNode;
  overlayPosition?: 'bottom-left' | 'bottom-right' | 'top-right';
  className?: string;
}) {
  const where = {
    'bottom-left': '-bottom-6 left-3 sm:-bottom-8 sm:-left-6',
    'bottom-right': '-bottom-6 right-3 sm:-bottom-8 sm:-right-6',
    'top-right': 'top-3 right-3 sm:-top-6 sm:-right-6',
  }[overlayPosition];
  return (
    <div className={`relative ${overlay ? 'pb-6 sm:pb-0' : ''} ${className}`}>
      <div
        className={`overflow-hidden rounded-xl bg-slate-200 shadow-[0_30px_60px_-30px_rgb(15_23_42/0.45)] ring-1 ring-slate-900/10 ${ratio}`}
      >
        <Photo name={photo} alt={alt} priority={priority} position={position} />
      </div>
      {overlay ? (
        <div aria-hidden="true" className={`absolute w-[min(20rem,80%)] ${where}`}>
          {overlay}
        </div>
      ) : null}
    </div>
  );
}

/** A small white floating UI card (used over photos). */
export function FloatCard({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl bg-white/95 p-4 text-slate-900 shadow-[0_24px_48px_-16px_rgb(15_23_42/0.35)] ring-1 ring-slate-900/10 backdrop-blur ${className}`}
    >
      {children}
    </div>
  );
}
