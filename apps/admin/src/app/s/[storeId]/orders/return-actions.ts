'use server';

import { parseMoney, returnReasonSchema } from '@repo/contracts';
import { revalidatePath } from 'next/cache';
import { api } from '@/lib/api';
import { type FormState, requiredString, toFormState } from '@/lib/form';

const orderPath = (storeId: string, orderId: string) => `/s/${storeId}/orders/${orderId}`;

export async function createReturnAction(
  storeId: string,
  orderId: string,
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  const lines = [...formData.entries()].flatMap(([key, value]) => {
    const id = /^return-qty-([0-9a-f-]{36})$/.exec(key)?.[1];
    const quantity = Number(value);
    if (!id || !Number.isInteger(quantity) || quantity <= 0) return [];
    const reason = returnReasonSchema.safeParse(formData.get('reason'));
    return [{ orderLineId: id, quantity, reason: reason.success ? reason.data : 'OTHER' }];
  });
  if (lines.length === 0) return { error: 'Enter a quantity for at least one item.' };
  try {
    await api(`/admin/stores/${storeId}/orders/${orderId}/returns`, {
      method: 'POST',
      body: { lines },
    });
  } catch (error) {
    return toFormState(error);
  }
  revalidatePath(orderPath(storeId, orderId));
  return { success: 'Return created.' };
}

export async function approveReturnAction(
  storeId: string,
  orderId: string,
  returnId: string,
): Promise<FormState> {
  try {
    await api(`/admin/stores/${storeId}/returns/${returnId}/approve`, { method: 'POST' });
  } catch (error) {
    return toFormState(error);
  }
  revalidatePath(orderPath(storeId, orderId));
  return { success: 'Return approved.' };
}

export async function declineReturnAction(
  storeId: string,
  orderId: string,
  returnId: string,
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  try {
    await api(`/admin/stores/${storeId}/returns/${returnId}/decline`, {
      method: 'POST',
      body: { reason: requiredString(formData, 'reason') },
    });
  } catch (error) {
    return toFormState(error, formData);
  }
  revalidatePath(orderPath(storeId, orderId));
  return { success: 'Return declined.' };
}

export async function closeReturnAction(
  storeId: string,
  orderId: string,
  returnId: string,
  currency: string,
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  const amount = parseMoney(requiredString(formData, 'amount'), currency);
  if (amount === null) return { error: 'Enter the amount to refund (0 for none).' };
  try {
    await api(`/admin/stores/${storeId}/returns/${returnId}/close`, {
      method: 'POST',
      body: { amount, restock: formData.get('restock') === 'on' },
    });
  } catch (error) {
    return toFormState(error, formData);
  }
  revalidatePath(orderPath(storeId, orderId));
  return { success: 'Return closed.' };
}
