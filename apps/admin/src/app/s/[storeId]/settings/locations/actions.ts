'use server';

import { revalidatePath } from 'next/cache';
import { api } from '@/lib/api';
import { type FormState, requiredString, toFormState } from '@/lib/form';

const page = (storeId: string) => `/s/${storeId}/settings/locations`;

function body(formData: FormData) {
  return {
    name: requiredString(formData, 'name'),
    address: requiredString(formData, 'address'),
    priority: Number(requiredString(formData, 'priority')) || 0,
    active: formData.get('active') === 'on',
    isDefault: formData.get('isDefault') === 'on',
  };
}

export async function saveLocationAction(
  storeId: string,
  locationId: string | null,
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  try {
    await api(`/admin/stores/${storeId}/locations${locationId ? `/${locationId}` : ''}`, {
      method: locationId ? 'PUT' : 'POST',
      body: body(formData),
    });
  } catch (error) {
    return toFormState(error, formData);
  }
  revalidatePath(page(storeId));
  return { success: 'Location saved.' };
}

export async function deleteLocationAction(
  storeId: string,
  locationId: string,
): Promise<FormState> {
  try {
    await api(`/admin/stores/${storeId}/locations/${locationId}`, { method: 'DELETE' });
  } catch (error) {
    return toFormState(error);
  }
  revalidatePath(page(storeId));
  return { success: 'Location deleted.' };
}
