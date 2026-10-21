import { contentSecurityPolicy, HSTS_HEADER, STATIC_SECURITY_HEADERS } from '@repo/contracts';
import { type NextRequest, NextResponse } from 'next/server';

const isProd = process.env.NODE_ENV === 'production';
const mediaOrigin = new URL(process.env.API_URL ?? 'http://localhost:4000').origin;

/** Per-request CSP nonce plus security headers for every storefront page. */
export function proxy(request: NextRequest) {
  const nonce = btoa(crypto.randomUUID());
  const csp = contentSecurityPolicy({ nonce, dev: !isProd, imageOrigins: [mediaOrigin] });

  const headers = new Headers(request.headers);
  headers.set('x-nonce', nonce);
  // Lets the root layout know the path (password pages exempt per-shopper links).
  headers.set('x-pathname', request.nextUrl.pathname);
  headers.set('Content-Security-Policy', csp);
  const response = NextResponse.next({ request: { headers } });

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
