import 'server-only';
import type { ProblemDetails } from '@repo/contracts';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';

const API_URL = process.env.API_URL ?? 'http://localhost:4000';
export const SESSION_COOKIE = 'admin_session';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly problem: ProblemDetails,
  ) {
    super(problem.detail ?? problem.title);
  }
}

interface ApiOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  /** Send the staff session token (default true). */
  auth?: boolean;
  query?: Record<string, string | number | undefined>;
}

/**
 * Server-side API client (backend-for-frontend). The browser never talks to the API directly:
 * the session token lives in an HttpOnly cookie on the admin origin and is forwarded here.
 */
export async function api<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const { method = 'GET', body, auth = true, query } = options;
  const requestHeaders = new Headers({ accept: 'application/json' });
  if (body !== undefined && !(body instanceof FormData)) {
    requestHeaders.set('content-type', 'application/json');
  }
  if (auth) {
    const token = (await cookies()).get(SESSION_COOKIE)?.value;
    if (token) requestHeaders.set('authorization', `Bearer ${token}`);
  }
  const forwardedFor = (await headers()).get('x-forwarded-for');
  if (forwardedFor) requestHeaders.set('x-forwarded-for', forwardedFor);

  const url = new URL(`${API_URL}/api/v1${path}`);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== '') url.searchParams.set(key, String(value));
  }

  const res = await fetch(url, {
    method,
    headers: requestHeaders,
    body: body instanceof FormData ? body : body === undefined ? undefined : JSON.stringify(body),
    cache: 'no-store',
  });

  if (res.status === 401 && auth) redirect('/login?expired=1');
  if (!res.ok) {
    const problem = (await res.json().catch(() => null)) as ProblemDetails | null;
    throw new ApiError(
      res.status,
      problem ?? { type: 'about:blank', title: res.statusText, status: res.status },
    );
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
