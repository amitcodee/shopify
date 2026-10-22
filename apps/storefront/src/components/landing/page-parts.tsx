import type { ReactNode } from 'react';
import { EmailCapture } from './email-capture';
import { Icon, type IconName } from './icons';
import { signupUrl } from './urls';

/** Shared building blocks for the marketing pages, so every page reads as one site. */

export const container = 'mx-auto max-w-7xl px-4 sm:px-6';
export const focusRing =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600';
export const buttonDark = `inline-block rounded-full bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 ${focusRing}`;
export const buttonLight = `inline-block rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-slate-950 hover:bg-indigo-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white`;
export const buttonGhostDark = `inline-block rounded-full px-5 py-2.5 text-sm font-semibold text-white ring-1 ring-white/30 hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white`;
export const textLink = `rounded font-semibold text-indigo-600 hover:text-indigo-500 ${focusRing}`;

/** Breadcrumb trail above a page title (the last item is the current page). */
export function Breadcrumbs({ items }: { items: { label: string; href?: string }[] }) {
  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-400">
        {items.map((item, i) => (
          <li key={item.label} className="flex items-center gap-2">
            {i > 0 ? <span aria-hidden="true">/</span> : null}
            {item.href ? (
              <a
                href={item.href}
                className="rounded hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                {item.label}
              </a>
            ) : (
              <span aria-current="page" className="text-slate-200">
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

/** The dark hero every marketing page opens with. */
export function PageHero({
  eyebrow,
  title,
  subtitle,
  breadcrumbs,
  actions,
  aside,
  center = false,
}: {
  eyebrow?: string;
  title: ReactNode;
  subtitle?: ReactNode;
  breadcrumbs?: { label: string; href?: string }[];
  actions?: ReactNode;
  aside?: ReactNode;
  center?: boolean;
}) {
  return (
    <section className="relative isolate overflow-hidden bg-slate-950 text-white">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(50rem_28rem_at_85%_0%,rgb(79_70_229/0.42),transparent),radial-gradient(36rem_24rem_at_0%_100%,rgb(139_92_246/0.28),transparent)]" />
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(to_right,rgb(255_255_255/0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgb(255_255_255/0.04)_1px,transparent_1px)] [mask-image:radial-gradient(ellipse_at_center,black,transparent_75%)] bg-[size:48px_48px]" />
      <div
        className={`${container} grid items-center gap-14 pt-14 pb-20 sm:pt-20 sm:pb-24 ${
          aside ? 'lg:grid-cols-[1.1fr_1fr]' : ''
        }`}
      >
        <div className={center && !aside ? 'mx-auto max-w-3xl text-center' : 'max-w-3xl'}>
          {breadcrumbs ? <Breadcrumbs items={breadcrumbs} /> : null}
          {eyebrow ? (
            <p
              className={`text-sm font-semibold tracking-wide text-indigo-300 ${breadcrumbs ? 'mt-6' : ''}`}
            >
              {eyebrow}
            </p>
          ) : null}
          <h1 className="mt-3 text-4xl font-bold tracking-tight text-balance sm:text-5xl lg:text-6xl">
            {title}
          </h1>
          {subtitle ? (
            <p className="mt-6 text-lg leading-8 text-pretty text-slate-300">{subtitle}</p>
          ) : null}
          {actions ? (
            <div
              className={`mt-10 flex flex-wrap items-center gap-3 ${center && !aside ? 'justify-center' : ''}`}
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
}: {
  eyebrow?: string;
  title: ReactNode;
  intro?: ReactNode;
  center?: boolean;
  dark?: boolean;
  id?: string;
}) {
  return (
    <div className={center ? 'mx-auto max-w-3xl text-center' : 'max-w-3xl'}>
      {eyebrow ? (
        <p
          className={`text-sm font-semibold tracking-wide ${dark ? 'text-indigo-300' : 'text-indigo-600'}`}
        >
          {eyebrow}
        </p>
      ) : null}
      <h2
        id={id}
        className={`mt-3 text-3xl font-bold tracking-tight text-balance sm:text-4xl ${
          dark ? 'text-white' : 'text-slate-900'
        }`}
      >
        {title}
      </h2>
      {intro ? (
        <p className={`mt-5 text-lg leading-8 ${dark ? 'text-slate-300' : 'text-slate-600'}`}>
          {intro}
        </p>
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
    <ul className={`grid gap-5 sm:grid-cols-2 ${columns === 3 ? 'lg:grid-cols-3' : ''}`}>
      {items.map((item) => {
        const inner = (
          <>
            <span className="flex size-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 ring-1 ring-indigo-100">
              <Icon name={item.icon} />
            </span>
            <h3 className="mt-5 font-semibold text-slate-900">{item.title}</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">{item.body}</p>
            {item.href ? (
              <span className="mt-4 inline-block text-sm font-semibold text-indigo-600 group-hover:text-indigo-500">
                Learn more <span aria-hidden="true">→</span>
              </span>
            ) : null}
          </>
        );
        return (
          <li key={item.title} className="flex">
            {item.href ? (
              <a
                href={item.href}
                className={`group flex-1 rounded-2xl bg-white p-6 ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:shadow-lg hover:ring-indigo-200 ${focusRing}`}
              >
                {inner}
              </a>
            ) : (
              <div className="flex-1 rounded-2xl bg-white p-6 ring-1 ring-slate-200">{inner}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** Numbered steps. */
export function Steps({
  steps,
  dark = false,
}: {
  steps: { title: string; body: ReactNode }[];
  dark?: boolean;
}) {
  return (
    <ol className={`grid gap-6 ${steps.length >= 3 ? 'md:grid-cols-3' : 'md:grid-cols-2'}`}>
      {steps.map((step, i) => (
        <li
          key={step.title}
          className={`rounded-2xl p-7 ring-1 ${dark ? 'bg-white/5 ring-white/10' : 'bg-white ring-slate-200'}`}
        >
          <span className="flex size-10 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-sm font-bold text-white">
            {i + 1}
          </span>
          <h3 className={`mt-5 text-lg font-semibold ${dark ? 'text-white' : 'text-slate-900'}`}>
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

/** The closing call to action used at the bottom of every page. */
export function CtaBand({
  title = 'Start selling with Commerce Platform',
  body = 'Create your store, pick a template and add your first product in a few minutes.',
  template,
}: {
  title?: string;
  body?: string;
  /** Template id the sign-up should start with. */
  template?: string;
}) {
  return (
    <section className="px-4 py-20 sm:px-6 sm:py-24">
      <div className="relative isolate mx-auto max-w-6xl overflow-hidden rounded-3xl bg-slate-950 px-6 py-16 text-center text-white sm:px-16">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(40rem_20rem_at_50%_120%,rgb(99_102_241/0.55),transparent),radial-gradient(30rem_16rem_at_0%_0%,rgb(139_92_246/0.35),transparent)]" />
        <h2 className="text-3xl font-bold tracking-tight text-balance sm:text-4xl">{title}</h2>
        <p className="mx-auto mt-4 max-w-xl text-lg text-slate-300">{body}</p>
        <div className="mt-8 flex justify-center">
          <EmailCapture signupUrl={signupUrl} template={template} />
        </div>
        <p className="mt-3 text-sm text-slate-400">Every new store starts with a 14-day trial.</p>
      </div>
    </section>
  );
}

/** A check-marked list. */
export function CheckList({ items, dark = false }: { items: ReactNode[]; dark?: boolean }) {
  return (
    <ul className={`space-y-3 ${dark ? 'text-slate-200' : 'text-slate-700'}`}>
      {items.map((item, i) => (
        <li key={i} className="flex gap-3">
          <svg
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
            className={`mt-1 size-4 shrink-0 ${dark ? 'text-indigo-300' : 'text-indigo-600'}`}
          >
            <path
              fillRule="evenodd"
              d="M16.7 5.3a1 1 0 0 1 0 1.4l-8 8a1 1 0 0 1-1.4 0l-4-4a1 1 0 1 1 1.4-1.4L8 12.58l7.3-7.3a1 1 0 0 1 1.4 0Z"
              clipRule="evenodd"
            />
          </svg>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}
