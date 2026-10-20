'use server';

import { redirect } from 'next/navigation';
import { api } from '@/lib/api';
import { type FormState, requiredString, toFormState } from '@/lib/form';

export async function forgotPasswordAction(_: FormState, formData: FormData): Promise<FormState> {
  try {
    await api('/auth/password/forgot', {
      method: 'POST',
      auth: false,
      body: { email: requiredString(formData, 'email') },
    });
  } catch (error) {
    return toFormState(error, formData);
  }
  return { success: 'If an account exists for that email, we sent a link to reset the password.' };
}

export async function resetPasswordAction(
  token: string,
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  try {
    await api('/auth/password/reset', {
      method: 'POST',
      auth: false,
      body: { token, password: requiredString(formData, 'password') },
    });
  } catch (error) {
    return toFormState(error, formData);
  }
  redirect('/login?reset=1');
}

/** A button press (not the page load) unlocks, so link scanners that prefetch cannot. */
export async function unlockAccountAction(token: string): Promise<FormState> {
  try {
    await api('/auth/unlock', { method: 'POST', auth: false, body: { token } });
  } catch (error) {
    return toFormState(error);
  }
  redirect('/login?unlocked=1');
}
