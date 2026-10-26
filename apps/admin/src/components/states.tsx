'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { Icon } from './icons';
import { buttonClass } from './ui';

/** A grey placeholder block that shimmers while content loads (static with reduced motion). */
export function Skeleton({ className = '' }: { className?: string }) {
  return <div aria-hidden="true" className={`skeleton rounded-md ${className}`} />;
}

/** Placeholder for a typical admin page: header, a row of tiles, and a table-like card. */
export function PageSkeleton() {
  return (
    <div role="status" aria-live="polite" className="space-y-6">
      <span className="sr-only">Loading…</span>
      <div className="flex items-end justify-between gap-4">
        <div className="space-y-2.5">
          <Skeleton className="h-7 w-56" />
          <Skeleton className="h-4 w-80 max-w-[60vw]" />
        </div>
        <Skeleton className="hidden h-9 w-28 rounded-lg sm:block" />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="rounded-xl border border-slate-200/90 bg-white p-5 shadow-card">
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="mt-3 h-7 w-20" />
          </div>
        ))}
      </div>
      <div className="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-card">
        <div className="border-b border-slate-100 px-5 py-4">
          <Skeleton className="h-4 w-40" />
        </div>
        <div className="divide-y divide-slate-100">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-4 px-5 py-3.5">
              <Skeleton className="size-9 shrink-0 rounded-lg" />
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-3.5 w-2/5" />
                <Skeleton className="h-3 w-1/4" />
              </div>
              <Skeleton className="hidden h-3.5 w-16 sm:block" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Fallback for an error boundary: says what happened, lets the merchant retry (which re-fetches
 * the segment), and shows the server's error reference so support can find it in the logs.
 */
export function ErrorState({
  error,
  retry,
  homeHref = '/stores',
  homeLabel = 'Back to your stores',
}: {
  error: unknown;
  retry: () => void;
  homeHref?: string;
  homeLabel?: string;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  const digest =
    error instanceof Error && 'digest' in error && typeof error.digest === 'string'
      ? error.digest
      : null;

  return (
    <div role="alert" className="mx-auto max-w-md px-4 py-16 text-center sm:py-24">
      <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-red-50 text-red-600 ring-8 ring-red-50/50">
        <Icon name="alert" className="size-6" />
      </span>
      <h1 className="mt-6 text-xl font-semibold text-slate-900">Something went wrong</h1>
      <p className="mt-2 text-sm text-slate-500">
        This page couldn’t load. It may be a temporary problem — try again in a moment.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <button type="button" onClick={() => retry()} className={buttonClass('primary')}>
          Try again
        </button>
        <Link href={homeHref} className={buttonClass('secondary')}>
          {homeLabel}
        </Link>
      </div>
      {digest ? (
        <p className="mt-6 text-xs text-slate-400">
          Reference: <span className="font-mono">{digest}</span>
        </p>
      ) : null}
    </div>
  );
}
