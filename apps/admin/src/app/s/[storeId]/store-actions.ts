'use server';

import type { StoreDetail } from '@repo/contracts';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { api } from '@/lib/api';
import { type FormState, toFormState } from '@/lib/form';

export async function closeStoreAction(
  storeId: string,
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  try {
    await api<StoreDetail>(`/admin/stores/${storeId}/close`, {
      method: 'POST',
      body: { confirmSubdomain: String(formData.get('confirmSubdomain') ?? '') },
    });
  } catch (error) {
    return toFormState(error);
  }
  revalidatePath(`/s/${storeId}`, 'layout');
  redirect(`/s/${storeId}`);
}

export async function reopenStoreAction(storeId: string, _: FormState): Promise<FormState> {
  try {
    await api<StoreDetail>(`/admin/stores/${storeId}/reopen`, { method: 'POST' });
  } catch (error) {
    return toFormState(error);
  }
  revalidatePath(`/s/${storeId}`, 'layout');
  return { success: 'Store reopened.' };
}
