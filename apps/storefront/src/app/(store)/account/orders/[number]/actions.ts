'use server';

import { returnReasonSchema } from '@repo/contracts';
import { revalidatePath } from 'next/cache';
import type { FormResult } from '@/components/form';
import { sf, StorefrontApiError } from '@/lib/api';
import { getCustomerToken } from '@/lib/shop';

export async function requestReturnAction(
  number: number,
  _: FormResult,
  formData: FormData,
): Promise<FormResult> {
  const lines: { orderLineId: string; quantity: number; reason: string }[] = [];
  for (const [key, value] of formData.entries()) {
    const id = /^qty-([0-9a-f-]{36})$/.exec(key)?.[1];
    const quantity = Number(value);
    if (!id || !Number.isInteger(quantity) || quantity <= 0) continue;
    const reason = returnReasonSchema.safeParse(formData.get(`reason-${id}`));
    lines.push({ orderLineId: id, quantity, reason: reason.success ? reason.data : 'OTHER' });
  }
  if (lines.length === 0) return { error: 'Choose at least one item to return.' };
  const note = String(formData.get('note') ?? '').trim();
  try {
    await sf(`/customers/me/orders/${number}/returns`, {
      method: 'POST',
      customerToken: await getCustomerToken(),
      body: { lines, ...(note ? { note } : {}) },
    });
  } catch (error) {
    if (error instanceof StorefrontApiError) return { error: error.message };
    throw error;
  }
  revalidatePath(`/account/orders/${number}`);
  return { success: 'Return requested. We will email you once the store has reviewed it.' };
}
