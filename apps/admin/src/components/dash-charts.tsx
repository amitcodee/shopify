import { currencyDigits, formatMoney } from '@repo/contracts';

/** One hue, dark to light: the best seller is darkest. */
const SHADES = ['#18181b', '#52525b', '#a1a1aa'];
const REST = '#d4d4d8';
const EMPTY = 'var(--color-slate-100)';

/**
 * A half-circle of capsules, filled in proportion to each product's share of revenue. Decorative:
 * the list beside it carries every value.
 */
export function ShareGauge({
  shares,
  total,
  label,
}: {
  shares: number[];
  total: string;
  label: string;
}) {
  const count = 21;
  const sum = shares.reduce((a, b) => a + b, 0);
  const colors: string[] = [];
  let used = 0;
  shares.forEach((share, i) => {
    used += share;
    const until = sum > 0 ? Math.round((used / sum) * count) : 0;
    while (colors.length < until) colors.push(SHADES[i] ?? REST);
  });
  return (
    <div className="relative mx-auto w-full max-w-[250px]">
      <svg viewBox="0 0 200 108" aria-hidden className="block w-full">
        {Array.from({ length: count }, (_, i) => {
          const angle = -90 + (i / (count - 1)) * 180;
          return (
            <rect
              key={angle}
              x={95.5}
              y={6}
              width={9}
              height={36}
              rx={4.5}
              transform={`rotate(${angle} 100 100)`}
              style={{ fill: colors[i] ?? EMPTY }}
            />
          );
        })}
      </svg>
      <div className="absolute inset-x-0 bottom-0 text-center">
        <p className="text-lg leading-6 font-semibold tracking-tight text-slate-900 tabular-nums">
          {total}
        </p>
        <p className="text-[11px] text-slate-500">{label}</p>
      </div>
    </div>
  );
}

export function shareColor(index: number): string {
  return SHADES[index] ?? REST;
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** Monday-first weekday index of a `YYYY-MM-DD` date. */
function weekday(iso: string): number {
  return (new Date(`${iso}T00:00:00Z`).getUTCDay() + 6) % 7;
}

interface Day {
  date: string;
  sales: number;
  orders: number;
}

/** Sales per weekday as striped bars, with the best day darkest and every bar labelled. */
export function WeekdayBars({ days, currency }: { days: Day[]; currency: string }) {
  const totals = WEEKDAYS.map(() => 0);
  for (const d of days) totals[weekday(d.date)]! += d.sales;
  const max = Math.max(0, ...totals);
  const compact = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    notation: 'compact',
    maximumFractionDigits: 1,
  });
  return (
    <div>
      <div className="flex h-44 items-end gap-1 border-b border-slate-200">
        {totals.map((total, i) => {
          const name = WEEKDAYS[i];
          return (
            <div
              key={name}
              title={`${name}: ${formatMoney(total, currency)}`}
              className="flex h-full min-w-0 flex-1 flex-col justify-end"
            >
              <span className="mb-1 truncate text-center text-[10px] font-medium text-slate-600 tabular-nums">
                {total > 0 ? compact.format(total / 10 ** currencyDigits(currency)) : ''}
              </span>
              <div
                className={`bar-hatch rounded-t-[4px] ${total === max && max > 0 ? 'text-slate-900' : 'text-slate-300'}`}
                style={{ height: total > 0 ? `max(3px, ${(total / max) * 82}%)` : 0 }}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-1.5 flex gap-1 text-center text-[11px] text-slate-500">
        {WEEKDAYS.map((name) => (
          <span key={name} className="min-w-0 flex-1">
            {name}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Orders per day for the latest weeks, one row per week. */
export function OrderHeatmap({ days, weeks = 5 }: { days: Day[]; weeks?: number }) {
  const byDate = new Map(days.map((d) => [d.date, d.orders]));
  const last = days.at(-1)?.date;
  if (!last) return null;
  const lastDate = new Date(`${last}T00:00:00Z`);
  const lastMonday = new Date(lastDate.getTime() - weekday(last) * 86_400_000);
  const rows = Array.from({ length: weeks }, (_, r) => {
    const monday = new Date(lastMonday.getTime() - (weeks - 1 - r) * 7 * 86_400_000);
    return {
      label: new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        timeZone: 'UTC',
      }).format(monday),
      cells: WEEKDAYS.map((_, c) => {
        const iso = new Date(monday.getTime() + c * 86_400_000).toISOString().slice(0, 10);
        return { iso, orders: byDate.get(iso) };
      }),
    };
  }).filter((row) => row.cells.some((c) => c.orders !== undefined));
  const max = Math.max(1, ...days.map((d) => d.orders));
  const shade = (orders: number) => {
    if (orders === 0) return 'bg-slate-100 text-slate-500';
    const level = orders / max;
    if (level > 0.66) return 'bg-slate-900 text-white';
    if (level > 0.33) return 'bg-slate-500 text-white';
    return 'bg-slate-300 text-slate-900';
  };
  return (
    <div className="grid grid-cols-[3rem_repeat(7,minmax(0,1fr))] items-center gap-1 text-[11px] text-slate-500">
      <span />
      {WEEKDAYS.map((name) => (
        <span key={name} className="text-center">
          {name.slice(0, 2)}
        </span>
      ))}
      {rows.map((row) => (
        <div key={row.label} className="contents">
          <span className="whitespace-nowrap">{row.label}</span>
          {row.cells.map((cell) =>
            cell.orders === undefined ? (
              <span key={cell.iso} className="h-7" />
            ) : (
              <span
                key={cell.iso}
                title={`${cell.iso}: ${cell.orders} ${cell.orders === 1 ? 'order' : 'orders'}`}
                className={`flex h-7 items-center justify-center rounded-[4px] text-[11px] font-medium tabular-nums ${shade(cell.orders)}`}
              >
                {cell.orders > 0 ? cell.orders : <span className="sr-only">0</span>}
              </span>
            ),
          )}
        </div>
      ))}
    </div>
  );
}
