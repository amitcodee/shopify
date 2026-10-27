'use client';

import { useActionState, useState } from 'react';
import { SubmitButton } from '@/components/form';
import type { ButtonVariant } from '@/components/ui';
import { Alert, buttonClass } from '@/components/ui';
import type { FormState } from '@/lib/form';

/**
 * A button bound to a server action that shows the outcome below it. With `confirm`, the first
 * click asks again (no browser confirm() dialogs).
 */
export function ActionButton({
  action,
  label,
  variant = 'secondary',
  confirm,
}: {
  action: (state: FormState) => Promise<FormState>;
  label: string;
  variant?: ButtonVariant;
  confirm?: string;
}) {
  const [state, formAction] = useActionState(action, undefined);
  const [armed, setArmed] = useState(false);
  return (
    <form action={formAction} className="flex flex-col items-start gap-2">
      {confirm && !armed ? (
        <button type="button" className={buttonClass(variant)} onClick={() => setArmed(true)}>
          {label}
        </button>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <SubmitButton variant={confirm ? 'danger' : variant}>{confirm ?? label}</SubmitButton>
          {confirm ? (
            <button type="button" className={buttonClass('ghost')} onClick={() => setArmed(false)}>
              Keep it
            </button>
          ) : null}
        </div>
      )}
      {state?.error ? <Alert tone="error">{state.error}</Alert> : null}
      {state?.success ? <Alert tone="success">{state.success}</Alert> : null}
    </form>
  );
}
