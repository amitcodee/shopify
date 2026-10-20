'use server';

import { parseMoney } from '@repo/contracts';
import { revalidatePath } from 'next/cache';
import { api } from '@/lib/api';
import { type FormState, optionalString, requiredString, toFormState } from '@/lib/form';

export async function suspendStoreAction(
  storeId: string,
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  try {
    await api(`/platform/stores/${storeId}/suspend`, {
      method: 'POST',
      body: { reason: requiredString(formData, 'reason') },
    });
  } catch (error) {
    return toFormState(error, formData);
  }
  revalidatePath('/platform/stores');
  return { success: 'Store suspended.' };
}

export async function reactivateStoreAction(storeId: string, _: FormState): Promise<FormState> {
  try {
    await api(`/platform/stores/${storeId}/reactivate`, { method: 'POST' });
  } catch (error) {
    return toFormState(error);
  }
  revalidatePath('/platform/stores');
  return { success: 'Store reactivated.' };
}

export async function setStorePlanAction(
  storeId: string,
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  try {
    await api(`/platform/stores/${storeId}/plan`, {
      method: 'PUT',
      body: { planId: requiredString(formData, 'planId'), status: 'ACTIVE' },
    });
  } catch (error) {
    return toFormState(error, formData);
  }
  revalidatePath('/platform/stores');
  return { success: 'Plan assigned.' };
}

function limit(formData: FormData, key: string): number | null {
  const raw = optionalString(formData, key);
  return raw === undefined ? null : Number.parseInt(raw, 10);
}

export async function savePlanAction(
  planId: string | null,
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  const price = parseMoney(requiredString(formData, 'price'), 'USD');
  if (price === null) return { error: 'Enter a valid monthly price.' };
  const body = {
    code: requiredString(formData, 'code'),
    name: requiredString(formData, 'name'),
    priceMonthly: price,
    maxProducts: limit(formData, 'maxProducts'),
    maxStaff: limit(formData, 'maxStaff'),
    maxOrdersPerMonth: limit(formData, 'maxOrdersPerMonth'),
    transactionFeeBps: Math.round(Number(requiredString(formData, 'feePercent') || '0') * 100),
    active: formData.get('active') === 'on',
    sortOrder: Number.parseInt(requiredString(formData, 'sortOrder') || '0', 10),
  };
  try {
    await api(planId ? `/platform/plans/${planId}` : '/platform/plans', {
      method: planId ? 'PUT' : 'POST',
      body,
    });
  } catch (error) {
    return toFormState(error, formData);
  }
  revalidatePath('/platform/plans');
  return { success: 'Plan saved.' };
}

export async function setUserDisabledAction(
  userId: string,
  disabled: boolean,
  _: FormState,
): Promise<FormState> {
  try {
    await api(`/platform/users/${userId}/${disabled ? 'disable' : 'enable'}`, { method: 'POST' });
  } catch (error) {
    return toFormState(error);
  }
  revalidatePath('/platform/users');
  return { success: disabled ? 'User disabled.' : 'User enabled.' };
}

export async function savePlatformSettingsAction(
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  try {
    await api('/platform/settings', {
      method: 'PUT',
      body: {
        signupsEnabled: formData.get('signupsEnabled') === 'on',
        supportEmail: requiredString(formData, 'supportEmail'),
        adminNotice: requiredString(formData, 'adminNotice'),
      },
    });
  } catch (error) {
    return toFormState(error, formData);
  }
  revalidatePath('/platform/settings');
  return { success: 'Platform settings saved.' };
}
