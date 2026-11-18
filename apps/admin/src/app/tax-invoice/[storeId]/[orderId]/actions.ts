'use server';

import { revalidatePath } from 'next/cache';
import { api } from '@/lib/api';

export async function issueInvoiceAction(storeId: string, orderId: string): Promise<void> {
  await api(`/admin/stores/${storeId}/orders/${orderId}/invoice`, { method: 'POST' });
  revalidatePath(`/tax-invoice/${storeId}/${orderId}`);
  revalidatePath(`/s/${storeId}/orders/${orderId}`);
}
