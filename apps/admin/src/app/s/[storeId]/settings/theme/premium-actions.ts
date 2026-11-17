'use server';

import type { PremiumStyleId, PurchaseTemplateResult, TemplateCheckout } from '@repo/contracts';
import { revalidatePath } from 'next/cache';
import { api, ApiError } from '@/lib/api';

export type BuyTemplateResult =
  { owned: true } | { checkout: TemplateCheckout } | { error: string };

/** Starts a one-time purchase: owned at once (development) or Razorpay Checkout to open. */
export async function buyTemplateAction(
  storeId: string,
  styleId: PremiumStyleId,
): Promise<BuyTemplateResult> {
  let result: PurchaseTemplateResult;
  try {
    result = await api<PurchaseTemplateResult>(
      `/admin/stores/${storeId}/premium-templates/purchases`,
      { method: 'POST', body: { styleId } },
    );
  } catch (error) {
    if (error instanceof ApiError) return { error: error.message };
    throw error;
  }
  if (result.status === 'owned') {
    revalidatePath(`/s/${storeId}/settings/theme`);
    return { owned: true };
  }
  return { checkout: result.checkout };
}

/** Checkout's success callback: the API verifies the signature before unlocking. */
export async function confirmTemplateAction(
  storeId: string,
  payment: { orderId: string; paymentId: string; signature: string },
): Promise<{ error?: string }> {
  try {
    await api(`/admin/stores/${storeId}/premium-templates/purchases/confirm`, {
      method: 'POST',
      body: payment,
    });
  } catch (error) {
    if (error instanceof ApiError) return { error: error.message };
    throw error;
  }
  revalidatePath(`/s/${storeId}/settings/theme`);
  revalidatePath(`/s/${storeId}/settings/billing`);
  return {};
}
