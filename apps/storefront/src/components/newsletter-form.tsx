'use client';

import { useActionState, useId } from 'react';
import { type NewsletterState, subscribeAction } from '@/app/newsletter-actions';

/** Email sign-up for the store's newsletter (homepage section; reusable in the footer). */
export function NewsletterForm({
  className = '',
  align = 'start',
  tone = 'default',
}: {
  className?: string;
  align?: 'start' | 'center';
  /** `brand`: on a brand-colored band (light-on-dark input and button). */
  tone?: 'default' | 'brand';
}) {
  const onBrand = tone === 'brand';
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
          className={`min-h-12 min-w-0 flex-1 rounded-[var(--store-button-radius)] border px-4 py-3 text-sm focus:outline-none focus:ring-2 ${
            onBrand
              ? 'border-[color-mix(in_oklab,var(--store-brand-contrast)_45%,transparent)] bg-transparent text-brand-contrast placeholder:text-[color-mix(in_oklab,var(--store-brand-contrast)_70%,transparent)] focus:border-brand-contrast focus:ring-[color-mix(in_oklab,var(--store-brand-contrast)_25%,transparent)]'
              : 'border-zinc-300 bg-page text-ink placeholder:text-zinc-500 focus:border-zinc-900 focus:ring-zinc-900/15'
          }`}
        />
        <button
          type="submit"
          disabled={pending}
          className={`btn min-h-12 shrink-0 px-7 py-3 text-sm ${onBrand ? 'btn-on-brand' : ''}`}
        >
          {pending ? 'Subscribing…' : 'Subscribe'}
        </button>
      </div>
      <div id={messageId} aria-live="polite" className={align === 'center' ? 'text-center' : ''}>
        {state?.success ? (
          <p className={`mt-3 text-sm font-medium ${onBrand ? '' : 'text-emerald-700'}`}>
            {state.success}
          </p>
        ) : null}
        {state?.error ? (
          <p className={`mt-3 text-sm ${onBrand ? 'font-medium' : 'text-red-700'}`}>
            {state.error}
          </p>
        ) : null}
      </div>
    </form>
  );
}
