'use server';

import {
  MAX_REVIEW_PHOTOS,
  type MyReview,
  type ReviewHelpful,
  type ReviewPhoto,
  reviewInputSchema,
} from '@repo/contracts';
import { revalidatePath } from 'next/cache';
import type { FormResult } from '@/components/form';
import { sf, StorefrontApiError } from '@/lib/api';
import { getCustomerToken } from '@/lib/shop';

/** Adds photos (field "files", already shrunk in the browser) to the shopper's own review. */
export async function uploadReviewPhotosAction(
  handle: string,
  formData: FormData,
): Promise<{ error?: string; photos?: ReviewPhoto[] }> {
  const files = formData.getAll('files').filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) return { error: 'Choose a photo first.' };
  if (files.length > MAX_REVIEW_PHOTOS) {
    return { error: `Add at most ${MAX_REVIEW_PHOTOS} photos.` };
  }
  const body = new FormData();
  for (const f of files) body.append('files', f, f.name || 'photo.jpg');
  try {
    const mine = await sf<MyReview>(`/products/${encodeURIComponent(handle)}/reviews/mine/photos`, {
      method: 'POST',
      customerToken: await getCustomerToken(),
      body,
    });
    revalidatePath(`/products/${handle}`);
    return { photos: mine.review?.photos ?? [] };
  } catch (error) {
    if (error instanceof StorefrontApiError) return { error: error.message };
    throw error;
  }
}

/** Removes one photo from the shopper's own review. */
export async function removeReviewPhotoAction(
  handle: string,
  photoId: string,
): Promise<{ error?: string; photos?: ReviewPhoto[] }> {
  try {
    const mine = await sf<MyReview>(
      `/products/${encodeURIComponent(handle)}/reviews/mine/photos/${encodeURIComponent(photoId)}`,
      { method: 'DELETE', customerToken: await getCustomerToken() },
    );
    revalidatePath(`/products/${handle}`);
    return { photos: mine.review?.photos ?? [] };
  } catch (error) {
    if (error instanceof StorefrontApiError) return { error: error.message };
    throw error;
  }
}

/** Marks or unmarks a review as helpful for the signed-in shopper. */
export async function markHelpfulAction(
  handle: string,
  reviewId: string,
  helpful: boolean,
): Promise<ReviewHelpful | { error: string }> {
  try {
    return await sf<ReviewHelpful>(
      `/products/${encodeURIComponent(handle)}/reviews/${encodeURIComponent(reviewId)}/helpful`,
      { method: 'PUT', customerToken: await getCustomerToken(), body: { helpful } },
    );
  } catch (error) {
    if (error instanceof StorefrontApiError) return { error: error.message };
    throw error;
  }
}

/** Saves the signed-in buyer's review of the product. */
export async function saveReviewAction(
  handle: string,
  _: FormResult,
  formData: FormData,
): Promise<FormResult> {
  const parsed = reviewInputSchema.safeParse({
    rating: Number(formData.get('rating')),
    title: String(formData.get('title') ?? ''),
    body: String(formData.get('body') ?? ''),
    authorName: String(formData.get('authorName') ?? ''),
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? 'form');
      fieldErrors[key] ??= issue.message;
    }
    return { error: 'Please check your review.', fieldErrors };
  }
  let status: string;
  try {
    const saved = await sf<{ review: { status: string } | null }>(
      `/products/${encodeURIComponent(handle)}/reviews/mine`,
      { method: 'PUT', customerToken: await getCustomerToken(), body: parsed.data },
    );
    status = saved.review?.status ?? 'PENDING';
  } catch (error) {
    if (error instanceof StorefrontApiError) return { error: error.message };
    throw error;
  }
  revalidatePath(`/products/${handle}`);
  return {
    success:
      status === 'PUBLISHED'
        ? 'Thank you! Your review is live.'
        : 'Thank you! Your review will appear once the store has checked it.',
  };
}
