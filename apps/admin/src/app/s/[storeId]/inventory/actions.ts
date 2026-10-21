'use server';

import { revalidatePath } from 'next/cache';
import { api } from '@/lib/api';
import { type FormState, toFormState } from '@/lib/form';

export async function adjustInventoryAction(
  storeId: string,
  variantId: string,
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  const delta = Number.parseInt(String(formData.get('delta') ?? ''), 10);
  if (!Number.isInteger(delta) || delta === 0) return { error: 'Enter a non-zero whole number.' };
  try {
    await api(`/admin/stores/${storeId}/inventory/${variantId}/adjust`, {
      method: 'POST',
      body: {
        delta,
        reason: String(formData.get('reason') ?? 'MANUAL'),
        ...(formData.get('locationId') ? { locationId: String(formData.get('locationId')) } : {}),
      },
    });
  } catch (error) {
    return toFormState(error);
  }
  revalidatePath(`/s/${storeId}/inventory`);
  return { success: 'Updated.' };
}

export async function transferInventoryAction(
  storeId: string,
  variantId: string,
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  try {
    await api(`/admin/stores/${storeId}/inventory/${variantId}/transfer`, {
      method: 'POST',
      body: {
        fromLocationId: String(formData.get('from') ?? ''),
        toLocationId: String(formData.get('to') ?? ''),
        quantity: Number.parseInt(String(formData.get('quantity') ?? ''), 10),
      },
    });
  } catch (error) {
    return toFormState(error);
  }
  revalidatePath(`/s/${storeId}/inventory`);
  return { success: 'Moved.' };
}
