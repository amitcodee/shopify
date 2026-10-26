'use server';

import {
  applyThemeTemplate,
  defaultTemplateFor,
  findThemeTemplate,
  type StoreSummary,
  type Theme,
  type ThemeTemplate,
} from '@repo/contracts';
import { redirect } from 'next/navigation';
import { api } from '@/lib/api';
import { type FormState, optionalString, requiredString, toFormState } from '@/lib/form';
import { clearStartTemplate } from '@/lib/session';

export async function createStoreAction(_: FormState, formData: FormData): Promise<FormState> {
  let store: StoreSummary;
  try {
    store = await api<StoreSummary>('/admin/stores', {
      method: 'POST',
      body: {
        name: requiredString(formData, 'name'),
        subdomain: requiredString(formData, 'subdomain'),
        contactEmail: requiredString(formData, 'contactEmail'),
        currency: requiredString(formData, 'currency'),
      },
    });
  } catch (error) {
    return toFormState(error, formData);
  }
  // The template picked on the marketing site wins unless the merchant chose another industry.
  const industry = optionalString(formData, 'industry') ?? '';
  const picked = findThemeTemplate(optionalString(formData, 'template') ?? '');
  const template = picked?.industry === industry ? picked : defaultTemplateFor(industry);
  if (template) await applyStarterTemplate(store.id, template);
  await clearStartTemplate();
  redirect(`/s/${store.id}`);
}

/** Best effort: the store exists either way, and the merchant can pick a template later. */
async function applyStarterTemplate(storeId: string, template: ThemeTemplate): Promise<void> {
  try {
    const current = await api<Theme>(`/admin/stores/${storeId}/theme`);
    await api(`/admin/stores/${storeId}/theme`, {
      method: 'PUT',
      body: applyThemeTemplate(template, current.settings),
    });
  } catch (error) {
    console.warn(`Could not apply starter template ${template.id} to store ${storeId}`, error);
  }
}
