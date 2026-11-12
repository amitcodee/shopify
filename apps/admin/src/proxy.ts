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
/** Where images load from: the API (internal and public URL) and, when set, the media CDN. */
const mediaOrigins = [
  process.env.API_URL ?? 'http://localhost:4000',
  process.env.PUBLIC_API_URL,
  process.env.MEDIA_PUBLIC_URL,
].flatMap((url) => (url ? [new URL(url).origin] : []));
/** Storefronts the theme editor frames for its live preview: any store subdomain. */
const storefrontFrames = (process.env.STOREFRONT_PUBLIC_URL ?? 'http://{subdomain}.localhost:3200')
  .replace('{subdomain}', '*')
  .replace(/\/+$/, '');

/**
 * Razorpay Checkout (plan subscriptions): its script is loaded by our nonced code (allowed by
 * 'strict-dynamic'); it frames its own pages and calls its APIs.
 */
const RAZORPAY_FRAMES = ['https://api.razorpay.com', 'https://checkout.razorpay.com'];
const RAZORPAY_CONNECT = [
  'https://api.razorpay.com',
  'https://checkout.razorpay.com',
  'https://lumberjack.razorpay.com',
];
const RAZORPAY_IMAGES = ['https://cdn.razorpay.com'];

function secure(response: NextResponse, csp: string): NextResponse {
  response.headers.set('Content-Security-Policy', csp);
  response.headers.set('X-Frame-Options', 'DENY');
  for (const [name, value] of Object.entries(STATIC_SECURITY_HEADERS))
    response.headers.set(name, value);
  // Bank (3-D Secure) and UPI steps of Razorpay Checkout can open a popup that reports back.
  response.headers.set('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), payment=(self "https://api.razorpay.com")',
  );
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
    imageOrigins: [...mediaOrigins, ...RAZORPAY_IMAGES],
    frameOrigins: [storefrontFrames, ...RAZORPAY_FRAMES],
    connectOrigins: RAZORPAY_CONNECT,
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
