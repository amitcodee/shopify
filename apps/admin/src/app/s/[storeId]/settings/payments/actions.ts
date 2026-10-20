'use server';

import type { ProviderLink } from '@repo/contracts';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { api } from '@/lib/api';
import { type FormState, requiredString, toFormState } from '@/lib/form';

/** Creates (or reuses) the payout account and continues on the provider's hosted onboarding. */
export async function connectPaymentsAction(
  storeId: string,
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  let link: ProviderLink;
  try {
    link = await api<ProviderLink>(`/admin/stores/${storeId}/payments/account`, {
      method: 'POST',
      body: { country: requiredString(formData, 'country') },
    });
  } catch (error) {
    return toFormState(error, formData);
  }
  redirect(link.url);
}

export async function openPaymentsDashboardAction(storeId: string): Promise<FormState> {
  let link: ProviderLink;
  try {
    link = await api<ProviderLink>(`/admin/stores/${storeId}/payments/account/dashboard-link`, {
      method: 'POST',
    });
  } catch (error) {
    return toFormState(error);
  }
  redirect(link.url);
}

/** Sandbox only: finishes (or restricts) the simulated onboarding. */
export async function sandboxOnboardingAction(
  storeId: string,
  outcome: 'complete' | 'restricted',
): Promise<FormState> {
  try {
    await api(`/admin/stores/${storeId}/payments/sandbox-onboarding`, {
      method: 'POST',
      body: { outcome },
    });
  } catch (error) {
    return toFormState(error);
  }
  revalidatePath(`/s/${storeId}`, 'layout');
  redirect(`/s/${storeId}/settings/payments?onboarding=returned`);
}
