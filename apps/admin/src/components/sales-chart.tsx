import { currencyDigits, formatMoney } from '@repo/contracts';

interface Day {
  date: string;
  sales: number;
  orders: number;
}

/** A "nice" axis ceiling and step (1/2/2.5/5 × 10^k) so gridlines land on round amounts. */
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
 * Daily sales bars (single series: the card title names it, so no legend). Drawn with HTML so
 * axis text stays crisp at any width. Each day has a native tooltip; a visually hidden table
 * carries the data for screen readers.
 */
export function SalesChart({ days, currency }: { days: Day[]; currency: string }) {
  const max = Math.max(0, ...days.map((d) => d.sales));
  const { top, step } = niceScale(max);
  const ticks = Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);
  const unit = 10 ** currencyDigits(currency);
  const axis = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    notation: 'compact',
    maximumFractionDigits: 1,
  });
  const labelEvery = Math.max(1, Math.ceil(days.length / 6));
  const peak = days.reduce<Day | undefined>(
    (best, d) => (!best || d.sales > best.sales ? d : best),
    undefined,
  );

  return (
    <figure>
      <div
        className="flex gap-3"
        role="img"
        aria-label={`Daily sales over the last ${days.length} days${peak && peak.sales > 0 ? `, peaking at ${formatMoney(peak.sales, currency)} on ${shortDate(peak.date)}` : ''}`}
      >
        <div
          aria-hidden
          className="relative h-52 w-12 shrink-0 text-right text-[11px] text-slate-400 tabular-nums"
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
        <div aria-hidden className="relative h-52 min-w-0 flex-1">
          {ticks.map((t) => (
            <div
              key={t}
              className={`absolute inset-x-0 border-t ${t === 0 ? 'border-slate-300' : 'border-dashed border-slate-200'}`}
              style={{ bottom: `${(t / top) * 100}%` }}
            />
          ))}
          <div className="absolute inset-0 flex items-end gap-[2px] sm:gap-[3px]">
            {days.map((d, i) => (
              <div
                key={d.date}
                title={`${shortDate(d.date)}: ${formatMoney(d.sales, currency)} · ${d.orders} order${d.orders === 1 ? '' : 's'}`}
                className="group flex h-full min-w-0 flex-1 items-end rounded-t-[3px] hover:bg-slate-900/[0.035]"
              >
                <div
                  className="chart-bar w-full rounded-t-[3px] bg-indigo-500 transition-colors group-hover:bg-indigo-600"
                  style={{
                    height: d.sales > 0 ? `max(2px, ${(d.sales / top) * 100}%)` : '0',
                    animationDelay: `${Math.min(i * 12, 360)}ms`,
                  }}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
      <div aria-hidden className="mt-2 flex gap-3 text-[11px] text-slate-400">
        <div className="w-12 shrink-0" />
        <div className="relative h-4 min-w-0 flex-1">
          {days.map((d, i) =>
            i % labelEvery === 0 || i === days.length - 1 ? (
              <span
                key={d.date}
                className={`absolute whitespace-nowrap ${i === days.length - 1 ? 'right-0' : '-translate-x-1/2'} ${
                  i !== days.length - 1 && days.length - 1 - i < labelEvery / 2 ? 'hidden' : ''
                }`}
                style={
                  i === days.length - 1
                    ? undefined
                    : { left: `${((i + 0.5) / days.length) * 100}%` }
                }
              >
                {i === 0 ? '' : shortDate(d.date)}
              </span>
            ) : null,
          )}
          <span className="absolute left-0 whitespace-nowrap">
            {days[0] ? shortDate(days[0].date) : ''}
          </span>
        </div>
      </div>
      <table className="sr-only">
        <caption>Daily sales</caption>
        <thead>
          <tr>
            <th scope="col">Date</th>
            <th scope="col">Sales</th>
            <th scope="col">Orders</th>
          </tr>
        </thead>
        <tbody>
          {days.map((d) => (
            <tr key={d.date}>
              <td>{d.date}</td>
              <td>{formatMoney(d.sales, currency)}</td>
              <td>{d.orders}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
