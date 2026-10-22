import type { ThemeSettings } from '@repo/contracts';

const ICON = {
  className: 'h-6 w-6 shrink-0',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  viewBox: '0 0 24 24',
  'aria-hidden': true,
} as const;

const ICONS = [
  // Lock
  <svg key="lock" {...ICON}>
    <rect x="4.5" y="10.5" width="15" height="10" rx="2" />
    <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
    <path d="M12 14.5v2" />
  </svg>,
  // Delivery truck
  <svg key="truck" {...ICON}>
    <path d="M2.5 6.5h11v10h-11z" />
    <path d="M13.5 9.5h4l3 3.5v3.5h-7" />
    <circle cx="6.5" cy="17.5" r="1.75" />
    <circle cx="17" cy="17.5" r="1.75" />
  </svg>,
  // Chat bubble
  <svg key="chat" {...ICON}>
    <path d="M20.5 11.5a7.5 7 0 0 1-10.6 6.4L4 19.5l1.4-4.2A6.8 6.8 0 0 1 3.5 11.5a8.5 7 0 0 1 17 0z" />
    <path d="M8.5 11.5h.01M12 11.5h.01M15.5 11.5h.01" strokeWidth={2.25} />
  </svg>,
];

/** Three short reassurances under the hero (secure checkout, tracking, support). */
export function TrustBar({ theme }: { theme: ThemeSettings }) {
  const items = [theme.trustItem1, theme.trustItem2, theme.trustItem3]
    .map((text, i) => ({ text, icon: ICONS[i] }))
    .filter((item) => item.text);
  if (items.length === 0) return null;
  const columns =
    items.length === 3 ? 'sm:grid-cols-3' : items.length === 2 ? 'sm:grid-cols-2' : '';
  return (
    <section aria-label="Why shop with us" className="store-section">
      <ul
        className={`grid gap-px overflow-hidden rounded-xl border border-zinc-200 bg-zinc-200 ${columns}`}
      >
        {items.map((item) => (
          <li
            key={item.text}
            className="flex items-center gap-3 bg-page px-5 py-4 text-sm font-medium sm:justify-center sm:py-5"
          >
            <span className="text-accent">{item.icon}</span>
            <span className="min-w-0 break-words">{item.text}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
