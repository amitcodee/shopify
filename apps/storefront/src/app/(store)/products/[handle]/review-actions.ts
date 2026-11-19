'use server';

import { reviewInputSchema } from '@repo/contracts';
import { revalidatePath } from 'next/cache';
import type { FormResult } from '@/components/form';
import { sf, StorefrontApiError } from '@/lib/api';
import { getCustomerToken } from '@/lib/shop';

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
