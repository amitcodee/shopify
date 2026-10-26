'use client';

import { useActionState } from 'react';
import { Field, SubmitButton } from '@/components/form';
import { Alert, inputClass } from '@/components/ui';
import { loginAction } from '../actions';

export function LoginForm({ next }: { next: string }) {
  const [state, action] = useActionState(loginAction, undefined);
  return (
    <form action={action} className="mt-7 space-y-4">
      {state?.error ? <Alert tone="error">{state.error}</Alert> : null}
      <input type="hidden" name="next" value={next} />
      {state?.mfaToken ? (
        <>
          <input type="hidden" name="mfaToken" value={state.mfaToken} />
          <p className="text-sm text-slate-600">
            Enter the 6-digit code from your authenticator app.
          </p>
          <div className="space-y-1.5">
            <label htmlFor="code" className="block text-[13px] font-medium text-slate-800">
              Authentication code
            </label>
            <input
              id="code"
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="\d{6}"
              maxLength={6}
              required
              autoFocus
              className={`${inputClass} w-full py-2 text-center text-base tracking-[0.5em]`}
            />
          </div>
          <SubmitButton fullWidth>Verify</SubmitButton>
        </>
      ) : (
        <>
          <Field name="email" label="Email" type="email" autoComplete="email" required />
          <Field
            name="password"
            label="Password"
            type="password"
            autoComplete="current-password"
            required
          />
          <SubmitButton fullWidth>Sign in</SubmitButton>
        </>
      )}
    </form>
  );
}
