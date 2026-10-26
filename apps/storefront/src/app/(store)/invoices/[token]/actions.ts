'use server';

import type { CheckoutResult } from '@repo/contracts';
import type { FormResult } from '@/components/form';
import { sameHostPath, sf, StorefrontApiError } from '@/lib/api';

export async function payInvoiceAction(token: string, _: FormResult): Promise<FormResult> {
  let result: CheckoutResult;
  try {
    result = await sf<CheckoutResult>(`/invoices/${encodeURIComponent(token)}/pay`, {
      method: 'POST',
    });
  } catch (error) {
    if (!(error instanceof StorefrontApiError)) throw error;
    return { error: error.message };
  }
  return { redirectTo: await sameHostPath(result.paymentUrl) };
}
