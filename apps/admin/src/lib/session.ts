import 'server-only';
import {
  type CurrentUser,
  findThemeTemplate,
  type StoreDetail,
  type ThemeTemplate,
} from '@repo/contracts';
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

const START_TEMPLATE_COOKIE = 'start_template';

/** Remembers the template picked on the marketing site until the merchant creates a store. */
export async function setStartTemplate(templateId: string): Promise<void> {
  (await cookies()).set(START_TEMPLATE_COOKIE, templateId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });
}

/** The remembered starter template, if it is still in the catalog. */
export async function getStartTemplate(): Promise<ThemeTemplate | undefined> {
  const id = (await cookies()).get(START_TEMPLATE_COOKIE)?.value;
  return id ? findThemeTemplate(id) : undefined;
}

export async function clearStartTemplate(): Promise<void> {
  (await cookies()).delete(START_TEMPLATE_COOKIE);
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
