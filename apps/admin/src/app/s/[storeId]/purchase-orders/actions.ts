'use server';

import type { PurchaseOrder, ReorderSuggestion, Supplier } from '@repo/contracts';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { api } from '@/lib/api';
import { type FormState, toFormState } from '@/lib/form';

const base = (storeId: string) => `/admin/stores/${storeId}`;

function supplierBody(formData: FormData) {
  const text = (key: string) => String(formData.get(key) ?? '').trim();
  const lead = text('leadTimeDays');
  return {
    name: text('name'),
    contactName: text('contactName'),
    email: text('email'),
    phone: text('phone'),
    address: text('address'),
    website: text('website'),
    leadTimeDays: lead === '' ? null : Number.parseInt(lead, 10),
    notes: text('notes'),
    active: formData.get('active') === 'on',
  };
}

export async function saveSupplierAction(
  storeId: string,
  supplierId: string | null,
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  let saved: Supplier;
  try {
    saved = await api<Supplier>(
      supplierId ? `${base(storeId)}/suppliers/${supplierId}` : `${base(storeId)}/suppliers`,
      { method: supplierId ? 'PUT' : 'POST', body: supplierBody(formData) },
    );
  } catch (error) {
    return toFormState(error, formData);
  }
  revalidatePath(`/s/${storeId}/purchase-orders/suppliers`);
  revalidatePath(`/s/${storeId}/purchase-orders/suppliers/${saved.id}`);
  if (!supplierId) redirect(`/s/${storeId}/purchase-orders/suppliers/${saved.id}?created=1`);
  return { success: 'Supplier saved.' };
}

export async function deleteSupplierAction(
  storeId: string,
  supplierId: string,
): Promise<FormState> {
  try {
    await api(`${base(storeId)}/suppliers/${supplierId}`, { method: 'DELETE' });
  } catch (error) {
    return toFormState(error);
  }
  revalidatePath(`/s/${storeId}/purchase-orders/suppliers`);
  redirect(`/s/${storeId}/purchase-orders/suppliers`);
}

/** Low-stock items to reorder from a supplier (for the purchase order form). */
export async function reorderSuggestionsAction(
  storeId: string,
  supplierId: string,
): Promise<ReorderSuggestion[]> {
  return api<ReorderSuggestion[]>(`${base(storeId)}/suppliers/${supplierId}/reorder`);
}

/** Creates or replaces a draft from the form's JSON payload. */
export async function savePurchaseOrderAction(
  storeId: string,
  purchaseOrderId: string | null,
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  let payload: unknown;
  try {
    payload = JSON.parse(String(formData.get('payload') ?? '{}'));
  } catch {
    return { error: 'Could not read the form. Reload and try again.' };
  }
  let saved: PurchaseOrder;
  try {
    saved = await api<PurchaseOrder>(
      purchaseOrderId
        ? `${base(storeId)}/purchase-orders/${purchaseOrderId}`
        : `${base(storeId)}/purchase-orders`,
      { method: purchaseOrderId ? 'PUT' : 'POST', body: payload },
    );
  } catch (error) {
    return toFormState(error);
  }
  revalidatePath(`/s/${storeId}/purchase-orders`);
  redirect(`/s/${storeId}/purchase-orders/${saved.id}?saved=1`);
}

export async function purchaseOrderAction(
  storeId: string,
  purchaseOrderId: string,
  action: 'mark_ordered' | 'cancel' | 'close',
): Promise<FormState> {
  try {
    await api(`${base(storeId)}/purchase-orders/${purchaseOrderId}/actions`, {
      method: 'POST',
      body: { action },
    });
  } catch (error) {
    return toFormState(error);
  }
  revalidatePath(`/s/${storeId}/purchase-orders`);
  // The page changes shape (the button's card goes away), so confirm through the URL.
  redirect(`/s/${storeId}/purchase-orders/${purchaseOrderId}?done=${action}`);
}

export async function deletePurchaseOrderAction(
  storeId: string,
  purchaseOrderId: string,
): Promise<FormState> {
  try {
    await api(`${base(storeId)}/purchase-orders/${purchaseOrderId}`, { method: 'DELETE' });
  } catch (error) {
    return toFormState(error);
  }
  revalidatePath(`/s/${storeId}/purchase-orders`);
  redirect(`/s/${storeId}/purchase-orders`);
}

/** Receives the quantities typed per line (fields `receive-<lineId>`). */
export async function receivePurchaseOrderAction(
  storeId: string,
  purchaseOrderId: string,
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  const lines: { lineId: string; quantity: number }[] = [];
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith('receive-')) continue;
    const quantity = Number.parseInt(String(value || '0'), 10);
    if (!Number.isInteger(quantity) || quantity < 0) {
      return {
        error: 'Enter whole numbers of units.',
        values: Object.fromEntries(formData.entries()) as Record<string, string>,
      };
    }
    lines.push({ lineId: key.slice('receive-'.length), quantity });
  }
  if (!lines.some((l) => l.quantity > 0)) return { error: 'Enter how many units arrived.' };
  try {
    await api(`${base(storeId)}/purchase-orders/${purchaseOrderId}/receive`, {
      method: 'POST',
      body: { lines, updateCost: formData.get('updateCost') === 'on' },
    });
  } catch (error) {
    return toFormState(error, formData);
  }
  revalidatePath(`/s/${storeId}/purchase-orders`);
  revalidatePath(`/s/${storeId}/inventory`);
  const units = lines.reduce((s, l) => s + l.quantity, 0);
  redirect(`/s/${storeId}/purchase-orders/${purchaseOrderId}?received=${units}`);
}
