'use client';

import { currencyDigits, formatMoney } from '@repo/contracts';
import { useState } from 'react';

interface Day {
  date: string;
  sales: number;
  orders: number;
}

/** A "nice" axis ceiling and step so gridlines land on round amounts. */
function niceScale(max: number, ticks = 4): { top: number; step: number } {
  if (max <= 0) return { top: ticks, step: 1 };
  const raw = max / ticks;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= raw) ?? raw;
  return { top: step * ticks, step };
}

function shortDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1)));
}

/**
 * Daily sales against the period before it, on one axis. Hovering (or arrowing through) a day shows
 * both values in a tooltip; a visually hidden table carries the data for screen readers.
 */
export function SalesTrend({
  current,
  previous,
  currency,
}: {
  current: Day[];
  /** The earlier period, oldest first: each entry is the same-position day of `current`. */
  previous: Day[];
  currency: string;
}) {
  const [active, setActive] = useState<number | null>(null);
  const count = current.length;
  const before = (i: number): Day | undefined => previous[i];
  const max = Math.max(0, ...current.map((d) => d.sales), ...previous.map((d) => d.sales));
  const { top, step } = niceScale(max);
  const ticks = Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);
  const unit = 10 ** currencyDigits(currency);
  const axis = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    notation: 'compact',
    maximumFractionDigits: 1,
  });
  const x = (i: number) => (count > 1 ? (i / (count - 1)) * 100 : 50);
  const y = (value: number) => 100 - (value / top) * 100;
  const line = (values: (number | undefined)[]) =>
    values.flatMap((v, i) => (v === undefined ? [] : [`${x(i)},${y(v)}`])).join(' ');
  const earlier = current.map((_, i) => before(i)?.sales);
  const earlierLine = line(earlier);
  const labelEvery = Math.max(1, Math.ceil(count / 7));
  const day = active === null ? undefined : current[active];
  const earlierDay = active === null ? undefined : before(active);

  return (
    <figure className="min-w-0">
      <div className="flex gap-3">
        <div
          aria-hidden
          className="relative h-56 w-11 shrink-0 text-right text-[11px] text-slate-500 tabular-nums"
        >
          {ticks.map((t) => (
            <span
              key={t}
              className="absolute right-0 translate-y-1/2 leading-none"
              style={{ bottom: `${(t / top) * 100}%` }}
            >
              {max > 0 ? axis.format(t / unit) : t === 0 ? axis.format(0) : ''}
            </span>
          ))}
        </div>
        <div
          role="slider"
          tabIndex={0}
          aria-label="Day in the sales chart"
          aria-valuemin={0}
          aria-valuemax={Math.max(0, count - 1)}
          aria-valuenow={active ?? count - 1}
          aria-valuetext={
            day ? `${shortDate(day.date)}: ${formatMoney(day.sales, currency)}` : undefined
          }
          className="relative h-56 min-w-0 flex-1 touch-pan-y rounded-sm"
          onPointerMove={(event) => {
            const box = event.currentTarget.getBoundingClientRect();
            const ratio = Math.min(1, Math.max(0, (event.clientX - box.left) / box.width));
            setActive(Math.round(ratio * (count - 1)));
          }}
          onPointerLeave={() => setActive(null)}
          onBlur={() => setActive(null)}
          onKeyDown={(event) => {
            if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
            event.preventDefault();
            const move = event.key === 'ArrowLeft' ? -1 : 1;
            setActive((a) => Math.min(count - 1, Math.max(0, (a ?? count - 1) + move)));
          }}
        >
          {ticks.map((t) => (
            <div
              key={t}
              aria-hidden
              className={`absolute inset-x-0 border-t ${t === 0 ? 'border-slate-200' : 'border-dashed border-slate-100'}`}
              style={{ bottom: `${(t / top) * 100}%` }}
            />
          ))}
          {active !== null ? (
            <div
              aria-hidden
              className="absolute inset-y-0 w-6 -translate-x-1/2 rounded-md"
              style={{
                left: `${x(active)}%`,
                background:
                  'linear-gradient(to bottom, transparent, color-mix(in srgb, var(--chart-current) 26%, transparent))',
              }}
            />
          ) : null}
          <svg
            aria-hidden
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            className="absolute inset-0 h-full w-full overflow-visible"
          >
            {earlierLine && count > 1 ? (
              <>
                <polygon
                  points={`0,100 ${earlierLine} 100,100`}
                  style={{ fill: 'color-mix(in srgb, var(--chart-previous) 12%, transparent)' }}
                />
                <polyline
                  points={earlierLine}
                  fill="none"
                  strokeWidth={1.5}
                  strokeDasharray="4 3"
                  vectorEffect="non-scaling-stroke"
                  style={{ stroke: 'var(--chart-previous)' }}
                />
              </>
            ) : null}
            <polyline
              points={line(current.map((d) => d.sales))}
              fill="none"
              strokeWidth={2}
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
              style={{ stroke: 'var(--chart-current)' }}
            />
          </svg>
          {day && active !== null ? (
            <>
              <span
                aria-hidden
                className="absolute h-2.5 w-2.5 -translate-x-1/2 translate-y-1/2 rounded-full ring-2 ring-white"
                style={{
                  left: `${x(active)}%`,
                  bottom: `${100 - y(day.sales)}%`,
                  background: 'var(--chart-current)',
                }}
              />
              <div
                aria-hidden
                className={`pointer-events-none absolute top-2 z-10 w-44 rounded-lg bg-[#18181b] p-2.5 text-xs text-[#fafafa] shadow-raised ${
                  x(active) > 60 ? '-translate-x-[calc(100%+14px)]' : 'translate-x-3.5'
                }`}
                style={{ left: `${x(active)}%` }}
              >
                <p className="mb-1.5 font-medium">{shortDate(day.date)}</p>
                <p className="flex items-center justify-between gap-2 tabular-nums">
                  <span className="flex items-center gap-1.5 text-[#d4d4d8]">
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: '#60a5fa' }} />
                    This period
                  </span>
                  {formatMoney(day.sales, currency)}
                </p>
                {earlierDay ? (
                  <p className="mt-1 flex items-center justify-between gap-2 tabular-nums">
                    <span className="flex items-center gap-1.5 text-[#d4d4d8]">
                      <span className="h-1.5 w-1.5 rounded-full bg-[#a1a1aa]" />
                      Previous
                    </span>
                    {formatMoney(earlierDay.sales, currency)}
                  </p>
                ) : null}
                <p className="mt-1.5 border-t border-[#3f3f46] pt-1.5 text-[#d4d4d8]">
                  {day.orders} {day.orders === 1 ? 'order' : 'orders'}
                </p>
              </div>
            </>
          ) : null}
        </div>
      </div>
      <div aria-hidden className="mt-2 flex gap-3 text-[11px] text-slate-500">
        <div className="w-11 shrink-0" />
        <div className="relative h-4 min-w-0 flex-1">
          {current.map((d, i) =>
            i % labelEvery === 0 && count - 1 - i >= labelEvery / 2 ? (
              <span
                key={d.date}
                className={`absolute whitespace-nowrap ${i === 0 ? '' : '-translate-x-1/2'}`}
                style={{ left: `${x(i)}%` }}
              >
                {shortDate(d.date)}
              </span>
            ) : null,
          )}
          {current.at(-1) ? (
            <span className="absolute right-0 whitespace-nowrap">
              {shortDate(current.at(-1)?.date ?? '')}
            </span>
          ) : null}
        </div>
      </div>
      <table className="sr-only">
        <caption>Daily sales, this period and the one before</caption>
        <thead>
          <tr>
            <th scope="col">Date</th>
            <th scope="col">Sales</th>
            <th scope="col">Previous period</th>
            <th scope="col">Orders</th>
          </tr>
        </thead>
        <tbody>
          {current.map((d, i) => (
            <tr key={d.date}>
              <td>{d.date}</td>
              <td>{formatMoney(d.sales, currency)}</td>
              <td>{formatMoney(before(i)?.sales ?? 0, currency)}</td>
              <td>{d.orders}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
