import type { FetchLike } from '../src/payments/razorpay/razorpay-client.js';
import { signRazorpayBody } from '../src/payments/razorpay/razorpay-client.js';

export const RAZORPAY_TEST_SECRET = 'razorpay-webhook-secret-for-tests';

export interface RecordedRequest {
  method: string;
  path: string;
  body: Record<string, unknown> | null;
  headers: Record<string, string>;
}

/**
 * In-memory stand-in for api.razorpay.com: answers the Route and Payment Links endpoints the
 * adapters call and records every request so tests can assert on exactly what was sent.
 */
export class FakeRazorpay {
  readonly requests: RecordedRequest[] = [];
  /** Activation status returned when the product configuration is updated or fetched. */
  productStatus = 'under_review';
  private links = 0;

  readonly fetch: FetchLike = (url, init) => {
    const path = new URL(url).pathname;
    const method = init.method ?? 'GET';
    const body =
      typeof init.body === 'string' ? (JSON.parse(init.body) as Record<string, unknown>) : null;
    this.requests.push({
      method,
      path,
      body,
      headers: Object.fromEntries(new Headers(init.headers).entries()),
    });
    return Promise.resolve(this.respond(method, path));
  };

  last(method: string, pathPattern: RegExp): RecordedRequest | undefined {
    return this.requests.findLast((r) => r.method === method && pathPattern.test(r.path));
  }

  private respond(method: string, path: string): Response {
    const json = (status: number, payload: object) =>
      new Response(JSON.stringify(payload), {
        status,
        headers: { 'content-type': 'application/json' },
      });
    if (method === 'POST' && path === '/v2/accounts') {
      return json(200, { id: `acc_test${this.requests.length}`, status: 'created' });
    }
    if (method === 'POST' && /^\/v2\/accounts\/[^/]+\/stakeholders$/.test(path)) {
      return json(200, { id: 'sth_test1' });
    }
    if (method === 'POST' && /^\/v2\/accounts\/[^/]+\/products$/.test(path)) {
      return json(200, { id: 'acc_prd_test1', activation_status: 'requested', requirements: [] });
    }
    if ((method === 'PATCH' || method === 'GET') && /\/products\/acc_prd_test1$/.test(path)) {
      return json(200, {
        id: 'acc_prd_test1',
        activation_status: this.productStatus,
        requirements:
          this.productStatus === 'needs_clarification'
            ? [{ field_reference: 'settlements.ifsc_code', status: 'required' }]
            : [],
      });
    }
    if (method === 'POST' && path === '/v1/payment_links') {
      this.links += 1;
      return json(200, {
        id: `plink_test${this.links}`,
        short_url: `https://rzp.io/i/test${this.links}`,
      });
    }
    if (method === 'POST' && /^\/v1\/payments\/[^/]+\/refund$/.test(path)) {
      return json(200, { id: 'rfnd_test1', status: 'processed' });
    }
    return json(400, {
      error: { code: 'BAD_REQUEST_ERROR', description: `Unhandled ${method} ${path}` },
    });
  }
}

/** A signed Razorpay webhook delivery. */
export function razorpayWebhook(
  event: object,
  eventId = `evt_${Math.random().toString(36).slice(2)}`,
) {
  const body = JSON.stringify(event);
  return {
    body,
    headers: {
      'content-type': 'application/json',
      'x-razorpay-signature': signRazorpayBody(body, RAZORPAY_TEST_SECRET),
      'x-razorpay-event-id': eventId,
    },
  };
}
