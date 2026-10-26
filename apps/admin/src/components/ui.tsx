import Link from 'next/link';
import type { ReactNode } from 'react';
import { Icon, type IconName } from './icons';

// ── Buttons ────────────────────────────────────────────────────────────────────

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';
export type ButtonSize = 'sm' | 'md';

const variants: Record<ButtonVariant, string> = {
  primary:
    'bg-indigo-600 text-white shadow-button-primary hover:bg-indigo-500 active:bg-indigo-700 ' +
    'focus-visible:outline-indigo-600',
  secondary:
    'bg-white text-slate-800 shadow-xs ring-1 ring-inset ring-slate-300 hover:bg-slate-50 ' +
    'hover:text-slate-900 active:bg-slate-100 focus-visible:outline-indigo-500',
  danger:
    'bg-red-600 text-white shadow-button-primary hover:bg-red-500 active:bg-red-700 ' +
    'focus-visible:outline-red-600',
  ghost:
    'text-slate-700 hover:bg-slate-900/5 hover:text-slate-900 active:bg-slate-900/10 ' +
    'focus-visible:outline-indigo-500',
};

const sizes: Record<ButtonSize, string> = {
  sm: 'h-8 gap-1.5 px-2.5 text-[13px]',
  md: 'h-9 gap-2 px-3.5 text-sm',
};

export function buttonClass(variant: ButtonVariant = 'primary', size: ButtonSize = 'md'): string {
  return (
    'inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-lg font-medium ' +
    'transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 ' +
    'disabled:pointer-events-none disabled:opacity-55 ' +
    `${sizes[size]} ${variants[variant]}`
  );
}

export function ButtonLink({
  href,
  children,
  variant = 'primary',
  size = 'md',
  icon,
}: {
  href: string;
  children: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: IconName;
}) {
  return (
    <Link href={href} className={buttonClass(variant, size)}>
      {icon ? <Icon name={icon} className="-ml-0.5 h-4 w-4" strokeWidth={2} /> : null}
      {children}
    </Link>
  );
}

/** Inline text link in the accent colour. */
export const linkClass =
  'font-medium text-indigo-600 underline-offset-2 hover:text-indigo-500 hover:underline';

/** Shared look for hand-placed inputs/selects (forms built without <Field>). */
export const inputClass =
  'block rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 shadow-xs ' +
  'placeholder:text-slate-400 transition-colors focus:border-indigo-500 focus:outline-none ' +
  'focus:ring-3 focus:ring-indigo-500/15 disabled:bg-slate-50 disabled:text-slate-500';

// ── Surfaces ───────────────────────────────────────────────────────────────────

