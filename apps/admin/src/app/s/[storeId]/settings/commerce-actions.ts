'use server';

import { applyThemeTemplate, findThemeTemplate, parseMoney, type Theme } from '@repo/contracts';
import { revalidatePath } from 'next/cache';
import { api, ApiError } from '@/lib/api';
import { type FormState, optionalString, requiredString, toFormState } from '@/lib/form';

const settingsPath = (storeId: string, tab: string) => `/s/${storeId}/settings/${tab}`;

function money(formData: FormData, key: string, currency: string): number | null | undefined {
  const raw = optionalString(formData, key);
  if (raw === undefined) return null;
  const parsed = parseMoney(raw, currency);
  return parsed === null ? undefined : parsed;
}

function integer(formData: FormData, key: string): number | null {
  const raw = optionalString(formData, key);
  return raw === undefined ? null : Number.parseInt(raw, 10);
}

// Theme
export async function saveThemeAction(
  storeId: string,
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  const text = (key: string) => requiredString(formData, key);
  try {
    await api(`/admin/stores/${storeId}/theme`, {
      method: 'PUT',
      body: {
        preset: text('preset'),
        settings: {
          template: text('template'),
          brandColor: text('brandColor'),
          accentColor: text('accentColor'),
          backgroundColor: text('backgroundColor'),
          surfaceColor: text('surfaceColor'),
          textColor: text('textColor'),
          font: text('font'),
          headingFont: text('headingFont'),
          headingCase: text('headingCase'),
          radius: text('radius'),
          buttonStyle: text('buttonStyle'),
          headerStyle: text('headerStyle'),
          cardStyle: text('cardStyle'),
          imageRatio: text('imageRatio'),
          gridColumns: integer(formData, 'gridColumns') ?? 4,
          density: text('density'),
          footerStyle: text('footerStyle'),
          showCollections: formData.get('showCollections') === 'on',
          heroTitle: text('heroTitle'),
          heroSubtitle: text('heroSubtitle'),
          heroCta: text('heroCta'),
          featuredTitle: text('featuredTitle'),
          announcement: text('announcement'),
        },
      },
    });
  } catch (error) {
    const state = toFormState(error, formData);
    // The API reports `settings.brandColor`; the form's fields are named `brandColor`.
    const fieldErrors = Object.fromEntries(
      Object.entries(state?.fieldErrors ?? {}).map(([key, message]) => [
        key.replace(/^settings\./, ''),
        message,
      ]),
    );
    return { ...state, fieldErrors };
  }
  revalidatePath(settingsPath(storeId, 'theme'));
  return { success: 'Theme saved. Your storefront updates within 30 seconds.' };
}

/** Applies a catalog template's design, keeping the merchant's own homepage text. */
export async function applyTemplateAction(
  storeId: string,
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  const template = findThemeTemplate(requiredString(formData, 'templateId'));
  if (!template) return { error: 'That template no longer exists.' };
  try {
    const current = await api<Theme>(`/admin/stores/${storeId}/theme`);
    await api(`/admin/stores/${storeId}/theme`, {
      method: 'PUT',
      body: applyThemeTemplate(template, current.settings),
    });
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    return { error: `“${template.name}” could not be applied: ${error.message}` };
  }
  revalidatePath(settingsPath(storeId, 'theme'));
  return { success: `“${template.name}” applied. Your storefront updates within 30 seconds.` };
}

// Domains
export async function addDomainAction(
  storeId: string,
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  try {
    await api(`/admin/stores/${storeId}/domains`, {
      method: 'POST',
      body: { hostname: requiredString(formData, 'hostname') },
    });
  } catch (error) {
    return toFormState(error, formData);
  }
  revalidatePath(settingsPath(storeId, 'domains'));
  return { success: 'Domain added. Publish the DNS records below, then verify.' };
}

export async function domainAction(
  storeId: string,
  domainId: string,
  action: 'verify' | 'primary' | 'remove',
  _: FormState,
): Promise<FormState> {
  try {
    if (action === 'remove') {
      await api(`/admin/stores/${storeId}/domains/${domainId}`, { method: 'DELETE' });
    } else {
      await api(`/admin/stores/${storeId}/domains/${domainId}/${action}`, { method: 'POST' });
    }
  } catch (error) {
    return toFormState(error);
  }
  revalidatePath(settingsPath(storeId, 'domains'));
  return {
    success:
      action === 'verify'
        ? 'Domain verified.'
        : action === 'primary'
          ? 'Primary domain updated.'
          : 'Domain removed.',
  };
}

