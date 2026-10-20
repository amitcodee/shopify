'use server';

import type { GatewayName, ProviderLink } from '@repo/contracts';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { api } from '@/lib/api';
import { type FormState, optionalString, requiredString, toFormState } from '@/lib/form';

const RAZORPAY_FIELDS = [
  'legalBusinessName',
  'businessType',
  'contactName',
  'phone',
  'pan',
  'street1',
  'street2',
  'city',
  'state',
  'postalCode',
  'accountNumber',
  'ifsc',
  'beneficiaryName',
] as const;

/**
 * Connects the store to a gateway. Hosted onboarding continues on the provider's pages; form
 * onboarding (Razorpay) submits the details here and stays in the admin.
 */
export async function connectPaymentsAction(
  storeId: string,
  provider: GatewayName,
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  const body =
    provider === 'razorpay'
      ? {
          provider,
          business: Object.fromEntries(
            RAZORPAY_FIELDS.map((field) => [field, optionalString(formData, `business.${field}`)]),
          ),
        }
      : { provider, country: requiredString(formData, 'country') };
  let link: ProviderLink;
  try {
    link = await api<ProviderLink>(`/admin/stores/${storeId}/payments/account`, {
      method: 'POST',
      body,
    });
  } catch (error) {
    const state = toFormState(error, formData);
    // Never echo bank details back into the page.
    if (state?.values) delete state.values['business.accountNumber'];
    return state;
  }
  revalidatePath(`/s/${storeId}`, 'layout');
  if (link.url) redirect(link.url);
  redirect(`/s/${storeId}/settings/payments?onboarding=submitted`);
}

export async function disconnectPaymentsAction(storeId: string): Promise<void> {
  await api(`/admin/stores/${storeId}/payments/account/disconnect`, { method: 'POST' });
  revalidatePath(`/s/${storeId}`, 'layout');
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
  if (link.url) redirect(link.url);
  return { error: 'No dashboard is available.' };
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
