'use server';

import type { CreatedApiToken, CreatedWebhook } from '@repo/contracts';
import { revalidatePath } from 'next/cache';
import { api } from '@/lib/api';
import { type FormState, requiredString, toFormState } from '@/lib/form';

const page = (storeId: string) => `/s/${storeId}/settings/developer`;

export async function createTokenAction(
  storeId: string,
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  let created: CreatedApiToken;
  try {
    created = await api<CreatedApiToken>(`/admin/stores/${storeId}/api-tokens`, {
      method: 'POST',
      body: {
        name: requiredString(formData, 'name'),
        permissions: formData.getAll('permissions').map(String),
      },
    });
  } catch (error) {
    return toFormState(error, formData);
  }
  revalidatePath(page(storeId));
  return {
    success: `Token created: ${created.token} — copy it now; it will not be shown again.`,
  };
}

export async function revokeTokenAction(storeId: string, tokenId: string): Promise<FormState> {
  try {
    await api(`/admin/stores/${storeId}/api-tokens/${tokenId}`, { method: 'DELETE' });
  } catch (error) {
    return toFormState(error);
  }
  revalidatePath(page(storeId));
  return { success: 'Token revoked.' };
}

export async function createWebhookAction(
  storeId: string,
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  let created: CreatedWebhook;
  try {
    created = await api<CreatedWebhook>(`/admin/stores/${storeId}/webhooks`, {
      method: 'POST',
      body: {
        topic: requiredString(formData, 'topic'),
        url: requiredString(formData, 'url').trim(),
      },
    });
  } catch (error) {
    return toFormState(error, formData);
  }
  revalidatePath(page(storeId));
  return {
    success: `Webhook added. Signing secret: ${created.secret} — store it now; it will not be shown again.`,
  };
}

export async function deleteWebhookAction(storeId: string, webhookId: string): Promise<FormState> {
  try {
    await api(`/admin/stores/${storeId}/webhooks/${webhookId}`, { method: 'DELETE' });
  } catch (error) {
    return toFormState(error);
  }
  revalidatePath(page(storeId));
  return { success: 'Webhook deleted.' };
}

export async function enableWebhookAction(storeId: string, webhookId: string): Promise<FormState> {
  try {
    await api(`/admin/stores/${storeId}/webhooks/${webhookId}/enable`, { method: 'POST' });
  } catch (error) {
    return toFormState(error);
  }
  revalidatePath(page(storeId));
  return { success: 'Webhook enabled.' };
}
