'use server';

import type { Collection } from '@repo/contracts';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { api } from '@/lib/api';
import { type FormState, optionalString, requiredString, toFormState } from '@/lib/form';

function collectionBody(formData: FormData) {
  return {
    title: requiredString(formData, 'title'),
    handle: optionalString(formData, 'handle'),
    description: requiredString(formData, 'description'),
    ruleTag: optionalString(formData, 'ruleTag') ?? null,
    published: formData.get('published') === 'on',
  };
}

export async function saveCollectionAction(
  storeId: string,
  collectionId: string | null,
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  let saved: Collection;
  try {
    saved = collectionId
      ? await api<Collection>(`/admin/stores/${storeId}/collections/${collectionId}`, {
          method: 'PUT',
          body: collectionBody(formData),
        })
      : await api<Collection>(`/admin/stores/${storeId}/collections`, {
          method: 'POST',
          body: collectionBody(formData),
        });
  } catch (error) {
    return toFormState(error, formData);
  }
  revalidatePath(`/s/${storeId}/collections`);
  if (!collectionId) redirect(`/s/${storeId}/collections/${saved.id}`);
  return { success: 'Collection saved.' };
}

export async function setCollectionProductsAction(
  storeId: string,
  collectionId: string,
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  const productIds = formData.getAll('productIds').map(String);
  try {
    await api(`/admin/stores/${storeId}/collections/${collectionId}/products`, {
      method: 'PUT',
      body: { productIds },
    });
  } catch (error) {
    return toFormState(error);
  }
  revalidatePath(`/s/${storeId}/collections/${collectionId}`);
  return { success: 'Products updated.' };
}

export async function deleteCollectionAction(storeId: string, collectionId: string) {
  await api(`/admin/stores/${storeId}/collections/${collectionId}`, { method: 'DELETE' });
  revalidatePath(`/s/${storeId}/collections`);
  redirect(`/s/${storeId}/collections`);
}
