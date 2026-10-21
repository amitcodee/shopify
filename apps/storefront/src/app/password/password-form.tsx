'use client';

import { useActionState } from 'react';
import { FollowRedirect } from '@/components/follow-redirect';
import { Notice, Submit, TextField } from '@/components/form';
import { enterPasswordAction } from './actions';

export function PasswordForm() {
  const [state, formAction] = useActionState(enterPasswordAction, undefined);
  return (
    <form action={formAction} className="space-y-4 text-left">
      <FollowRedirect to={state?.redirectTo} />
      <Notice result={state} />
      <TextField label="Password" name="password" type="password" required autoComplete="off" />
      <Submit pendingLabel="Checking…">Enter store</Submit>
    </form>
  );
}
