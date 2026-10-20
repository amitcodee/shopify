'use server';

import { parseMoney } from '@repo/contracts';
import { revalidatePath } from 'next/cache';
import { api } from '@/lib/api';
import { type FormState, optionalString, toFormState } from '@/lib/form';

const path = (storeId: string, orderId: string) => `/s/${storeId}/orders/${orderId}`;

export async function fulfillAction(
  storeId: string,
  orderId: string,
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  try {
    await api(`/admin/stores/${storeId}/orders/${orderId}/fulfillments`, {
      method: 'POST',
      body: {
        trackingCompany: optionalString(formData, 'trackingCompany'),
        trackingNumber: optionalString(formData, 'trackingNumber'),
        trackingUrl: optionalString(formData, 'trackingUrl'),
        notifyCustomer: formData.get('notifyCustomer') === 'on',
      },
    });
  } catch (error) {
    return toFormState(error, formData);
  }
  revalidatePath(path(storeId, orderId));
  return { success: 'Order fulfilled.' };
}

export async function refundAction(
  storeId: string,
  orderId: string,
  currency: string,
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  const amount = parseMoney(String(formData.get('amount') ?? ''), currency);
  if (amount === null || amount <= 0) return { error: 'Enter a valid refund amount.' };
  const restock = formData
    .getAll('restockLine')
    .map(String)
    .map((lineId) => ({ lineId, quantity: Number(formData.get(`restockQty-${lineId}`) ?? 0) }))
    .filter((r) => Number.isInteger(r.quantity) && r.quantity > 0);
  try {
    await api(`/admin/stores/${storeId}/orders/${orderId}/refunds`, {
      method: 'POST',
      body: { amount, reason: optionalString(formData, 'reason'), restock },
    });
  } catch (error) {
    return toFormState(error, formData);
  }
  revalidatePath(path(storeId, orderId));
  return { success: 'Refund issued.' };
}

export async function cancelOrderAction(storeId: string, orderId: string): Promise<void> {
  await api(`/admin/stores/${storeId}/orders/${orderId}/cancel`, {
    method: 'POST',
    body: { reason: 'OTHER', restock: true, refund: true },
  });
  revalidatePath(path(storeId, orderId));
}

/** Sandbox only: the shopper's "bank" opens or decides a chargeback on the order. */
export async function sandboxDisputeAction(
  storeId: string,
  orderId: string,
  status: 'NEEDS_RESPONSE' | 'WON' | 'LOST',
): Promise<FormState> {
  try {
    await api(`/admin/stores/${storeId}/payments/sandbox-dispute`, {
      method: 'POST',
      body: { orderId, status },
    });
  } catch (error) {
    return toFormState(error);
  }
  revalidatePath(path(storeId, orderId));
  return { success: 'Done.' };
}
