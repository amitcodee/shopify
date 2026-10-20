import 'server-only';
import type { Cart, Shop } from '@repo/contracts';
import { cookies } from 'next/headers';
import { cache } from 'react';
import { isNotFound, sf } from './api';

export const CART_COOKIE = 'cart_token';

/** The store for the current host, or null when the host is not a (live) store. */
export const getShop = cache(async (): Promise<Shop | null> => {
  try {
    return await sf<Shop>('/shop');
  } catch (error) {
    if (isNotFound(error)) return null;
    throw error;
  }
});

export async function getCartToken(): Promise<string | null> {
  return (await cookies()).get(CART_COOKIE)?.value ?? null;
}

export async function setCartToken(token: string): Promise<void> {
  (await cookies()).set(CART_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 30 * 24 * 60 * 60,
  });
}

/** The shopper's cart, or null if they have none yet (or it expired). */
export const getCart = cache(async (): Promise<Cart | null> => {
  const token = await getCartToken();
  if (!token) return null;
  try {
    return await sf<Cart>('/cart', { cartToken: token });
  } catch (error) {
    if (isNotFound(error)) return null;
    throw error;
  }
});

export function isRootHost(host: string): boolean {
  const root = (process.env.STOREFRONT_ROOT_DOMAIN ?? 'localhost').toLowerCase();
  const hostname = host.toLowerCase().replace(/:\d+$/, '');
  return hostname === root || hostname === `www.${root}`;
}

export const CUSTOMER_COOKIE = 'customer_session';

export async function getCustomerToken(): Promise<string | null> {
  return (await cookies()).get(CUSTOMER_COOKIE)?.value ?? null;
}

export async function setCustomerToken(token: string, expiresAt: string): Promise<void> {
  (await cookies()).set(CUSTOMER_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: new Date(expiresAt),
  });
}

export async function clearCustomerToken(): Promise<void> {
  (await cookies()).delete(CUSTOMER_COOKIE);
}
