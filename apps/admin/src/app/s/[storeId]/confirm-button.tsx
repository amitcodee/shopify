'use client';

import { useState } from 'react';
import { useFormStatus } from 'react-dom';
import { buttonClass } from '@/components/ui';

function Confirm({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={buttonClass('danger')} disabled={pending}>
      {pending ? 'Working…' : label}
    </button>
  );
}

/** Two-step destructive action without browser confirm() dialogs. */
export function ConfirmButton({
  action,
  label,
  confirmLabel,
}: {
  action: () => Promise<void>;
  label: string;
  confirmLabel: string;
}) {
  const [armed, setArmed] = useState(false);
  if (!armed) {
    return (
      <button type="button" className={buttonClass('secondary')} onClick={() => setArmed(true)}>
        {label}
      </button>
    );
  }
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <Confirm label={confirmLabel} />
      <button type="button" className={buttonClass('ghost')} onClick={() => setArmed(false)}>
        Cancel
      </button>
    </form>
  );
}
