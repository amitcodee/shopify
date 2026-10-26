'use server';

import { cookies } from 'next/headers';
import type { FormResult } from '@/components/form';
import { ACCESS_COOKIE, sf, StorefrontApiError } from '@/lib/api';

export async function enterPasswordAction(_: FormResult, formData: FormData): Promise<FormResult> {
  const password = String(formData.get('password') ?? '');
  let accessToken: string;
  try {
    ({ accessToken } = await sf<{ accessToken: string }>('/password', {
      method: 'POST',
      body: { password },
    }));
  } catch (error) {
    if (error instanceof StorefrontApiError) return { error: error.message };
    throw error;
  }
  (await cookies()).set(ACCESS_COOKIE, accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 30 * 24 * 60 * 60,
  });
  // Browser navigation (not a server redirect) so the next request keeps the shopper's Host.
  return { redirectTo: '/' };
}
