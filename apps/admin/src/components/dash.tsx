import Link from 'next/link';
import type { ReactNode } from 'react';
import { Icon, type IconName } from './icons';

/** The small square arrow that opens the full page behind a card. */
export function CornerLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      aria-label={label}
      className="relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 transition-colors hover:bg-slate-900 hover:text-white"
    >
      <Icon name="arrowUpRight" className="h-3.5 w-3.5" strokeWidth={2} />
    </Link>
  );
}

function PanelLabel({ icon, children }: { icon: IconName; children: ReactNode }) {
  return (
    <span className="flex min-w-0 items-center gap-2 text-xs font-semibold tracking-wide text-slate-700 uppercase">
      <Icon name={icon} className="h-4 w-4 shrink-0 text-slate-500" />
      <span className="truncate">{children}</span>
    </span>
  );
}

/** A dashboard card: icon + small caps label, optional controls, then content. */
export function DashPanel({
  icon,
  title,
  actions,
  href,
  hrefLabel,
  children,
  className = '',
}: {
  icon: IconName;
  title: string;
  actions?: ReactNode;
  href?: string;
  hrefLabel?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`flex min-w-0 flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-card ${className}`}
    >
      <header className="mb-3 flex min-h-7 items-center justify-between gap-3">
        <h2 className="min-w-0">
          <PanelLabel icon={icon}>{title}</PanelLabel>
        </h2>
        <div className="flex shrink-0 items-center gap-2">
          {actions}
          {href ? <CornerLink href={href} label={hrefLabel ?? `Open ${title}`} /> : null}
        </div>
      </header>
      {children}
    </section>
  );
}

/** A headline number in a double frame: label on the tinted outer card, value on the inner one. */
export function KpiCard({
  icon,
  label,
  value,
  unit,
  footer,
  href,
}: {
  icon: IconName;
  label: string;
  value: ReactNode;
  unit?: string;
  footer?: ReactNode;
  href?: string;
}) {
  return (
    <div className="min-w-0 rounded-xl border border-slate-200 bg-slate-50 p-1 shadow-card">
      <div className="px-2.5 py-2">
        <PanelLabel icon={icon}>{label}</PanelLabel>
      </div>
      <div className="rounded-lg border border-slate-200/80 bg-white p-3">
        <div className="flex items-start justify-between gap-2">
          <p className="min-w-0 text-[22px] leading-8 font-semibold tracking-tight break-words text-slate-900 tabular-nums">
            {value}
            {unit ? (
              <span className="ml-1.5 text-sm font-medium tracking-normal text-slate-500">
                {unit}
              </span>
            ) : null}
          </p>
          {href ? <CornerLink href={href} label={`Open ${label}`} /> : null}
        </div>
        {footer ? <div className="mt-2 text-xs text-slate-500">{footer}</div> : null}
      </div>
    </div>
  );
}

/** Change vs an earlier period; `value` is a fraction, null when there is nothing to compare. */
export function TrendPill({ value }: { value: number }) {
  const pct = Math.round(value * 1000) / 10;
  const flat = Math.abs(pct) < 0.5;
  const up = pct > 0;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium tabular-nums ${
        flat
          ? 'bg-slate-100 text-slate-600'
          : up
            ? 'bg-emerald-50 text-emerald-700'
            : 'bg-red-50 text-red-700'
      }`}
    >
      {flat ? null : (
        <Icon name={up ? 'trendUp' : 'trendDown'} className="h-3 w-3" strokeWidth={2.25} />
      )}
      {flat ? '0%' : `${Math.abs(pct)}%`}
      <span className="sr-only">{flat ? 'unchanged' : up ? 'increase' : 'decrease'}</span>
    </span>
  );
}

/** Overlapping initials for a team; names come from the title and a screen-reader list. */
export function AvatarStack({
  names,
  extra = 0,
  size = 'md',
}: {
  names: string[];
  /** People not drawn, shown as "+n". */
  extra?: number;
  size?: 'sm' | 'md';
}) {
  const box = size === 'sm' ? 'h-6 w-6 text-[10px]' : 'h-8 w-8 text-xs';
  const circle = `flex ${box} items-center justify-center rounded-full font-semibold ring-2 ring-white`;
  const shades = [
    'bg-slate-900 text-white',
    'bg-slate-500 text-white',
    'bg-slate-200 text-slate-800',
    'bg-slate-700 text-white',
    'bg-slate-300 text-slate-800',
  ];
  return (
    <span className="flex -space-x-1.5">
      {names.map((name, i) => (
        <span
          key={`${name}-${i}`}
          title={name}
          className={`${circle} ${shades[i % shades.length]}`}
        >
          <span aria-hidden>{(name.trim()[0] ?? '?').toUpperCase()}</span>
          <span className="sr-only">{name}</span>
        </span>
      ))}
      {extra > 0 ? <span className={`${circle} bg-slate-100 text-slate-700`}>+{extra}</span> : null}
    </span>
  );
}
