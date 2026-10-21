'use client';

import { useActionState } from 'react';
import { FollowRedirect } from '@/components/follow-redirect';
import { Notice, Submit } from '@/components/form';
import { payInvoiceAction } from './actions';

export function PayInvoiceButton({ token, label }: { token: string; label: string }) {
  const [state, formAction] = useActionState(payInvoiceAction.bind(null, token), undefined);
  return (
    <form action={formAction} className="space-y-3">
      <FollowRedirect to={state?.redirectTo} />
      <Notice result={state} />
      <Submit pendingLabel="Opening secure payment…">{label}</Submit>
    </form>
  );
}
