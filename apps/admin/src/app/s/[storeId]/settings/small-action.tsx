'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import type { FormState } from '@/lib/form';

function Button({ label, danger }: { label: string; danger?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={`text-sm font-medium ${danger ? 'text-red-600' : 'text-brand-600'} hover:underline disabled:opacity-50`}
    >
      {pending ? '…' : label}
    </button>
  );
}

/** A one-button form bound to a server action that reports errors inline. */
export function SmallAction({
  action,
  label,
  danger,
}: {
  action: (state: FormState) => Promise<FormState>;
  label: string;
  danger?: boolean;
}) {
  const [state, formAction] = useActionState(action, undefined);
  return (
    <form action={formAction} className="inline-flex flex-col">
      <Button label={label} danger={danger} />
      {state?.error ? (
        <span role="alert" className="text-xs text-red-600">
          {state.error}
        </span>
      ) : null}
    </form>
  );
}
