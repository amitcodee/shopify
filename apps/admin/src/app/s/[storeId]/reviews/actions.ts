'use server';

import { revalidatePath } from 'next/cache';
import { api } from '@/lib/api';
import { type FormState, toFormState } from '@/lib/form';

const path = (storeId: string) => `/s/${storeId}/reviews`;

async function run(
  storeId: string,
  call: () => Promise<unknown>,
  done: string,
): Promise<FormState> {
  try {
    await call();
  } catch (error) {
    return toFormState(error);
  }
  revalidatePath(path(storeId));
  return { success: done };
}

export async function publishReviewAction(
  storeId: string,
  id: string,
  _?: FormState,
): Promise<FormState> {
  return run(
    storeId,
    () => api(`/admin/stores/${storeId}/reviews/${id}/publish`, { method: 'POST' }),
    'Review published.',
  );
}

export async function rejectReviewAction(
  storeId: string,
  id: string,
  _?: FormState,
): Promise<FormState> {
  return run(
    storeId,
    () => api(`/admin/stores/${storeId}/reviews/${id}/reject`, { method: 'POST' }),
    'Review rejected. It is hidden from your store.',
  );
}

export async function replyReviewAction(
  storeId: string,
  id: string,
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  const reply = String(formData.get('reply') ?? '').trim();
  return run(
    storeId,
    () => api(`/admin/stores/${storeId}/reviews/${id}/reply`, { method: 'PUT', body: { reply } }),
    reply ? 'Reply saved.' : 'Reply removed.',
  );
}

/** Takes one photo off a review (the review itself stays). */
export async function removeReviewPhotoAction(
  storeId: string,
  id: string,
  photoId: string,
  _?: FormState,
): Promise<FormState> {
  return run(
    storeId,
    () => api(`/admin/stores/${storeId}/reviews/${id}/photos/${photoId}`, { method: 'DELETE' }),
    'Photo removed.',
  );
}

export async function deleteReviewAction(storeId: string, id: string): Promise<void> {
  await api(`/admin/stores/${storeId}/reviews/${id}`, { method: 'DELETE' });
  revalidatePath(path(storeId));
}
