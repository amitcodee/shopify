'use client';

import type { InputHTMLAttributes, ReactNode } from 'react';
import { useId } from 'react';
import { useFormStatus } from 'react-dom';

export type FormResult =
  | {
      error?: string;
      success?: string;
      fieldErrors?: Record<string, string>;
      /** Navigate the browser here (see FollowRedirect). */
      redirectTo?: string;
    }
  | undefined;

export function TextField({
  label,
  name,
  error,
  hint,
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  name: string;
  error?: string;
  hint?: string;
}) {
  const id = useId();
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-sm font-medium text-zinc-800">
        {label}
      </label>
      <input
        id={id}
        name={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-err` : undefined}
        className="block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/20 aria-[invalid=true]:border-red-600"
        {...rest}
      />
      {hint && !error ? <p className="text-xs text-zinc-500">{hint}</p> : null}
      {error ? (
        <p id={`${id}-err`} className="text-xs text-red-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function Submit({
  children,
  pendingLabel = 'Please wait…',
}: {
  children: ReactNode;
  pendingLabel?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn w-full px-4 py-3 text-sm">
      {pending ? pendingLabel : children}
    </button>
  );
}

export function Notice({ result }: { result: FormResult }) {
  if (result?.error) {
    return (
      <p
        role="alert"
        className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800"
      >
        {result.error}
      </p>
    );
  }
  if (result?.success) {
    return (
      <p
        role="status"
        className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"
      >
        {result.success}
      </p>
    );
  }
  return null;
}