export function Card({
  title,
  description,
  children,
  actions,
  flush,
}: {
  title?: string;
  description?: ReactNode;
  children: ReactNode;
  actions?: ReactNode;
  /** Let the body run edge to edge (tables, lists with their own padding). */
  flush?: boolean;
}) {
  return (
    <section className="min-w-0 rounded-xl border border-slate-200/90 bg-white shadow-card">
      {title ? (
        <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 px-5 pt-4 pb-3">
          <div className="min-w-0">
            <h2 className="text-[15px] leading-6 font-semibold text-slate-900">{title}</h2>
            {description ? (
              <p className="mt-0.5 text-[13px] leading-5 text-slate-500">{description}</p>
            ) : null}
          </div>
          {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
        </header>
      ) : null}
      <div
        className={
          flush
            ? title
              ? 'overflow-hidden rounded-b-xl border-t border-slate-100'
              : 'overflow-hidden rounded-xl'
            : title
              ? 'px-5 pt-1 pb-5 [&_[data-table-frame]]:rounded-lg [&_[data-table-frame]]:shadow-none'
              : 'p-5 [&_[data-table-frame]]:rounded-lg [&_[data-table-frame]]:shadow-none'
        }
      >
        {children}
      </div>
    </section>
  );
}

export function PageHeader({
  title,
  description,
  actions,
  back,
  meta,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  back?: { href: string; label: string };
  /** Badges or small status shown beside the title. */
  meta?: ReactNode;
}) {
  return (
    <div className="mb-6">
      {back ? (
        <Link
          href={back.href}
          className="group mb-2 inline-flex items-center gap-1 rounded text-[13px] font-medium text-slate-500 hover:text-slate-900"
        >
          <Icon
            name="chevronLeft"
            className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5"
            strokeWidth={2.25}
          />
          {back.label}
        </Link>
      ) : null}
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h1 className="text-[22px] leading-8 font-semibold tracking-tight text-slate-900 sm:text-2xl">
              {title}
            </h1>
            {meta ? <div className="flex flex-wrap items-center gap-1.5">{meta}</div> : null}
          </div>
          {description ? <p className="mt-1 text-sm text-slate-500">{description}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </div>
  );
}

// ── Feedback ───────────────────────────────────────────────────────────────────

const tones = {
  error: { box: 'border-red-200 bg-red-50 text-red-900', icon: 'text-red-500', name: 'error' },
  success: {
    box: 'border-emerald-200 bg-emerald-50 text-emerald-900',
    icon: 'text-emerald-500',
    name: 'checkCircle',
  },
  warning: {
    box: 'border-amber-200 bg-amber-50 text-amber-950',
    icon: 'text-amber-500',
    name: 'warning',
  },
  info: { box: 'border-sky-200 bg-sky-50 text-sky-950', icon: 'text-sky-500', name: 'info' },
} as const;

export function Alert({ tone, children }: { tone: keyof typeof tones; children: ReactNode }) {
  const t = tones[tone];
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={`flex items-start gap-2.5 rounded-lg border px-3.5 py-3 text-sm leading-5 ${t.box}`}
    >
      <Icon name={t.name} className={`mt-px h-[18px] w-[18px] ${t.icon}`} strokeWidth={2} />
      <div className="min-w-0 flex-1 [overflow-wrap:anywhere]">{children}</div>
    </div>
  );
}

const badgeTones = {
  gray: 'bg-slate-100 text-slate-700 ring-slate-500/15 [--dot:var(--color-slate-400)]',
  green: 'bg-emerald-50 text-emerald-800 ring-emerald-600/20 [--dot:var(--color-emerald-500)]',
  yellow: 'bg-amber-50 text-amber-800 ring-amber-600/25 [--dot:var(--color-amber-500)]',
  red: 'bg-red-50 text-red-700 ring-red-600/20 [--dot:var(--color-red-500)]',
  blue: 'bg-sky-50 text-sky-800 ring-sky-600/20 [--dot:var(--color-sky-500)]',
  indigo: 'bg-indigo-50 text-indigo-700 ring-indigo-600/20 [--dot:var(--color-indigo-500)]',
} as const;

export type BadgeTone = keyof typeof badgeTones;

/** Status pill. The dot is decorative; the text is the status. */
export function Badge({ tone = 'gray', children }: { tone?: BadgeTone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs leading-4 font-medium whitespace-nowrap ring-1 ring-inset ${badgeTones[tone]}`}
    >
      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-(--dot)" />
      {children}
    </span>
  );
}

export function EmptyState({
  title,
  description,
  action,
  icon = 'inbox',
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: IconName;
}) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
      <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-slate-500 ring-1 ring-slate-200/70">
        <Icon name={icon} className="h-5 w-5" />
      </div>
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      {description ? (
        <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">{description}</p>
      ) : null}
      {action ? <div className="mt-5 flex justify-center gap-2">{action}</div> : null}
    </div>
  );
}

// ── Navigation within a page ───────────────────────────────────────────────────

export interface TabItem {
  label: string;
  href: string;
  active: boolean;
  count?: number;
}

/** Saved views / filters: a segmented pill row of links. Scrolls sideways on phones. */
export function ViewTabs({ label, items }: { label: string; items: TabItem[] }) {
  return (
    <nav aria-label={label} className="scrollbar-none -mx-1 max-w-full overflow-x-auto px-1">
      <div className="flex w-max gap-0.5 rounded-lg bg-slate-900/[0.045] p-0.5">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            aria-current={item.active ? 'page' : undefined}
            className={`inline-flex h-7 items-center gap-1.5 rounded-md px-3 text-[13px] font-medium whitespace-nowrap transition-colors ${
              item.active
                ? 'bg-white text-slate-900 shadow-xs ring-1 ring-slate-900/[0.06]'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {item.label}
            {item.count != null ? (
              <span className="text-xs text-slate-400 tabular-nums">{item.count}</span>
            ) : null}
          </Link>
        ))}
      </div>
    </nav>
  );
}

