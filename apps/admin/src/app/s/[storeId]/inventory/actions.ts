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
      body: { delta, reason: String(formData.get('reason') ?? 'MANUAL') },
    });
  } catch (error) {
    return toFormState(error);
  }
  revalidatePath(`/s/${storeId}/inventory`);
  return { success: 'Updated.' };
}
