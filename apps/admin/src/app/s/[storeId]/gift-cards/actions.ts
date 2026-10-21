'use server';

import { type IssuedGiftCard, parseMoney } from '@repo/contracts';
import { revalidatePath } from 'next/cache';
import { api } from '@/lib/api';
import {
  type FormState,
  formValues,
  optionalString,
  requiredString,
  toFormState,
} from '@/lib/form';

function amount(formData: FormData, key: string, currency: string): number | null {
  const raw = requiredString(formData, key).trim();
  const negative = raw.startsWith('-');
  const value = parseMoney(negative ? raw.slice(1) : raw, currency);
  return value === null ? null : negative ? -value : value;
}

export async function issueGiftCardAction(
  storeId: string,
  currency: string,
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  const initialValue = amount(formData, 'initialValue', currency);
  if (initialValue === null || initialValue <= 0) {
    return {
      error: 'Please fix the highlighted fields.',
      fieldErrors: { initialValue: 'Enter an amount, e.g. 25.00' },
      values: formValues(formData),
    };
  }
  let card: IssuedGiftCard;
  try {
    card = await api<IssuedGiftCard>(`/admin/stores/${storeId}/gift-cards`, {
      method: 'POST',
      body: {
        initialValue,
        code: optionalString(formData, 'code'),
        expiresOn: optionalString(formData, 'expiresOn'),
        customerEmail: optionalString(formData, 'customerEmail'),
        notifyCustomer: formData.get('notifyCustomer') === 'on',
        note: optionalString(formData, 'note'),
      },
    });
  } catch (error) {
    return toFormState(error, formData);
  }
  revalidatePath(`/s/${storeId}/gift-cards`);
  return {
    success: `Gift card issued. Code: ${card.code} — copy it now; it will not be shown again.`,
  };
}

export async function updateGiftCardAction(
  storeId: string,
  giftCardId: string,
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  try {
    await api(`/admin/stores/${storeId}/gift-cards/${giftCardId}`, {
      method: 'PATCH',
      body: {
        note: optionalString(formData, 'note') ?? null,
        expiresOn: optionalString(formData, 'expiresOn') ?? null,
      },
    });
  } catch (error) {
    return toFormState(error, formData);
  }
  revalidatePath(`/s/${storeId}/gift-cards/${giftCardId}`);
  return { success: 'Gift card saved.' };
}

export async function setGiftCardDisabledAction(
  storeId: string,
  giftCardId: string,
  disabled: boolean,
  _: FormState,
): Promise<FormState> {
  try {
    await api(`/admin/stores/${storeId}/gift-cards/${giftCardId}`, {
      method: 'PATCH',
      body: { disabled },
    });
  } catch (error) {
    return toFormState(error);
  }
  revalidatePath(`/s/${storeId}/gift-cards/${giftCardId}`);
  return { success: disabled ? 'Gift card disabled.' : 'Gift card enabled.' };
}

export async function adjustGiftCardAction(
  storeId: string,
  giftCardId: string,
  currency: string,
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  const change = amount(formData, 'amount', currency);
  if (change === null || change === 0) {
    return {
      error: 'Please fix the highlighted fields.',
      fieldErrors: { amount: 'Enter an amount, e.g. 10.00 or -5.00' },
      values: formValues(formData),
    };
  }
  try {
    await api(`/admin/stores/${storeId}/gift-cards/${giftCardId}/adjustments`, {
      method: 'POST',
      body: { amount: change, note: requiredString(formData, 'note') },
    });
  } catch (error) {
    return toFormState(error, formData);
  }
  revalidatePath(`/s/${storeId}/gift-cards/${giftCardId}`);
  return { success: 'Balance updated.' };
}
