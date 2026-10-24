import Link from 'next/link';
import type { ReactNode } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

const variants: Record<ButtonVariant, string> = {
  primary:
    'bg-brand-600 text-white shadow-sm shadow-brand-900/20 hover:bg-brand-700 ' +
    'focus-visible:outline-brand-600',
  secondary:
    'bg-white text-slate-800 shadow-sm ring-1 ring-inset ring-slate-300/80 hover:bg-slate-50 ' +
    'hover:text-slate-900 focus-visible:outline-slate-400',
  danger: 'bg-red-600 text-white shadow-sm hover:bg-red-700 focus-visible:outline-red-600',
  ghost: 'text-slate-600 hover:bg-slate-900/5 hover:text-slate-900 focus-visible:outline-slate-400',
};

export function buttonClass(variant: ButtonVariant = 'primary'): string {
  return (
    'inline-flex h-9 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-3.5 ' +
    'text-sm font-medium transition-colors duration-150 focus-visible:outline-2 ' +
    'focus-visible:outline-offset-2 disabled:pointer-events-none disabled:opacity-55 ' +
    variants[variant]
  );
}

export function ButtonLink({
  href,
  children,
  variant = 'primary',
}: {
  href: string;
  children: ReactNode;
  variant?: ButtonVariant;
}) {
  return (
    <Link href={href} className={buttonClass(variant)}>
      {children}
    </Link>
  );
}

export function Card({
  title,
  description,
  children,
  actions,
}: {
  title?: string;
  description?: ReactNode;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <section className="rounded-xl bg-white shadow-card ring-1 ring-slate-900/[0.06]">
      {title ? (
        <header className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-[15px] font-semibold tracking-tight text-slate-900">{title}</h2>
            {description ? (
              <p className="mt-0.5 text-sm leading-relaxed text-slate-500">{description}</p>
            ) : null}
          </div>
          {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
        </header>
      ) : null}
      <div className="px-5 py-5">{children}</div>
    </section>
  );
}

export function PageHeader({
  title,
  description,
  actions,
  back,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  back?: { href: string; label: string };
}) {
  return (
    <div className="mb-7">
      {back ? (
        <Link
          href={back.href}
          className="group mb-2 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-900"
        >
          <span
            aria-hidden
            className="grid size-5 place-items-center rounded-md bg-white text-xs shadow-sm ring-1 ring-slate-900/10 transition group-hover:-translate-x-0.5"
          >
            ←
          </span>
          {back.label}
        </Link>
      ) : null}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-950 sm:text-[28px]">
            {title}
          </h1>
          {description ? (
            <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-slate-500">{description}</p>
          ) : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </div>
  );
}

const tones = {
  error: { box: 'border-red-200/80 bg-red-50 text-red-900', icon: 'bg-red-500', glyph: '!' },
  success: {
    box: 'border-emerald-200/80 bg-emerald-50 text-emerald-900',
    icon: 'bg-emerald-500',
    glyph: '✓',
  },
  warning: {
    box: 'border-amber-200/80 bg-amber-50 text-amber-950',
    icon: 'bg-amber-500',
    glyph: '!',
  },
  info: { box: 'border-sky-200/80 bg-sky-50 text-sky-950', icon: 'bg-sky-500', glyph: 'i' },
} as const;

export function Alert({ tone, children }: { tone: keyof typeof tones; children: ReactNode }) {
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={`flex gap-3 rounded-xl border px-4 py-3 text-sm leading-relaxed ${tones[tone].box}`}
    >
      <span
        aria-hidden
        className={`mt-0.5 grid size-[18px] shrink-0 place-items-center rounded-full text-[11px] font-bold text-white ${tones[tone].icon}`}
      >
        {tones[tone].glyph}
      </span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

const badgeTones = {
  gray: 'bg-slate-100 text-slate-700 ring-slate-500/15 before:bg-slate-400',
  green: 'bg-emerald-50 text-emerald-800 ring-emerald-600/20 before:bg-emerald-500',
  yellow: 'bg-amber-50 text-amber-800 ring-amber-600/25 before:bg-amber-500',
  red: 'bg-red-50 text-red-800 ring-red-600/20 before:bg-red-500',
  blue: 'bg-sky-50 text-sky-800 ring-sky-600/20 before:bg-sky-500',
  indigo: 'bg-brand-50 text-brand-800 ring-brand-600/20 before:bg-brand-500',
} as const;

export type BadgeTone = keyof typeof badgeTones;

export function Badge({ tone = 'gray', children }: { tone?: BadgeTone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset before:size-1.5 before:rounded-full before:content-[''] ${badgeTones[tone]}`}
    >
      {children}
    </span>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white/60 px-6 py-14 text-center">
      <div
        aria-hidden
        className="mx-auto mb-4 grid size-12 place-items-center rounded-2xl bg-gradient-to-b from-brand-50 to-brand-100 text-brand-600 ring-1 ring-brand-200/70"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.7}
          className="size-6"
        >
          <path d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5v-9Z" strokeLinejoin="round" />
          <path d="m3 7.5 9 4.5 9-4.5M12 12v9" strokeLinejoin="round" />
        </svg>
      </div>
      <h3 className="text-[15px] font-semibold text-slate-900">{title}</h3>
      {description ? (
        <p className="mx-auto mt-1 max-w-sm text-sm leading-relaxed text-slate-500">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function Table({ head, children }: { head: ReactNode[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-xl bg-white shadow-card ring-1 ring-slate-900/[0.06]">
      <table className="min-w-full divide-y divide-slate-200/80 text-sm">
        <thead className="bg-slate-50/80">
          <tr>
            {head.map((cell, index) => (
              <th
                key={index}
                scope="col"
                className="whitespace-nowrap px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-500"
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

export function Td({ children, className }: { children: ReactNode; className?: string }) {
  return <td className={`px-4 py-3 align-middle text-slate-700 ${className ?? ''}`}>{children}</td>;
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
  return (
    <nav aria-label="Pagination" className="mt-4 flex items-center justify-between text-sm">
      <span className="text-slate-500">
        Page <span className="font-medium text-slate-900">{page}</span> of {pages} ·{' '}
        <span className="tabular">{total}</span> total
      </span>
      <div className="flex gap-2">
        {page > 1 ? (
          <ButtonLink variant="secondary" href={hrefFor(page - 1)}>
            Previous
          </ButtonLink>
        ) : null}
        {page < pages ? (
          <ButtonLink variant="secondary" href={hrefFor(page + 1)}>
            Next
          </ButtonLink>
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
          <dd className="col-span-2 font-medium text-slate-900">{item.detail}</dd>
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
