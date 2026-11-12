import type { ReactNode } from 'react';
import { EmailCapture } from './email-capture';
import { Icon, type IconName } from './icons';
import { Photo, type PhotoName } from './photos';
import { signupUrl } from './urls';

/**
 * The marketing site's design system: layout, type scale, buttons and the building blocks every
 * page shares, so the whole site reads as one product.
 *
 * Light and dark themes come from the `mk-*` color tokens in globals.css. Add `mk-dark` to anything
 * that stays dark in both themes (photo bands, `ink`). Product mockups and template previews stay
 * light so they read as real screens. Type: the display face for h1/h2, Inter Tight
 * for text (both set by MarketingShell). Buttons are pills: white for the main action, outlined
 * for the second one.
 */

export const container = 'mx-auto w-full max-w-[90rem] px-5 sm:px-8 lg:px-[5.5rem]';
export const paper = 'bg-mk-subtle';
export const ink = 'mk-dark bg-[#0a1c33]';
export const section = 'py-20 sm:py-24 lg:py-28';

/** The display typeface (TASA Orbiter), for headings. */
export const displayFace = 'font-[family-name:var(--font-display)]';
export const display = `${displayFace} text-[2.75rem] leading-[1.05] font-normal tracking-[-0.03em] text-balance sm:text-6xl lg:text-[4.5rem]`;
export const headline = `${displayFace} text-[2rem] leading-[1.08] font-normal tracking-[-0.03em] text-balance sm:text-[2.75rem] lg:text-[3.25rem]`;
export const lead = 'text-lg leading-8 text-pretty sm:text-xl sm:leading-[1.6]';
/** Frosted glass for chips and cards floating over photos and gradients. */
export const glass =
  'bg-mk-bg/85 shadow-[0_8px_32px_-12px_rgb(10_34_54/0.25)] ring-1 ring-mk-line backdrop-blur-xl backdrop-saturate-150';
export const glassDark = 'bg-mk-surface-2 ring-1 ring-mk-line backdrop-blur-xl';

export const focusRing =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mk-fg';
const focusRingLight =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mk-fg';
const button =
  'inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-[0.9375rem] font-semibold whitespace-nowrap transition';

