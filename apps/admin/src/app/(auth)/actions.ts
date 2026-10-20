'use server';

import { type AuthSession, type LoginResult, safeRelativePath } from '@repo/contracts';
import { redirect } from 'next/navigation';
import { api } from '@/lib/api';
import { type FormState, optionalString, requiredString, toFormState } from '@/lib/form';
import { clearSessionCookie, setSessionCookie } from '@/lib/session';

function safeNext(value: FormDataEntryValue | null): string {
  // Only same-origin relative paths: prevents open redirects after login.
  return safeRelativePath(value, '/stores');
}

/** Password step, then (for 2FA accounts) the one-time-code step with the signed challenge. */
export async function loginAction(_: FormState, formData: FormData): Promise<FormState> {
  const mfaToken = optionalString(formData, 'mfaToken');
  try {
    if (mfaToken) {
      const session = await api<AuthSession>('/auth/login/mfa', {
        method: 'POST',
        auth: false,
        body: { mfaToken, code: requiredString(formData, 'code') },
      });
      await setSessionCookie(session.token, session.expiresAt);
    } else {
      const result = await api<LoginResult>('/auth/login', {
        method: 'POST',
        auth: false,
        body: {
          email: requiredString(formData, 'email'),
          password: requiredString(formData, 'password'),
        },
      });
      if (result.mfaRequired) return { mfaToken: result.mfaToken };
      await setSessionCookie(result.token, result.expiresAt);
    }
  } catch (error) {
    const state = toFormState(error, formData);
    return mfaToken ? { ...state, mfaToken } : state;
  }
  redirect(safeNext(formData.get('next')));
}

export async function signupAction(_: FormState, formData: FormData): Promise<FormState> {
  try {
    const session = await api<AuthSession>('/auth/signup', {
      method: 'POST',
      auth: false,
      body: {
        name: requiredString(formData, 'name'),
        email: requiredString(formData, 'email'),
        password: requiredString(formData, 'password'),
      },
    });
    await setSessionCookie(session.token, session.expiresAt);
  } catch (error) {
    return toFormState(error, formData);
  }
  redirect('/verify-email');
}

export async function logoutAction(): Promise<void> {
  try {
    await api('/auth/logout', { method: 'POST' });
  } finally {
    await clearSessionCookie();
  }
  redirect('/login');
}
