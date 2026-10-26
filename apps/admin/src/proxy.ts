import { contentSecurityPolicy, HSTS_HEADER, STATIC_SECURITY_HEADERS } from '@repo/contracts';
import { type NextRequest, NextResponse } from 'next/server';

const PUBLIC_PATHS = [
  '/login',
  '/signup',
  '/invite',
  '/verify-email',
  '/forgot-password',
  '/reset-password',
  '/unlock',
  // Static sample photos (template thumbnails, sign-in brand panel).
  '/media',
];
const isProd = process.env.NODE_ENV === 'production';
const mediaOrigin = new URL(process.env.API_URL ?? 'http://localhost:4000').origin;
/** Storefronts the theme editor frames for its live preview: any store subdomain. */
const storefrontFrames = (process.env.STOREFRONT_PUBLIC_URL ?? 'http://{subdomain}.localhost:3200')
  .replace('{subdomain}', '*')
  .replace(/\/+$/, '');

function secure(response: NextResponse, csp: string): NextResponse {
  response.headers.set('Content-Security-Policy', csp);
  response.headers.set('X-Frame-Options', 'DENY');
  for (const [name, value] of Object.entries(STATIC_SECURITY_HEADERS))
    response.headers.set(name, value);
  if (isProd) response.headers.set('Strict-Transport-Security', HSTS_HEADER);
  return response;
}

/**
 * 1. Per-request CSP nonce (Next applies it to its own scripts).
 * 2. Cheap pre-check: visitors without a session cookie go to /login. Real authorization
 *    happens in the API on every request.
 */
export function proxy(request: NextRequest) {
  const nonce = btoa(crypto.randomUUID());
  const csp = contentSecurityPolicy({
    nonce,
    dev: !isProd,
    imageOrigins: [mediaOrigin],
    frameOrigins: [storefrontFrames],
  });
  const { pathname, search } = request.nextUrl;

  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  if (!isPublic && !request.cookies.has('admin_session')) {
    const url = new URL('/login', request.url);
    if (pathname !== '/') url.searchParams.set('next', `${pathname}${search}`);
    return secure(NextResponse.redirect(url), csp);
  }

  const headers = new Headers(request.headers);
  headers.set('x-nonce', nonce);
  headers.set('Content-Security-Policy', csp);
  return secure(NextResponse.next({ request: { headers } }), csp);
}

export const config = {
  matcher: [
    {
      source: '/((?!_next/static|_next/image|favicon.ico).*)',
      missing: [{ type: 'header', key: 'next-router-prefetch' }],
    },
  ],
};
