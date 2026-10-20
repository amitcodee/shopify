'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { FollowRedirect } from '@/components/follow-redirect';
import { type FormResult, Notice, Submit, TextField } from '@/components/form';
import { completeLinkAction, forgotPasswordAction, loginAction, registerAction } from './actions';

export function LoginForm() {
  const [state, action] = useActionState(loginAction, undefined);
  return (
    <form action={action} className="space-y-4">
      <FollowRedirect to={state?.redirectTo} />
      <Notice result={state} />
      <TextField label="Email" name="email" type="email" autoComplete="email" required />
      <TextField
        label="Password"
        name="password"
        type="password"
        autoComplete="current-password"
        required
      />
      <Submit>Sign in</Submit>
      <p className="flex justify-between text-sm">
        <Link href="/account/register" className="underline">
          Create account
        </Link>
        <Link href="/account/forgot" className="underline">
          Forgot password?
        </Link>
      </p>
    </form>
  );
}

export function RegisterForm() {
  const [state, action] = useActionState(registerAction, undefined);
  const err = state?.fieldErrors ?? {};
  return (
    <form action={action} className="space-y-4">
      <FollowRedirect to={state?.redirectTo} />
      <Notice result={state} />
      <TextField label="Name" name="name" autoComplete="name" required error={err.name} />
      <TextField
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        required
        error={err.email}
      />
      <TextField
        label="Password"
        name="password"
        type="password"
        autoComplete="new-password"
        minLength={12}
        required
        hint="At least 12 characters."
        error={err.password}
      />
      <label className="flex items-center gap-2 text-sm text-zinc-700">
        <input type="checkbox" name="acceptsMarketing" /> Email me about news and offers
      </label>
      <Submit>Create account</Submit>
    </form>
  );
}

export function ForgotForm() {
  const [state, action] = useActionState(forgotPasswordAction, undefined);
  return (
    <form action={action} className="space-y-4">
      <FollowRedirect to={state?.redirectTo} />
      <Notice result={state} />
      <TextField label="Email" name="email" type="email" autoComplete="email" required />
      <Submit>Send reset link</Submit>
    </form>
  );
}

export function SetPasswordForm({
  purpose,
  token,
}: {
  purpose: 'activate' | 'reset';
  token: string;
}) {
  const [state, action] = useActionState(
    completeLinkAction.bind(null, purpose, token) as (
      s: FormResult,
      f: FormData,
    ) => Promise<FormResult>,
    undefined,
  );
  return (
    <form action={action} className="space-y-4">
      <FollowRedirect to={state?.redirectTo} />
      <Notice result={state} />
      <TextField
        label="New password"
        name="password"
        type="password"
        autoComplete="new-password"
        minLength={12}
        required
        error={state?.fieldErrors?.password}
      />
      <Submit>{purpose === 'activate' ? 'Activate account' : 'Reset password'}</Submit>
    </form>
  );
}

export function LogoutButton() {
  return (
    <form action="/account/logout" method="post">
      <button type="submit" className="text-sm underline">
        Sign out
      </button>
    </form>
  );
}
