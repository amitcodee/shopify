'use client';

import type { ProductSort } from '@repo/contracts';
import Form from 'next/form';

const SORT_LABELS: Record<ProductSort, string> = {
  newest: 'Newest',
  'price-asc': 'Price: low to high',
  'price-desc': 'Price: high to low',
  title: 'Name',
};

/**
 * Sort and "in stock only" for a product listing. A plain GET form, so it works without
 * JavaScript (via the Apply button); with it, each change submits straight away. Changing
 * either goes back to page one, since the page number is not part of the form.
 */
export function CatalogToolbar({
  action,
  sort,
  inStock,
  keep = {},
}: {
  action: string;
  sort: ProductSort;
  inStock: boolean;
  /** Other query parameters to carry over (e.g. the search text). */
  keep?: Record<string, string>;
}) {
  const submit = (e: { currentTarget: HTMLInputElement | HTMLSelectElement }) =>
    e.currentTarget.form?.requestSubmit();
  return (
    <Form
      action={action}
      className="flex w-full flex-wrap items-center justify-between gap-x-4 gap-y-3 text-sm sm:w-auto sm:justify-end sm:gap-x-6"
      aria-label="Filter and sort"
    >
      {Object.entries(keep).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <label className="flex cursor-pointer items-center gap-2.5 text-zinc-700">
        {/* A real (invisible) checkbox over the switch track, so it stays clickable and focusable. */}
        <span className="relative inline-flex h-5 w-9 shrink-0">
          <input
            type="checkbox"
            name="inStock"
            value="true"
            defaultChecked={inStock}
            onChange={submit}
            className="peer absolute inset-0 z-10 m-0 h-full w-full cursor-pointer appearance-none rounded-full opacity-0"
          />
          <span
            aria-hidden="true"
            className="pointer-events-none relative h-5 w-9 rounded-full bg-zinc-300 transition peer-checked:bg-zinc-900 peer-focus-visible:ring-2 peer-focus-visible:ring-accent peer-focus-visible:ring-offset-2 after:absolute after:left-0.5 after:top-0.5 after:size-4 after:rounded-full after:bg-white after:shadow-sm after:transition-transform peer-checked:after:translate-x-4"
          />
        </span>
        In stock only
      </label>
      <div className="flex items-center gap-2">
        <label htmlFor="sort" className="sr-only text-zinc-500 sm:not-sr-only">
          Sort by
        </label>
        <select
          id="sort"
          name="sort"
          defaultValue={sort}
          onChange={submit}
          className="h-10 rounded-md border border-zinc-300 bg-page px-3 pr-8 text-zinc-900"
        >
          {Object.entries(SORT_LABELS).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </div>
      <noscript>
        <button type="submit" className="btn px-4 py-2 text-sm">
          Apply
        </button>
      </noscript>
    </Form>
  );
}
