'use client';

import type { MyReview } from '@repo/contracts';
import { useActionState, useId, useState } from 'react';
import { type FormResult, Notice, Submit, TextField } from '@/components/form';
import { saveReviewAction } from './review-actions';
import { ReviewPhotos } from './review-photos';

const WORDS = ['', 'Poor', 'Fair', 'Good', 'Very good', 'Excellent'];

/** Write or edit the signed-in buyer's review. */
export function ReviewForm({ handle, mine }: { handle: string; mine: MyReview }) {
  const [state, action] = useActionState(saveReviewAction.bind(null, handle), undefined);
  const existing = mine.review;
  const [rating, setRating] = useState(existing?.rating ?? 0);
  const [hover, setHover] = useState(0);
  // The result the shopper opened the form after: a newer result (a save) closes it again.
  const [openedAt, setOpenedAt] = useState<FormResult | null>(null);
  const open = openedAt === state || Boolean(state?.error);
  const bodyId = useId();
  const errors = state?.fieldErrors ?? {};
  const shown = hover || rating;

  if (!open) {
    return (
      <div className="rounded-xl border border-zinc-200 p-5">
        {existing ? (
          <p className="text-sm text-zinc-600">
            {existing.status === 'PUBLISHED'
              ? 'Your review is live.'
              : 'Your review is waiting for the store to check it.'}
          </p>
        ) : (
          <p className="text-sm text-zinc-600">You bought this. How was it?</p>
        )}
        {state?.success ? (
          <div className="mt-3">
            <Notice result={state} />
          </div>
        ) : null}
        <button
          type="button"
          onClick={() => setOpenedAt(state)}
          className="btn btn-outline mt-4 min-h-11 px-5 text-sm"
        >
          {existing ? 'Edit your review' : 'Write a review'}
        </button>
        {existing && existing.status !== 'REJECTED' ? (
          <ReviewPhotos handle={handle} initial={existing.photos} />
        ) : null}
      </div>
    );
  }

  return (
    <form action={action} className="space-y-5 rounded-xl border border-zinc-200 p-5">
      <Notice result={state?.success ? undefined : state} />
      <fieldset>
        <legend className="field-label">Your rating</legend>
        <div className="flex items-center gap-3" onMouseLeave={() => setHover(0)}>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <label key={n} className="cursor-pointer" onMouseEnter={() => setHover(n)}>
                <input
                  type="radio"
                  name="rating"
                  value={n}
                  checked={rating === n}
                  onChange={() => setRating(n)}
                  className="peer sr-only"
                  required
                />
                <span className="sr-only">
                  {n} star{n === 1 ? '' : 's'}
                </span>
                <svg
                  aria-hidden="true"
                  viewBox="0 0 20 20"
                  className={`size-8 rounded transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-zinc-900 ${
                    n <= shown ? 'text-amber-500' : 'text-zinc-300'
                  }`}
                >
                  <path
                    fill="currentColor"
                    d="M10 1.6l2.47 5.2 5.7.68-4.2 3.92 1.08 5.64L10 14.27l-5.05 2.77 1.08-5.64-4.2-3.92 5.7-.68z"
                  />
                </svg>
              </label>
            ))}
          </div>
          <span className="text-sm text-zinc-600" aria-live="polite">
            {WORDS[shown]}
          </span>
        </div>
        {errors.rating ? <p className="mt-1.5 text-xs text-red-700">{errors.rating}</p> : null}
      </fieldset>
      <TextField
        label="Title (optional)"
        name="title"
        maxLength={150}
        defaultValue={existing?.title ?? ''}
        error={errors.title}
      />
      <div>
        <label htmlFor={bodyId} className="field-label">
          Your review
        </label>
        <textarea
          id={bodyId}
          name="body"
          rows={5}
          required
          minLength={10}
          maxLength={5000}
          defaultValue={existing?.body ?? ''}
          aria-invalid={errors.body ? true : undefined}
          placeholder="What did you like or dislike? How did it fit, feel or work?"
          className="field min-h-32"
        />
        {errors.body ? <p className="mt-1.5 text-xs text-red-700">{errors.body}</p> : null}
      </div>
      <TextField
        label="Name shown with your review"
        name="authorName"
        required
        maxLength={80}
        defaultValue={existing?.authorName ?? mine.suggestedName}
        error={errors.authorName}
      />
      <p className="text-xs text-zinc-500">
        Reviews are shown with a “Verified buyer” label. The store may check reviews before they
        appear.
      </p>
      <div className="max-w-56">
        <Submit pendingLabel="Saving…">{existing ? 'Update review' : 'Post review'}</Submit>
      </div>
    </form>
  );
}
