import 'server-only';
import { createHmac } from 'node:crypto';
import {
  type ProblemDetails,
  STOREFRONT_HEADERS,
  storefrontSignaturePayload,
  THEME_DRAFT_HEADER,
  THEME_DRAFT_PARAM,
} from '@repo/contracts';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';

const API_URL = process.env.API_URL ?? 'http://localhost:4000';

/** Cookie holding the password-page access token for a protected store. */
export const ACCESS_COOKIE = 'storefront_access';
const LOCKED_DETAIL = 'This store is password protected.';
/** Cookie holding the shopper's chosen presentment currency. */
export const CURRENCY_COOKIE = 'currency';

export class StorefrontApiError extends Error {
  constructor(
    readonly status: number,
    readonly problem: ProblemDetails,
  ) {
    super(problem.detail ?? problem.title);
  }
}

/** The shopper's Host header — this is what selects the store. */
export async function requestHost(): Promise<string> {
  return (await headers()).get('host') ?? '';
}

interface SfOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  cartToken?: string | null;
  customerToken?: string | null;
  query?: Record<string, string | number | undefined>;
}

/**
 * Calls the storefront API on behalf of the shopper. The request is signed (HMAC) with the
 * shared secret so the API can trust which host/store it is for.
 */
export async function sf<T>(path: string, options: SfOptions = {}): Promise<T> {
  const secret = process.env.STOREFRONT_SHARED_SECRET;
  if (!secret) throw new Error('STOREFRONT_SHARED_SECRET is not configured');

  const incoming = await headers();
  const host = incoming.get('host') ?? '';
  const timestamp = String(Date.now());
  const signature = createHmac('sha256', secret)
    .update(storefrontSignaturePayload(host, timestamp))
    .digest('hex');

  const requestHeaders = new Headers({
    accept: 'application/json',
    [STOREFRONT_HEADERS.host]: host,
    [STOREFRONT_HEADERS.timestamp]: timestamp,
    [STOREFRONT_HEADERS.signature]: signature,
  });
  if (options.body !== undefined) requestHeaders.set('content-type', 'application/json');
  if (options.cartToken) requestHeaders.set(STOREFRONT_HEADERS.cart, options.cartToken);
  if (options.customerToken) requestHeaders.set(STOREFRONT_HEADERS.customer, options.customerToken);
  // Password-protected stores: the access token from the password page (HttpOnly cookie).
  const jar = await cookies();
  const access = jar.get(ACCESS_COOKIE)?.value;
  if (access && access.length <= 100) requestHeaders.set(STOREFRONT_HEADERS.access, access);
  // The shopper's currency choice; the API ignores currencies the store has not enabled.
  const currency = jar.get(CURRENCY_COOKIE)?.value;
  if (currency && /^[A-Z]{3}$/.test(currency))
    requestHeaders.set(STOREFRONT_HEADERS.currency, currency);
  // The theme editor's preview frame: a signed token (from src/proxy.ts or its partitioned
  // cookie) that makes the API serve the unpublished draft.
  const draft = incoming.get(THEME_DRAFT_HEADER) ?? jar.get(THEME_DRAFT_PARAM)?.value;
  if (draft && draft.length <= 400) requestHeaders.set(THEME_DRAFT_HEADER, draft);
  const forwardedFor = incoming.get('x-forwarded-for');
  if (forwardedFor) requestHeaders.set('x-forwarded-for', forwardedFor);

  const url = new URL(`${API_URL}/api/v1/storefront${path}`);
  for (const [key, value] of Object.entries(options.query ?? {})) {
    if (value !== undefined && value !== '') url.searchParams.set(key, String(value));
  }

  const res = await fetch(url, {
    method: options.method ?? 'GET',
    headers: requestHeaders,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    cache: 'no-store',
  });
  if (!res.ok) {
    const problem = (await res.json().catch(() => null)) as ProblemDetails | null;
    // Locked store: send the visitor to the password page (rendered by the root layout).
    if (res.status === 403 && problem?.detail === LOCKED_DETAIL) redirect('/password');
    throw new StorefrontApiError(
      res.status,
      problem ?? { type: 'about:blank', title: res.statusText, status: res.status },
    );
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export function isNotFound(error: unknown): boolean {
  return error instanceof StorefrontApiError && error.status === 404;
}

/**
 * Converts a same-host absolute URL into a path. Next.js renders absolute same-origin redirects
 * from server actions via an internal request that loses the shopper's Host header (and with it
 * the store), so same-host targets must be redirected as relative paths. External URLs
 * (e.g. a payment provider's hosted page) are returned unchanged.
 */
export async function sameHostPath(url: string): Promise<string> {
  const host = (await headers()).get('host') ?? '';
  try {
    const target = new URL(url);
    return target.host === host ? `${target.pathname}${target.search}` : url;
  } catch {
    return url;
  }
}
