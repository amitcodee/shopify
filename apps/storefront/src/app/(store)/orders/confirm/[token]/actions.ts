'use server';

import { redirect } from 'next/navigation';
import { isNotFound, sf } from '@/lib/api';

interface Confirmed {
  orderNumber: number;
  statusUrl: string;
  alreadyConfirmed: boolean;
}

/** Confirms a cash-on-delivery order (a POST, so email link scanners cannot confirm it). */
export async function confirmOrderAction(token: string): Promise<void> {
  let result: Confirmed;
  try {
    result = await sf<Confirmed>(`/orders/confirm/${encodeURIComponent(token)}`, {
      method: 'POST',
    });
  } catch (error) {
    if (isNotFound(error)) redirect(`/orders/confirm/${encodeURIComponent(token)}?expired=1`);
    throw error;
  }
  const path = new URL(result.statusUrl).pathname;
  redirect(`${path}?from=checkout`);
}
