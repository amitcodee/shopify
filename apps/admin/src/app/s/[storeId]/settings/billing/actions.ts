'use server';

import type { ChangePlanResult } from '@repo/contracts';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { api } from '@/lib/api';
import { type FormState, toFormState } from '@/lib/form';

export async function changePlanAction(
  storeId: string,
  planId: string,
  _: FormState,
): Promise<FormState> {
  let result: ChangePlanResult;
  try {
    result = await api<ChangePlanResult>(`/admin/stores/${storeId}/billing/plan`, {
      method: 'POST',
      body: { planId },
    });
  } catch (error) {
    return toFormState(error);
  }
  // Paid plans with a real provider continue on its hosted checkout page.
  if (result.checkoutUrl) redirect(result.checkoutUrl);
  revalidatePath(`/s/${storeId}`, 'layout');
  return { success: 'Plan updated.' };
}
