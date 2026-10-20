'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { api, SESSION_COOKIE } from '@/lib/api';
import { type FormState, toFormState } from '@/lib/form';

export async function resendVerificationAction(): Promise<FormState> {
  try {
    await api('/auth/verify-email/resend', { method: 'POST' });
  } catch (error) {
    return toFormState(error);
  }
  return { success: 'We sent a new link. Check your inbox.' };
}

/** A button press (not the page load) confirms, so link scanners that prefetch cannot. */
export async function confirmEmailAction(token: string): Promise<FormState> {
  try {
    await api('/auth/verify-email', { method: 'POST', auth: false, body: { token } });
  } catch (error) {
    return toFormState(error);
  }
  const signedIn = (await cookies()).has(SESSION_COOKIE);
  redirect(signedIn ? '/onboarding' : '/login?next=/onboarding');
}
