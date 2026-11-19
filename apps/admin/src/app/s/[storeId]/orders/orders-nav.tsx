import Link from 'next/link';

const SECTIONS = [
  { key: 'orders', label: 'All orders', path: '' },
  { key: 'drafts', label: 'Drafts', path: '/drafts' },
  { key: 'abandoned', label: 'Abandoned checkouts', path: '/abandoned' },
  { key: 'returns', label: 'Returns', path: '/returns' },
  { key: 'gst', label: 'GST returns', path: '/gst' },
] as const;

export type OrdersSection = (typeof SECTIONS)[number]['key'];

/** Switches between the order areas; shown under the header on each of them. */
export function OrdersNav({ storeId, active }: { storeId: string; active: OrdersSection }) {
  const base = `/s/${storeId}/orders`;
  return (
    <nav
      aria-label="Order sections"
      className="-mt-2 mb-5 flex gap-1 overflow-x-auto overflow-y-hidden border-b border-slate-200 [scrollbar-width:none]"
    >
      {SECTIONS.map((s) => {
        const current = s.key === active;
        return (
          <Link
            key={s.key}
            href={`${base}${s.path}`}
            aria-current={current ? 'page' : undefined}
            className={`-mb-px shrink-0 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 ${
              current
                ? 'border-indigo-600 text-slate-900'
                : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800'
            }`}
          >
            {s.label}
          </Link>
        );
      })}
    </nav>
  );
}