/** Section tabs (sub-pages of an area) with an underline indicator. */
export function UnderlineTabs({ label, items }: { label: string; items: TabItem[] }) {
  return (
    <nav aria-label={label} className="scrollbar-none -mx-1 overflow-x-auto px-1">
      <div className="flex min-w-max gap-5 border-b border-slate-200">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            aria-current={item.active ? 'page' : undefined}
            className={`-mb-px border-b-2 pt-1 pb-2.5 text-sm font-medium whitespace-nowrap transition-colors ${
              item.active
                ? 'border-indigo-600 text-slate-900'
                : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800'
            }`}
          >
            {item.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}

/** A labelled search box for list pages (submits as GET). The top bar's Search focuses it. */
export function SearchInput({
  id,
  label,
  name = 'q',
  defaultValue,
  placeholder,
  className = 'w-full sm:w-64',
}: {
  id: string;
  label: string;
  name?: string;
  defaultValue?: string;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={`relative ${className}`}>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <Icon
        name="search"
        className="pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-slate-400"
        strokeWidth={2}
      />
      <input
        id={id}
        name={name}
        type="search"
        data-page-search
        defaultValue={defaultValue}
        placeholder={placeholder}
        className={`${inputClass} h-8 w-full pl-8`}
      />
    </div>
  );
}

// ── Data display ───────────────────────────────────────────────────────────────

export function Table({
  head,
  children,
  numeric = [],
  bare,
}: {
  head: ReactNode[];
  children: ReactNode;
  /** Column indexes holding numbers: right-aligned with tabular figures. */
  numeric?: number[];
  /** No outer frame, for tables placed inside a <Card flush>. */
  bare?: boolean;
}) {
  return (
    <div
      className={
        bare
          ? 'overflow-x-auto'
          : 'overflow-x-auto rounded-xl border border-slate-200/90 bg-white shadow-card'
      }
      data-table-frame={bare ? undefined : ''}
    >
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50/80">
            {head.map((cell, index) => (
              <th
                key={index}
                scope="col"
                className={`px-4 py-2.5 text-xs font-medium whitespace-nowrap text-slate-500 first:pl-5 last:pr-5 ${
                  numeric.includes(index) ? 'text-right' : 'text-left'
                }`}
              >
                {cell}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 [&>tr]:transition-colors [&>tr:hover]:bg-slate-50/70">
          {children}
        </tbody>
      </table>
    </div>
  );
}

export function Td({
  children,
  className,
  numeric,
}: {
  children: ReactNode;
  className?: string;
  numeric?: boolean;
}) {
  return (
    <td
      className={`px-4 py-3 align-middle text-slate-700 first:pl-5 last:pr-5 ${
        numeric ? 'text-right whitespace-nowrap tabular-nums' : ''
      } ${className ?? ''}`}
    >
      {children}
    </td>
  );
}

/** Small square product image (or a neutral placeholder). */
export function Thumbnail({
  src,
  alt = '',
  size = 40,
}: {
  src?: string | null;
  alt?: string;
  size?: number;
}) {
  return (
    <span
      className="flex shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50 text-slate-300"
      style={{ width: size, height: size }}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={alt} className="h-full w-full object-cover" />
      ) : (
        <Icon name="image" className="h-1/2 w-1/2" />
      )}
    </span>
  );
}

export function Pagination({
  page,
  pageSize,
  total,
  hrefFor,
}: {
  page: number;
  pageSize: number;
  total: number;
  hrefFor: (page: number) => string;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  return (
    <nav
      aria-label="Pagination"
      className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm"
    >
      <span className="text-slate-500 tabular-nums">
        Page {page} of {pages} · {from}–{to} of {total}
      </span>
      <div className="flex gap-2">
        {page > 1 ? (
          <ButtonLink variant="secondary" size="sm" href={hrefFor(page - 1)} icon="chevronLeft">
            Previous
          </ButtonLink>
        ) : null}
        {page < pages ? (
          <Link href={hrefFor(page + 1)} className={buttonClass('secondary', 'sm')}>
            Next
            <Icon name="chevronRight" className="-mr-0.5 h-4 w-4" strokeWidth={2} />
          </Link>
        ) : null}
      </div>
    </nav>
  );
}

export function DescriptionList({ items }: { items: { term: string; detail: ReactNode }[] }) {
  return (
    <dl className="divide-y divide-slate-100">
      {items.map((item) => (
        <div key={item.term} className="grid grid-cols-3 gap-4 py-2.5 text-sm first:pt-0 last:pb-0">
          <dt className="text-slate-500">{item.term}</dt>
          <dd className="col-span-2 min-w-0 text-slate-900 [overflow-wrap:anywhere]">
            {item.detail}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(value),
  );
}
