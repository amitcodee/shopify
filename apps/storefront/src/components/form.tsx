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
    <div>
      <label htmlFor={id} className="field-label">
        {label}
      </label>
      <input
        id={id}
        name={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-err` : undefined}
        className="field"
        {...rest}
      />
      {hint && !error ? <p className="mt-1.5 text-xs text-zinc-500">{hint}</p> : null}
      {error ? (
        <p id={`${id}-err`} className="mt-1.5 text-xs text-red-700">
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
    <button
      type="submit"
      disabled={pending}
      className="btn btn-strong min-h-12 w-full px-4 py-3 text-sm"
    >
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
