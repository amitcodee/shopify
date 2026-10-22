'use client';

import { useActionState, useId } from 'react';
import { type NewsletterState, subscribeAction } from '@/app/newsletter-actions';

/** Email sign-up for the store's newsletter (homepage section; reusable in the footer). */
export function NewsletterForm({
  className = '',
  align = 'start',
}: {
  className?: string;
  align?: 'start' | 'center';
}) {
  const [state, action, pending] = useActionState<NewsletterState, FormData>(
    subscribeAction,
    undefined,
  );
  const id = useId();
  const messageId = `${id}-message`;
  return (
    <form
      action={action}
      className={`w-full max-w-md ${align === 'center' ? 'mx-auto' : ''} ${className}`}
    >
      <div className="flex flex-col gap-2 sm:flex-row">
        <label htmlFor={id} className="sr-only">
          Email address
        </label>
        <input
          id={id}
          type="email"
          name="email"
          required
          maxLength={254}
          autoComplete="email"
          placeholder="Email address"
          aria-invalid={state?.error ? true : undefined}
          aria-describedby={state ? messageId : undefined}
          className="min-w-0 flex-1 rounded-[var(--store-button-radius)] border border-zinc-300 bg-page px-4 py-3 text-sm text-ink placeholder:text-zinc-500 focus:border-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/15"
        />
        <button type="submit" disabled={pending} className="btn shrink-0 px-6 py-3 text-sm">
          {pending ? 'Subscribing…' : 'Subscribe'}
        </button>
      </div>
      <div id={messageId} aria-live="polite" className={align === 'center' ? 'text-center' : ''}>
        {state?.success ? (
          <p className="mt-3 text-sm font-medium text-emerald-700">{state.success}</p>
        ) : null}
        {state?.error ? <p className="mt-3 text-sm text-red-700">{state.error}</p> : null}
      </div>
    </form>
  );
}
