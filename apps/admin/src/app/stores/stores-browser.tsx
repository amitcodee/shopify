'use client';

import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';
import { Icon } from '@/components/icons';
import { inputClass } from '@/components/ui';

export interface BrowsableStore {
  id: string;
  name: string;
  subdomain: string;
  createdAt: string;
  card: ReactNode;
}

/** The store grid; search and sorting appear once there are enough stores to need them. */
export function StoresBrowser({
  stores,
  trailing,
}: {
  stores: BrowsableStore[];
  /** The tile after the last store (create a store). */
  trailing: ReactNode;
}) {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<'newest' | 'oldest' | 'name'>('newest');
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return stores
      .filter((s) => !q || s.name.toLowerCase().includes(q) || s.subdomain.includes(q))
      .sort((a, b) => {
        if (sort === 'name') return a.name.localeCompare(b.name);
        const order = a.createdAt.localeCompare(b.createdAt);
        return sort === 'newest' ? -order : order;
      });
  }, [stores, query, sort]);

  return (
    <>
      {stores.length > 3 ? (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <label className="relative min-w-52 flex-1 sm:max-w-xs">
            <span className="sr-only">Search stores</span>
            <Icon
              name="search"
              className="pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-slate-500"
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search stores"
              className={`${inputClass} w-full pl-8`}
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            Sort by
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as typeof sort)}
              className={inputClass}
            >
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
              <option value="name">Name</option>
            </select>
          </label>
        </div>
      ) : null}
      {shown.length === 0 ? (
        <p className="rounded-xl border border-slate-200 bg-white px-5 py-8 text-center text-sm text-slate-500">
          No stores match “{query}”.
        </p>
      ) : null}
      <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {shown.map((store) => (
          <li key={store.id} className="min-w-0">
            {store.card}
          </li>
        ))}
        <li className="min-w-0">{trailing}</li>
      </ul>
    </>
  );
}
