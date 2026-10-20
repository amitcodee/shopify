'use server';

import type { TwoFactorSetup } from '@repo/contracts';
import { revalidatePath } from 'next/cache';
import { api } from '@/lib/api';
import { type FormState, requiredString, toFormState } from '@/lib/form';

export async function startTwoFactorAction(_: FormState): Promise<FormState> {
  try {
    const setup = await api<TwoFactorSetup>('/auth/2fa/setup', { method: 'POST' });
    return { totpSetup: setup };
  } catch (error) {
    return toFormState(error);
  }
}

export async function enableTwoFactorAction(_: FormState, formData: FormData): Promise<FormState> {
  try {
    await api('/auth/2fa/enable', {
      method: 'POST',
      body: { code: requiredString(formData, 'code') },
    });
  } catch (error) {
    return { ...toFormState(error), totpSetup: undefined };
  }
  revalidatePath('/account/security');
  return { success: 'Two-factor authentication is on.' };
}

export async function disableTwoFactorAction(_: FormState, formData: FormData): Promise<FormState> {
  try {
    await api('/auth/2fa/disable', {
      method: 'POST',
      body: { code: requiredString(formData, 'code') },
    });
  } catch (error) {
    return toFormState(error);
  }
  revalidatePath('/account/security');
  return { success: 'Two-factor authentication is off.' };
}