/** Primary action on light surfaces. */
export const buttonPrimary = `${button} bg-mk-fg text-mk-bg hover:opacity-85 ${focusRing}`;
/** Secondary action on light surfaces. */
export const buttonSecondary = `${button} text-mk-fg ring-2 ring-mk-fg/80 hover:bg-mk-surface-2 ${focusRing}`;
/** Primary action on dark surfaces and photos. */
export const buttonLight = `${button} bg-mk-fg text-mk-bg hover:opacity-85 ${focusRingLight}`;
/** Secondary action on dark surfaces and photos. */
export const buttonGhostDark = `${button} text-mk-fg ring-2 ring-mk-fg/80 hover:bg-mk-surface-2 ${focusRingLight}`;
export const textLink = `rounded font-semibold text-mk-accent underline-offset-4 hover:underline ${focusRing}`;
export const textLinkDark = `rounded font-semibold text-mk-accent underline-offset-4 hover:underline ${focusRingLight}`;

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
        dark ? 'text-mk-accent' : 'text-mk-accent'
      } ${className}`}
    >
      <span
        aria-hidden="true"
        className={`h-px w-6 ${dark ? 'bg-mk-accent-soft' : 'bg-azure-600/50'}`}
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
          ? 'bg-mk-surface-2 text-mk-accent ring-1 ring-mk-line'
          : 'bg-mk-surface text-mk-accent shadow-sm ring-1 ring-mk-line'
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
        className={`flex flex-wrap items-center gap-x-2 gap-y-1 text-sm ${dark ? 'text-mk-dim' : 'text-mk-dim'}`}
      >
        {items.map((item, i) => (
          <li key={item.label} className="flex items-center gap-2">
            {i > 0 ? <span aria-hidden="true">/</span> : null}
            {item.href ? (
              <a
                href={item.href}
                className={`rounded ${dark ? `hover:text-mk-fg ${focusRingLight}` : `hover:text-mk-fg ${focusRing}`}`}
              >
                {item.label}
              </a>
            ) : (
              <span
                aria-current="page"
                className={`max-w-[16rem] truncate ${dark ? 'text-mk-fg-soft' : 'text-mk-fg'}`}
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
  dark = true,
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
    <section className={'relative isolate overflow-hidden bg-mk-bg text-mk-fg'}>
      <div
        aria-hidden="true"
        className={`absolute inset-0 -z-10 ${
          dark
            ? 'bg-[radial-gradient(48rem_28rem_at_85%_-10%,rgb(48_94_255/0.16),transparent),radial-gradient(36rem_24rem_at_-10%_110%,rgb(22_163_95/0.08),transparent)]'
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
            <p className={`mt-6 ${lead} ${dark ? 'text-mk-muted' : 'text-mk-muted'}`}>{subtitle}</p>
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
        } ${dark ? 'text-mk-fg' : 'text-mk-fg'}`}
      >
        {title}
      </h2>
      {intro ? (
        <p className={`mt-5 ${lead} ${dark ? 'text-mk-muted' : 'text-mk-muted'}`}>{intro}</p>
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
            <h3 className="mt-5 text-base font-semibold text-mk-fg">{item.title}</h3>
            <p className="mt-2 text-[0.9375rem] leading-7 text-mk-muted">{item.body}</p>
            {item.href ? (
              <span className="mt-auto inline-flex items-center gap-1 pt-5 text-sm font-semibold text-mk-accent">
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
                className={`group flex flex-1 flex-col rounded-2xl bg-mk-surface p-6 ring-1 ring-mk-line transition hover:-translate-y-0.5 hover:shadow-[0_18px_40px_-20px_rgb(15_23_42/0.35)] hover:ring-mk-line sm:p-7 ${focusRing}`}
              >
                {inner}
              </a>
            ) : (
              <div className="flex flex-1 flex-col rounded-2xl bg-mk-surface p-6 ring-1 ring-mk-line sm:p-7">
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
                dark ? 'bg-mk-surface text-mk-fg' : 'bg-mk-fg text-mk-bg'
              }`}
            >
              {i + 1}
            </span>
            {i < steps.length - 1 ? (
              <span
                aria-hidden="true"
                className={`hidden h-px flex-1 md:block ${dark ? 'bg-mk-surface-2' : 'bg-mk-surface-2'}`}
              />
            ) : null}
          </div>
          <h3 className={`mt-6 text-lg font-semibold ${dark ? 'text-mk-fg' : 'text-mk-fg'}`}>
            {step.title}
          </h3>
          <p className={`mt-2 leading-7 ${dark ? 'text-mk-muted' : 'text-mk-muted'}`}>
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
      <div className="relative isolate mx-auto max-w-[79rem] overflow-hidden rounded-3xl mk-dark bg-navy-950 text-mk-fg">
        <div className="absolute inset-0 -z-20">
          <Photo name={photo} alt="" />
        </div>
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 bg-[linear-gradient(100deg,rgb(3_8_11/0.92)_0%,rgb(3_8_11/0.78)_45%,rgb(3_8_11/0.25)_100%)]"
        />
        <div className="max-w-2xl px-6 py-16 sm:px-12 sm:py-20 lg:px-16 lg:py-24">
          <h2 className={headline}>{title}</h2>
          <p className="mt-5 max-w-xl text-lg leading-8 text-mk-fg-soft">{body}</p>
          <div className="mt-9">
            <EmailCapture signupUrl={signupUrl} template={template} />
          </div>
          <p className="mt-3 text-sm text-mk-muted">
            Free for 7 days, then ₹99/month for 3 months.
          </p>
        </div>
      </div>
    </section>
  );
}

/** A check-marked list. */
export function CheckList({ items, dark = false }: { items: ReactNode[]; dark?: boolean }) {
  return (
    <ul className={`space-y-3.5 ${dark ? 'text-mk-fg-soft' : 'text-mk-fg-soft'}`}>
      {items.map((item, i) => (
        <li key={i} className="flex gap-3">
          <span
            className={`mt-1 flex size-5 shrink-0 items-center justify-center rounded-full ${
              dark ? 'bg-mk-accent-soft text-mk-accent' : 'bg-azure-600/10 text-mk-accent'
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
        className={`overflow-hidden rounded-xl bg-mk-surface-2 shadow-[0_30px_60px_-30px_rgb(15_23_42/0.45)] ring-1 ring-mk-line ${ratio}`}
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
      className={`rounded-2xl bg-mk-elevated p-4 text-mk-fg shadow-[0_24px_48px_-16px_rgb(15_23_42/0.35)] ring-1 ring-mk-line backdrop-blur ${className}`}
    >
      {children}
    </div>
  );
}
