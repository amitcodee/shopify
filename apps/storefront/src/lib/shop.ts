import 'server-only';
import {
  applyThemeTemplate,
  type Cart,
  findThemeTemplate,
  parseStoreApps,
  parseTheme,
  type Shop,
  THEME_DRAFT_HEADER,
  THEME_DRAFT_PARAM,
  THEME_PREVIEW_PARAM,
  type ThemeTemplate,
} from '@repo/contracts';
import { cookies, headers } from 'next/headers';
import { cache } from 'react';
import { isNotFound, requestHost, sf } from './api';

export const CART_COOKIE = 'cart_token';

/** Session cookie holding the template a visitor is previewing (set by src/proxy.ts). */
export const THEME_PREVIEW_COOKIE = THEME_PREVIEW_PARAM;
/** Request header src/proxy.ts uses to pass this request's preview id (or `off`). */
export const THEME_PREVIEW_HEADER = 'x-theme-preview';

/**
 * The catalog template this visitor is previewing, if any. The proxy's header wins (it knows
 * about a `?theme_preview=` on this very request); the cookie covers requests the proxy skips.
 */
export const getThemePreview = cache(async (): Promise<ThemeTemplate | null> => {
  const id =
    (await headers()).get(THEME_PREVIEW_HEADER) ??
    (await cookies()).get(THEME_PREVIEW_COOKIE)?.value;
  return (id && findThemeTemplate(id)) || null;
});

/** True inside the theme editor's preview frame (a draft preview token is present). */
export const isEditorPreview = cache(async (): Promise<boolean> => {
  return Boolean(
    (await headers()).get(THEME_DRAFT_HEADER) ?? (await cookies()).get(THEME_DRAFT_PARAM)?.value,
  );
});

/**
 * The store for the current host, or null when the host is not a (live) store. While a
 * template is being previewed the theme is swapped for this visitor only; nothing is saved.
 */
export const getShop = cache(async (): Promise<Shop | null> => {
  let shop: Shop;
  try {
    shop = await sf<Shop>('/shop');
  } catch (error) {
    if (isNotFound(error)) return null;
    throw error;
  }
  // Fills defaults for any theme field the API did not send (e.g. one older than this app).
  shop = {
    ...shop,
    theme: parseTheme(shop.theme.preset, shop.theme.settings),
    apps: parseStoreApps(shop.apps),
  };
  const preview = await getThemePreview();
  if (!preview) return shop;
  const theme = applyThemeTemplate(preview, shop.theme.settings);
  // Sample copy fills in only what the merchant has not written themselves.
  theme.settings.heroTitle ||= preview.sample.heroTitle;
  theme.settings.announcement ||= preview.sample.announcement;
  return { ...shop, theme };
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

/**
 * Absolute origin of the store being visited (sitemaps and robots.txt need absolute URLs). The
 * TLS-terminating proxy (Caddy) reports the shopper's scheme in X-Forwarded-Proto.
 */
export async function storeOrigin(): Promise<string> {
  const forwarded = (await headers()).get('x-forwarded-proto')?.split(',')[0]?.trim();
  const protocol = forwarded === 'https' ? 'https' : 'http';
  return `${protocol}://${await requestHost()}`;
}
