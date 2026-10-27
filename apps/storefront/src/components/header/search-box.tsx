'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useId, useRef, useState } from 'react';
import type { Suggestion } from '@/app/(store)/search/suggest/route';

/**
 * The header search field with suggestions as you type (from /search/suggest). Arrow keys pick a
 * product and Enter opens it; Enter with nothing picked submits the form to the full search page
 * as before, so it works without JavaScript too.
 */
export function SearchBox({ className }: { className: string }) {
  const router = useRouter();
  const listId = useId();
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<Suggestion[]>([]);
  const [total, setTotal] = useState(0);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [loading, setLoading] = useState(false);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/search/suggest?q=${encodeURIComponent(q)}`, {
          signal: controller.signal,
        });
        const data = (await res.json()) as { items: Suggestion[]; total?: number };
        setItems(data.items);
        setTotal(data.total ?? data.items.length);
        setActive(-1);
      } catch {
        // Aborted or offline: keep the previous suggestions.
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 180);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  const searchHref = `/search?q=${encodeURIComponent(query.trim())}`;
  const showing = open && query.trim().length >= 2 && (items.length > 0 || !loading);
  const rows = items.length; // the "see all" row sits at index `rows`

  return (
    <>
      <input
        id="site-search"
        name="q"
        type="search"
        placeholder="Search"
        autoComplete="off"
        aria-autocomplete="list"
        aria-controls={listId}
        aria-activedescendant={showing && active >= 0 ? `${listId}-${active}` : undefined}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          if (e.target.value.trim().length < 2) setItems([]);
        }}
        onFocus={() => {
          if (blurTimer.current) clearTimeout(blurTimer.current);
          setOpen(true);
        }}
        onBlur={() => {
          blurTimer.current = setTimeout(() => setOpen(false), 120);
        }}
        onKeyDown={(e) => {
          if (!showing) return;
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActive((a) => (a + 1 > rows ? 0 : a + 1));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActive((a) => (a - 1 < 0 ? rows : a - 1));
          } else if (e.key === 'Escape') {
            setOpen(false);
          } else if (e.key === 'Enter' && active >= 0 && active < rows) {
            e.preventDefault();
            setOpen(false);
            router.push(items[active]!.href);
          }
        }}
        className={className}
      />
      {showing ? (
        <div className="dropdown-panel absolute top-full right-0 left-0 z-50 mt-2 min-w-72 overflow-hidden rounded-[var(--store-button-radius)] border border-zinc-200 bg-white shadow-[0_18px_40px_-16px_rgb(0_0_0/0.3)]">
          <ul id={listId} role="listbox" aria-label="Suggestions" className="py-1.5">
            {items.length === 0 ? (
              <li className="px-4 py-3 text-sm text-zinc-500">No products match “{query}”.</li>
            ) : (
              items.map((item, i) => (
                <li
                  key={item.href}
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={active === i}
                >
                  <Link
                    href={item.href}
                    tabIndex={-1}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => setOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2 text-sm ${active === i ? 'bg-zinc-100' : ''}`}
                  >
                    <span className="size-10 shrink-0 overflow-hidden rounded bg-zinc-100">
                      {item.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={item.imageUrl} alt="" className="h-full w-full object-cover" />
                      ) : null}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-zinc-900">{item.title}</span>
                      <span className="block text-xs text-zinc-500">
                        {item.price}
                        {item.available ? '' : ' · Sold out'}
                      </span>
                    </span>
                  </Link>
                </li>
              ))
            )}
            <li id={`${listId}-${rows}`} role="option" aria-selected={active === rows}>
              <Link
                href={searchHref}
                tabIndex={-1}
                onMouseEnter={() => setActive(rows)}
                onClick={() => setOpen(false)}
                className={`mt-1 flex items-center justify-between border-t border-zinc-100 px-4 py-2.5 text-sm font-medium text-zinc-700 ${active === rows ? 'bg-zinc-100' : ''}`}
              >
                <span className="truncate">
                  {total > items.length ? `See all ${total} results` : 'See all results'} for “
                  {query.trim()}”
                </span>
                <span aria-hidden="true">→</span>
              </Link>
            </li>
          </ul>
        </div>
      ) : null}
    </>
  );
}
