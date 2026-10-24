import {
  contentSecurityPolicy,
  findThemeTemplate,
  HSTS_HEADER,
  STATIC_SECURITY_HEADERS,
  THEME_DRAFT_HEADER,
  THEME_DRAFT_PARAM,
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
  // Theme editor preview: `?theme_draft=<token>` (then its cookie) lets the admin frame this
  // page and shows the unpublished draft. The API checks the token; here it is only forwarded.
  const draftParam = request.nextUrl.searchParams.get(THEME_DRAFT_PARAM);
  const draftToken =
    (draftParam && draftParam.length <= 400 ? draftParam : null) ??
    request.cookies.get(THEME_DRAFT_PARAM)?.value ??
    null;
  const csp = contentSecurityPolicy({
    nonce,
    dev: !isProd,
    imageOrigins: [mediaOrigin],
    formActionOrigins: [adminOrigin],
    frameAncestors: draftToken ? [adminOrigin] : "'none'",
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
  headers.delete(THEME_DRAFT_HEADER);
  if (draftToken) headers.set(THEME_DRAFT_HEADER, draftToken);
  const response = NextResponse.next({ request: { headers } });
  if (draftParam && draftToken === draftParam) {
    // Partitioned (CHIPS): the cookie only exists inside the admin's frame, so opening the
    // store in a normal tab never shows the draft.
    response.cookies.set(THEME_DRAFT_PARAM, draftParam, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      partitioned: true,
      path: '/',
      maxAge: 2 * 60 * 60,
    });
  }
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
  // Framing is governed by the CSP frame-ancestors above (X-Frame-Options cannot allow one origin).
  if (!draftToken) response.headers.set('X-Frame-Options', 'DENY');
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
