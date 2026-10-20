'use client';

import { usePathname, useRouter } from 'next/navigation';

const LABELS = {
  newest: 'Newest',
  'price-asc': 'Price: low to high',
  'price-desc': 'Price: high to low',
  title: 'Name',
} as const;

export function SortSelect({ value }: { value: keyof typeof LABELS }) {
  const router = useRouter();
  const pathname = usePathname();
  return (
    <div className="flex items-center gap-2 text-sm">
      <label htmlFor="sort">Sort by</label>
      <select
        id="sort"
        value={value}
        onChange={(e) => router.push(`${pathname}?sort=${e.target.value}`)}
        className="rounded-md border border-zinc-300 px-3 py-1.5"
      >
        {Object.entries(LABELS).map(([key, label]) => (
          <option key={key} value={key}>
            {label}
          </option>
        ))}
      </select>
    </div>
  );
}
