import {
  contentSecurityPolicy,
  findThemeTemplate,
  HSTS_HEADER,
  STATIC_SECURITY_HEADERS,
  THEME_PREVIEW_PARAM,
} from '@repo/contracts';
import { type NextRequest, NextResponse } from 'next/server';

const isProd = process.env.NODE_ENV === 'production';
/** Mirrors THEME_PREVIEW_HEADER in src/lib/shop.ts (which is server-only, so not imported here). */
const PREVIEW_HEADER = 'x-theme-preview';
const mediaOrigin = new URL(process.env.API_URL ?? 'http://localhost:4000').origin;
// The marketing site's "Start for free" email form submits to the admin's sign-up page.
const adminOrigin = new URL(process.env.ADMIN_PUBLIC_URL ?? 'http://localhost:3100').origin;

/** Per-request CSP nonce plus security headers for every storefront page. */
export function proxy(request: NextRequest) {
  const nonce = btoa(crypto.randomUUID());
  const csp = contentSecurityPolicy({
    nonce,
    dev: !isProd,
    imageOrigins: [mediaOrigin],
    formActionOrigins: [adminOrigin],
  });

  const headers = new Headers(request.headers);
  headers.set('x-nonce', nonce);
  // Lets the root layout know the path (password pages exempt per-shopper links).
  headers.set('x-pathname', request.nextUrl.pathname);
  headers.set('Content-Security-Policy', csp);
  // Template preview: `?theme_preview=<id>` starts one for this browser session, `off` ends it.
  const preview = request.nextUrl.searchParams.get(THEME_PREVIEW_PARAM);
  const previewId = preview && (preview === 'off' || findThemeTemplate(preview)) ? preview : null;
  headers.delete(PREVIEW_HEADER);
  if (previewId) headers.set(PREVIEW_HEADER, previewId);
  const response = NextResponse.next({ request: { headers } });
  if (previewId === 'off') response.cookies.delete(THEME_PREVIEW_PARAM);
  else if (previewId) {
    response.cookies.set(THEME_PREVIEW_PARAM, previewId, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      path: '/',
    });
  }

  response.headers.set('Content-Security-Policy', csp);
  response.headers.set('X-Frame-Options', 'DENY');
  for (const [name, value] of Object.entries(STATIC_SECURITY_HEADERS))
    response.headers.set(name, value);
  if (isProd) response.headers.set('Strict-Transport-Security', HSTS_HEADER);
  return response;
}

export const config = {
  matcher: [
    {
      source: '/((?!_next/static|_next/image|favicon.ico).*)',
      missing: [{ type: 'header', key: 'next-router-prefetch' }],
    },
  ],
};
