'use server';

import { revalidatePath } from 'next/cache';
import { api } from '@/lib/api';

export async function redactCustomerAction(storeId: string, customerId: string): Promise<void> {
  await api(`/admin/stores/${storeId}/customers/${customerId}/redact`, { method: 'POST' });
  revalidatePath(`/s/${storeId}/customers/${customerId}`);
}
