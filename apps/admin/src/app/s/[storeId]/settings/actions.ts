'use server';

import { revalidatePath } from 'next/cache';
import { api } from '@/lib/api';
import { type FormState, optionalString, toFormState } from '@/lib/form';

export async function updateStoreAction(
  storeId: string,
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  try {
    await api(`/admin/stores/${storeId}`, {
      method: 'PATCH',
      body: {
        name: optionalString(formData, 'name'),
        contactEmail: optionalString(formData, 'contactEmail'),
        currency: optionalString(formData, 'currency'),
        timezone: optionalString(formData, 'timezone'),
      },
    });
  } catch (error) {
    return toFormState(error, formData);
  }
  revalidatePath(`/s/${storeId}`, 'layout');
  return { success: 'Settings saved.' };
}
