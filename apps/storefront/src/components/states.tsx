'use client';

import Link from 'next/link';
import { useEffect } from 'react';

/**
 * Loading placeholder for store pages: a title and a product grid. Built from the zinc greys,
 * which themed stores remap to their own text/background colors, so it suits every theme.
 */
export function StoreSkeleton() {
  return (
    <div role="status" aria-live="polite">
      <span className="sr-only">Loading…</span>
      <div aria-hidden="true">
        <div className="skeleton h-3 w-24 rounded" />
        <div className="skeleton mt-4 h-9 w-72 max-w-[70vw] rounded" />
        <ul className="mt-10 grid grid-cols-2 gap-x-4 gap-y-8 sm:gap-x-6 lg:grid-cols-4">
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
            <li key={i}>
              <div className="skeleton aspect-square rounded-lg" />
              <div className="skeleton mt-4 h-3.5 w-3/4 rounded" />
              <div className="skeleton mt-2 h-3.5 w-1/3 rounded" />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/** Error boundary fallback for storefront and marketing pages, with a retry. */
export function StoreErrorState({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  const digest =
    error instanceof Error && 'digest' in error && typeof error.digest === 'string'
      ? error.digest
      : null;

  return (
    <div role="alert" className="mx-auto max-w-md px-4 py-20 text-center sm:py-28">
      <p className="eyebrow text-zinc-500">Error</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-900">
        Something went wrong
      </h1>
      <p className="mt-3 text-zinc-600">
        This page couldn’t load. It may be a temporary problem — please try again.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <button type="button" onClick={() => retry()} className="btn min-h-11 px-6 text-sm">
          Try again
        </button>
        <Link
          href="/"
          className="inline-flex min-h-11 items-center px-4 text-sm font-medium text-zinc-700 underline underline-offset-4 hover:text-zinc-900"
        >
          Go to the homepage
        </Link>
      </div>
      {digest ? (
        <p className="mt-8 text-xs text-zinc-400">
          Reference: <span className="font-mono">{digest}</span>
        </p>
      ) : null}
    </div>
  );
}
