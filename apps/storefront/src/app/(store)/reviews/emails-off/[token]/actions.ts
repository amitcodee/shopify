'use server';

import { redirect } from 'next/navigation';
import { isNotFound, sf } from '@/lib/api';

/** Turns review request emails off (a POST, so email link scanners cannot do it). */
export async function reviewEmailsOffAction(token: string): Promise<void> {
  const path = `/reviews/emails-off/${encodeURIComponent(token)}`;
  try {
    await sf(`/review-emails/off/${encodeURIComponent(token)}`, { method: 'POST' });
  } catch (error) {
    if (isNotFound(error)) redirect(`${path}?invalid=1`);
    throw error;
  }
  redirect(`${path}?done=1`);
}