// Shipping
export async function createZoneAction(
  storeId: string,
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  const countries = requiredString(formData, 'countries')
    .split(/[\s,]+/)
    .map((c) => c.trim())
    .filter(Boolean);
  try {
    await api(`/admin/stores/${storeId}/shipping-zones`, {
      method: 'POST',
      body: { name: requiredString(formData, 'name'), countries },
    });
  } catch (error) {
    return toFormState(error, formData);
  }
  revalidatePath(settingsPath(storeId, 'shipping'));
  return { success: 'Zone created.' };
}

export async function addRateAction(
  storeId: string,
  zoneId: string,
  currency: string,
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  const price = money(formData, 'price', currency);
  const minSubtotal = money(formData, 'minSubtotal', currency);
  const maxSubtotal = money(formData, 'maxSubtotal', currency);
  if (
    price === null ||
    price === undefined ||
    minSubtotal === undefined ||
    maxSubtotal === undefined
  ) {
    return { error: 'Enter valid amounts (e.g. 7.50).' };
  }
  try {
    await api(`/admin/stores/${storeId}/shipping-zones/${zoneId}/rates`, {
      method: 'POST',
      body: {
        name: requiredString(formData, 'name'),
        price,
        minSubtotal,
        maxSubtotal,
        minWeightGrams: integer(formData, 'minWeightGrams'),
        maxWeightGrams: integer(formData, 'maxWeightGrams'),
      },
    });
  } catch (error) {
    return toFormState(error, formData);
  }
  revalidatePath(settingsPath(storeId, 'shipping'));
  return { success: 'Rate added.' };
}

export async function deleteZoneAction(storeId: string, zoneId: string): Promise<void> {
  await api(`/admin/stores/${storeId}/shipping-zones/${zoneId}`, { method: 'DELETE' });
  revalidatePath(settingsPath(storeId, 'shipping'));
}

export async function deleteRateAction(storeId: string, rateId: string): Promise<void> {
  await api(`/admin/stores/${storeId}/shipping-rates/${rateId}`, { method: 'DELETE' });
  revalidatePath(settingsPath(storeId, 'shipping'));
}

// Taxes
export async function saveTaxRateAction(
  storeId: string,
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  const percent = Number(requiredString(formData, 'percent'));
  if (!Number.isFinite(percent) || percent < 0 || percent > 100)
    return { error: 'Enter a rate between 0 and 100.' };
  try {
    await api(`/admin/stores/${storeId}/tax-rates`, {
      method: 'PUT',
      body: {
        country: requiredString(formData, 'country'),
        region: optionalString(formData, 'region') ?? '',
        name: requiredString(formData, 'name'),
        rateBps: Math.round(percent * 100),
        appliesToShipping: formData.get('appliesToShipping') === 'on',
      },
    });
  } catch (error) {
    return toFormState(error, formData);
  }
  revalidatePath(settingsPath(storeId, 'taxes'));
  return { success: 'Tax rate saved.' };
}

export async function deleteTaxRateAction(storeId: string, rateId: string): Promise<void> {
  await api(`/admin/stores/${storeId}/tax-rates/${rateId}`, { method: 'DELETE' });
  revalidatePath(settingsPath(storeId, 'taxes'));
}

// Discounts
export async function createDiscountAction(
  storeId: string,
  currency: string,
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  const type = requiredString(formData, 'type');
  let value = 0;
  if (type === 'PERCENTAGE') value = Number.parseInt(requiredString(formData, 'value'), 10);
  if (type === 'FIXED_AMOUNT')
    value = parseMoney(requiredString(formData, 'value'), currency) ?? -1;
  const minSubtotal = money(formData, 'minSubtotal', currency);
  if (minSubtotal === undefined) return { error: 'Enter a valid minimum order amount.' };
  const date = (key: string) => {
    const raw = optionalString(formData, key);
    return raw ? new Date(raw).toISOString() : null;
  };
  try {
    await api(`/admin/stores/${storeId}/discounts`, {
      method: 'POST',
      body: {
        code: requiredString(formData, 'code'),
        type,
        value,
        minSubtotal,
        usageLimit: integer(formData, 'usageLimit'),
        startsAt: date('startsAt'),
        endsAt: date('endsAt'),
        active: true,
      },
    });
  } catch (error) {
    return toFormState(error, formData);
  }
  revalidatePath(`/s/${storeId}/discounts`);
  return { success: 'Discount created.' };
}

export async function toggleDiscountAction(
  storeId: string,
  discountId: string,
  active: boolean,
): Promise<void> {
  await api(`/admin/stores/${storeId}/discounts/${discountId}`, {
    method: 'PATCH',
    body: { active },
  });
  revalidatePath(`/s/${storeId}/discounts`);
}

export async function deleteDiscountAction(storeId: string, discountId: string): Promise<void> {
  await api(`/admin/stores/${storeId}/discounts/${discountId}`, { method: 'DELETE' });
  revalidatePath(`/s/${storeId}/discounts`);
}
