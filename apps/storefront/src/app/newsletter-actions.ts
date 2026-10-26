'use server';

import { newsletterSignupSchema } from '@repo/contracts';
import { sf, StorefrontApiError } from '@/lib/api';

export type NewsletterState = { error?: string; success?: string } | undefined;

/** Subscribes an email to the store's marketing list. The API never says if it was already on it. */
export async function subscribeAction(
  _: NewsletterState,
  formData: FormData,
): Promise<NewsletterState> {
  const parsed = newsletterSignupSchema.safeParse({ email: String(formData.get('email') ?? '') });
  if (!parsed.success) return { error: 'Enter a valid email address.' };
  try {
    await sf<void>('/newsletter', { method: 'POST', body: parsed.data });
  } catch (error) {
    if (!(error instanceof StorefrontApiError)) throw error;
    if (error.status === 429) return { error: 'Too many attempts. Please try again in a minute.' };
    if (error.status === 400) return { error: 'Enter a valid email address.' };
    return { error: 'We could not sign you up right now. Please try again.' };
  }
  return { success: 'Thanks for subscribing!' };
}
