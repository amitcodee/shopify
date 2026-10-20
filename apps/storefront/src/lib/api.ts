import 'server-only';
import { createHmac } from 'node:crypto';
import {
  type ProblemDetails,
  STOREFRONT_HEADERS,
  storefrontSignaturePayload,
} from '@repo/contracts';
import { headers } from 'next/headers';

const API_URL = process.env.API_URL ?? 'http://localhost:4000';

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
