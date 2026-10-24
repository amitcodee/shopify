import { formatMoney } from '@repo/contracts';

interface Day {
  date: string;
  sales: number;
  orders: number;
}

const WIDTH = 720;
const HEIGHT = 200;
const PAD = { top: 12, right: 8, bottom: 24, left: 8 };
const BAR = 'var(--color-brand-500)'; // #5964f6 — validated: lightness band, chroma, contrast vs white

/**
 * Daily sales bars (single series: the card title names it, so no legend). Each day has a
 * full-height hover target with a native tooltip; a visually hidden table carries the data
 * for screen readers.
 */
export function SalesChart({ days, currency }: { days: Day[]; currency: string }) {
  const max = Math.max(1, ...days.map((d) => d.sales));
  const plotW = WIDTH - PAD.left - PAD.right;
  const plotH = HEIGHT - PAD.top - PAD.bottom;
  const slot = plotW / Math.max(1, days.length);
  const gap = Math.min(2, slot * 0.2);
  const barW = Math.max(1, slot - gap);
  const baseline = PAD.top + plotH;
  const labelEvery = Math.ceil(days.length / 6);

  return (
    <figure>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="h-auto w-full"
        role="img"
        aria-label={`Daily sales over the last ${days.length} days, peaking at ${formatMoney(max, currency)}`}
      >
        <line
          x1={PAD.left}
          x2={WIDTH - PAD.right}
          y1={baseline}
          y2={baseline}
          stroke="#e2e8f0"
          strokeWidth={1}
        />
        <line
          x1={PAD.left}
          x2={WIDTH - PAD.right}
          y1={PAD.top}
          y2={PAD.top}
          stroke="#f1f5f9"
          strokeWidth={1}
          strokeDasharray="4 4"
        />
        <text x={WIDTH - PAD.right} y={PAD.top - 2} textAnchor="end" fontSize={10} fill="#64748b">
          {formatMoney(max, currency)}
        </text>
        {days.map((d, i) => {
          const h = d.sales === 0 ? 0 : Math.max(2, (d.sales / max) * plotH);
          const x = PAD.left + i * slot + gap / 2;
          const r = Math.min(4, barW / 2, h);
          // Rounded data-end on top, square at the baseline.
          const path =
            h === 0
              ? ''
              : `M${x},${baseline} V${baseline - h + r} Q${x},${baseline - h} ${x + r},${baseline - h} H${x + barW - r} Q${x + barW},${baseline - h} ${x + barW},${baseline - h + r} V${baseline} Z`;
          return (
            <g key={d.date} className="group">
              <rect
                x={PAD.left + i * slot}
                y={PAD.top}
                width={slot}
                height={plotH}
                rx={3}
                className="fill-transparent group-hover:fill-slate-100"
              />
              {path ? <path d={path} fill={BAR} className="pointer-events-none" /> : null}
              <rect
                x={PAD.left + i * slot}
                y={PAD.top}
                width={slot}
                height={plotH}
                fill="transparent"
              >
                <title>{`${d.date}: ${formatMoney(d.sales, currency)} · ${d.orders} order${d.orders === 1 ? '' : 's'}`}</title>
              </rect>
              {i % labelEvery === 0 ? (
                <text
                  x={x + barW / 2}
                  y={HEIGHT - 6}
                  textAnchor="middle"
                  fontSize={10}
                  fill="#64748b"
                >
                  {d.date.slice(5)}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
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
