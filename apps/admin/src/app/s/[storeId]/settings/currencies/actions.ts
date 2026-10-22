'use server';

import { CURRENCY_ROUNDINGS, type CurrencyRounding, SUPPORTED_CURRENCIES } from '@repo/contracts';
import { revalidatePath } from 'next/cache';
import { api } from '@/lib/api';
import { type FormState, formValues, requiredString, toFormState } from '@/lib/form';

export async function saveCurrenciesAction(
  storeId: string,
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  const currencies = [];
  for (const code of SUPPORTED_CURRENCIES) {
    if (formData.get(`enabled-${code}`) !== 'on') continue;
    const rate = Number(requiredString(formData, `rate-${code}`));
    if (!Number.isFinite(rate) || rate <= 0) {
      return { error: `Enter an exchange rate for ${code}.`, values: formValues(formData) };
    }
    const rounding = requiredString(formData, `rounding-${code}`) as CurrencyRounding;
    currencies.push({
      currency: code,
      rate,
      rounding: CURRENCY_ROUNDINGS.includes(rounding) ? rounding : 'EXACT',
    });
  }
  try {
    await api(`/admin/stores/${storeId}/currencies`, { method: 'PUT', body: { currencies } });
  } catch (error) {
    return toFormState(error, formData);
  }
  revalidatePath(`/s/${storeId}/settings/currencies`);
  return { success: 'Currencies saved.' };
}
