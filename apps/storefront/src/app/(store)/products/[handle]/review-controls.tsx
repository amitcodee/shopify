'use client';

import { REVIEW_SORTS, type ReviewSort } from '@repo/contracts';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { markHelpfulAction } from './review-actions';

/** Sort menu for the reviews list; changing it reloads the list from the first page. */
export function ReviewSortSelect({ value, hrefFor }: { value: ReviewSort; hrefFor: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <label className="flex items-center gap-2 text-sm text-zinc-600">
      Sort by
      <select
        className="min-h-10 rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-900"
        value={value}
        disabled={pending}
        onChange={(e) => {
          const href = hrefFor.replace('__SORT__', e.target.value);
          startTransition(() => router.push(href, { scroll: false }));
        }}
      >
        {REVIEW_SORTS.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>
    </label>
  );
}

/** "Helpful" toggle for signed-in shoppers; others are sent to sign in. */
export function HelpfulButton({
  handle,
  reviewId,
  count,
  marked,
  signedIn,
  own,
}: {
  handle: string;
  reviewId: string;
  count: number;
  marked: boolean;
  signedIn: boolean;
  own: boolean;
}) {
  const [state, setState] = useState({ count, marked });
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const label =
    state.count === 1 ? '1 person found this helpful' : `${state.count} people found this helpful`;

  if (own || !signedIn) {
    return (
      <p className="mt-4 flex flex-wrap items-center gap-3 text-xs text-zinc-500">
        {state.count > 0 ? <span>{label}</span> : null}
        {!own ? (
          <Link
            href={`/account/login?next=${encodeURIComponent(`/products/${handle}#reviews`)}`}
            className="underline hover:text-zinc-800"
          >
            Sign in to mark helpful
          </Link>
        ) : null}
      </p>
    );
  }

  return (
    <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-zinc-500">
      <button
        type="button"
        aria-pressed={state.marked}
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const result = await markHelpfulAction(handle, reviewId, !state.marked);
            if ('error' in result) setError(result.error);
            else setState({ count: result.helpfulCount, marked: result.helpful });
          })
        }
        className={`inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 font-medium transition-colors ${
          state.marked
            ? 'border-zinc-900 bg-zinc-900 text-white'
            : 'border-zinc-300 text-zinc-700 hover:border-zinc-500'
        }`}
      >
        <svg aria-hidden="true" viewBox="0 0 20 20" className="size-3.5">
          <path
            fill="currentColor"
            d="M2 9.5A1.5 1.5 0 0 1 3.5 8h1A1.5 1.5 0 0 1 6 9.5v7A1.5 1.5 0 0 1 4.5 18h-1A1.5 1.5 0 0 1 2 16.5v-7zm5.5-.6 3-6.1A1.4 1.4 0 0 1 13 3.6V7h3.3a1.7 1.7 0 0 1 1.7 2l-1.2 7.2A2.2 2.2 0 0 1 14.6 18H7.5V8.9z"
          />
        </svg>
        Helpful
      </button>
      {state.count > 0 ? <span aria-live="polite">{label}</span> : null}
      {error ? <span className="text-red-700">{error}</span> : null}
    </div>
  );
}
