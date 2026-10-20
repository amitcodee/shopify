'use client';

import { useActionState } from 'react';
import { Field, SubmitButton } from '@/components/form';
import { Alert } from '@/components/ui';
import { loginAction } from '../actions';

export function LoginForm({ next }: { next: string }) {
  const [state, action] = useActionState(loginAction, undefined);
  return (
    <form action={action} className="mt-6 space-y-4">
      {state?.error ? <Alert tone="error">{state.error}</Alert> : null}
      <input type="hidden" name="next" value={next} />
      {state?.mfaToken ? (
        <>
          <input type="hidden" name="mfaToken" value={state.mfaToken} />
          <p className="text-sm text-slate-600">
            Enter the 6-digit code from your authenticator app.
          </p>
          <div className="space-y-1">
            <label htmlFor="code" className="block text-sm font-medium text-slate-700">
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
              className="block w-full rounded-md border border-slate-300 px-3 py-2 text-sm tracking-widest"
            />
          </div>
          <SubmitButton>Verify</SubmitButton>
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
          <SubmitButton>Sign in</SubmitButton>
        </>
      )}
    </form>
  );
}
