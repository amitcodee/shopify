'use server';

import type { ChangePlanResult, RazorpayCheckout } from '@repo/contracts';
import { revalidatePath } from 'next/cache';
import { ApiError, api } from '@/lib/api';
import { type FormState, toFormState } from '@/lib/form';

export type SubscribeResult =
  { error: string } | { checkout: RazorpayCheckout } | { redirectUrl: string } | { done: true };

/** Starts (or changes) the subscription; Razorpay continues in Checkout in the browser. */
export async function subscribeAction(storeId: string, planId: string): Promise<SubscribeResult> {
  let result: ChangePlanResult;
  try {
    result = await api<ChangePlanResult>(`/admin/stores/${storeId}/billing/plan`, {
      method: 'POST',
      body: { planId },
    });
  } catch (error) {
    if (error instanceof ApiError) return { error: error.message };
    throw error;
  }
  revalidatePath(`/s/${storeId}`, 'layout');
  if (result.checkout) return { checkout: result.checkout };
  if (result.checkoutUrl) return { redirectUrl: result.checkoutUrl };
  return { done: true };
}

/** Razorpay Checkout's success callback: the API verifies the signature and syncs the plan. */
export async function confirmRazorpayAction(
  storeId: string,
  payment: { paymentId: string; subscriptionId: string; signature: string },
): Promise<{ error?: string }> {
  try {
    await api(`/admin/stores/${storeId}/billing/razorpay/confirm`, {
      method: 'POST',
      body: payment,
    });
  } catch (error) {
    if (error instanceof ApiError) return { error: error.message };
    throw error;
  }
  revalidatePath(`/s/${storeId}`, 'layout');
  return {};
}

export async function syncBillingAction(storeId: string): Promise<void> {
  await api(`/admin/stores/${storeId}/billing/sync`, { method: 'POST' }).catch(() => undefined);
  revalidatePath(`/s/${storeId}`, 'layout');
}

export async function cancelSubscriptionAction(storeId: string, _: FormState): Promise<FormState> {
  try {
    await api(`/admin/stores/${storeId}/billing/cancel`, { method: 'POST' });
  } catch (error) {
    return toFormState(error);
  }
  revalidatePath(`/s/${storeId}`, 'layout');
  return { success: 'Subscription cancelled.' };
}
