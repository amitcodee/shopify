import { createHmac, timingSafeEqual } from 'node:crypto';

export type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

export class RazorpayError extends Error {
  constructor(
    readonly status: number,
    readonly code: string | null,
    description: string,
  ) {
    super(`Razorpay ${status}${code ? ` ${code}` : ''}: ${description}`);
  }
}

/**
 * Minimal Razorpay REST client (no SDK): Basic auth with the key id and secret, JSON in and out,
 * non-2xx answers become RazorpayError. `fetch` and the base URL are injectable for tests.
 */
export class RazorpayClient {
  private readonly authorization: string;

  constructor(
    keyId: string,
    keySecret: string,
    private readonly fetchImpl: FetchLike = (url, init) => fetch(url, init),
    private readonly baseUrl = 'https://api.razorpay.com',
  ) {
    this.authorization = `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}`;
  }

  async request<T>(
    method: 'GET' | 'POST' | 'PATCH',
    path: string,
    body?: unknown,
    headers: Record<string, string> = {},
  ): Promise<T> {
    const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
      method,
      headers: {
        Accept: 'application/json',
        Authorization: this.authorization,
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(20_000),
    });
    const text = await response.text();
    const json = text ? (JSON.parse(text) as unknown) : {};
    if (!response.ok) {
      const error = (json as { error?: { code?: string; description?: string } }).error;
      throw new RazorpayError(
        response.status,
        error?.code ?? null,
        error?.description ?? response.statusText,
      );
    }
    return json as T;
  }
}

/** Razorpay signs webhook bodies with HMAC-SHA256 (hex) using the webhook secret. */
export function verifyRazorpaySignature(
  rawBody: Buffer,
  signature: string | undefined,
  secret: string,
): boolean {
  if (!signature) return false;
  const expected = Buffer.from(createHmac('sha256', secret).update(rawBody).digest('hex'), 'hex');
  const given = Buffer.from(signature, 'hex');
  return expected.length === given.length && timingSafeEqual(expected, given);
}

export function signRazorpayBody(rawBody: Buffer | string, secret: string): string {
  return createHmac('sha256', secret).update(rawBody).digest('hex');
}

/** Envelope of every Razorpay webhook. */
export interface RazorpayEvent {
  entity: 'event';
  account_id?: string;
  event: string;
  contains?: string[];
  payload: Record<string, { entity: Record<string, unknown> } | undefined>;
  created_at: number;
}

export function headerValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** A string field from an untyped webhook payload ('' when absent or not a string/number). */
export function str(value: unknown): string {
  return typeof value === 'string' ? value : typeof value === 'number' ? String(value) : '';
}
