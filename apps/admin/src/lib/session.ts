import 'server-only';
import type { CurrentUser, StoreDetail } from '@repo/contracts';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { api, ApiError, SESSION_COOKIE } from './api';

export async function setSessionCookie(token: string, expiresAt: string): Promise<void> {
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: new Date(expiresAt),
  });
}

export async function clearSessionCookie(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}

/** The signed-in user (deduplicated per request). Redirects to /login when signed out. */
export const getCurrentUser = cache(() => api<CurrentUser>('/auth/me'));

/** The store the user is working in; 404 when they are not a member. */
export const getStore = cache(async (storeId: string): Promise<StoreDetail> => {
  try {
    return await api<StoreDetail>(`/admin/stores/${storeId}`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }
});
