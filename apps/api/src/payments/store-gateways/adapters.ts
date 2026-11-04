import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { IncomingHttpHeaders } from 'node:http';
import { currencyDigits, type GatewayMode, type StoreGatewayId } from '@repo/contracts';
import Stripe from 'stripe';
import {
  type CreatedPayment,
  type CreatePaymentInput,
  InvalidWebhookError,
  type PaymentProvider,
  type RefundRequest,
  type RefundResult,
  type WebhookOutcome,
} from '../payment-provider.js';
import { headerValue, type FetchLike, RazorpayClient } from '../razorpay/razorpay-client.js';
import { RazorpayPaymentProvider } from '../razorpay/razorpay-payment.provider.js';
import { StripePaymentProvider } from '../stripe-payment.provider.js';

/** `destinationAccountId` of payments that settle directly in the merchant's own account. */
export const OWN_ACCOUNT = 'own';
const OWN_PREFIX = 'own_';

/** Payment.provider for a store-owned gateway; test keys are named apart from live ones. */
export function ownProviderName(id: StoreGatewayId, mode: GatewayMode): string {
  return `${OWN_PREFIX}${id}${mode === 'test' ? '_test' : ''}`;
}

export function parseOwnProviderName(name: string): StoreGatewayId | null {
  if (!name.startsWith(OWN_PREFIX)) return null;
  return name.slice(OWN_PREFIX.length).replace(/_test$/, '') as StoreGatewayId;
}

/** The merchant's keys were refused, as opposed to the gateway being unreachable. */
export class GatewayKeysRejectedError extends Error {}

/** The fields of an auto-submitting page that posts the shopper to a gateway. */
export interface PayForm {
  action: string;
  fields: Record<string, string>;
}

export interface PayFormInput {
  reference: string;
  amount: number;
  currency: string;
  orderId: string;
  orderNumber: number;
  email: string;
  name: string;
  phone: string;
}

export interface GatewayReturn {
  query: Record<string, string>;
  rawBody: Buffer | undefined;
}

/** A gateway running on a merchant's own keys. */
export interface StoreGatewayAdapter extends PaymentProvider {
  /** Proves the keys work with a harmless call; throws GatewayKeysRejectedError if they do not. */
  verify(): Promise<void>;
  /** Gateways that post the shopper's browser to their page build that form here. */
  payForm?(input: PayFormInput): PayForm;
  /** Gateways that report the result on the shopper's return handle it here. */
  completeReturn?(input: GatewayReturn): Promise<WebhookOutcome>;
}

export interface AdapterContext {
  storeId: string;
  name: string;
  mode: GatewayMode;
  credentials: Record<string, string>;
  /** Public API addresses for this store and gateway. */
  urls: { returnUrl: string; payUrl: (reference: string) => string };
  fetch: FetchLike;
}

const request = (ctx: AdapterContext, url: string, init: RequestInit) =>
  ctx.fetch(url, { ...init, signal: AbortSignal.timeout(20_000) });

/** Minor units as the decimal string gateways expect ("1234.50"). */
export function decimalAmount(amount: number, currency: string): string {
  const digits = currencyDigits(currency);
  return (amount / 10 ** digits).toFixed(digits);
}

/** A decimal string back to minor units, without float rounding drift. */
export function minorAmount(value: unknown, currency: string): number {
  return Math.round(Number(value) * 10 ** currencyDigits(currency));
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

// ── Razorpay and Stripe: the platform adapters without the Connect/Route split ───

class OwnRazorpay implements StoreGatewayAdapter {
  private readonly client: RazorpayClient;
  private readonly inner: RazorpayPaymentProvider;
  readonly name: string;

  constructor(ctx: AdapterContext) {
    this.name = ctx.name;
    this.client = new RazorpayClient(
      ctx.credentials.keyId ?? '',
      ctx.credentials.keySecret ?? '',
      ctx.fetch,
    );
    this.inner = new RazorpayPaymentProvider(this.client, ctx.credentials.webhookSecret ?? '');
  }

  async verify(): Promise<void> {
    try {
      await this.client.request('GET', '/v1/payments?count=1');
    } catch (error) {
      if ((error as { status?: number }).status === 401) {
        throw new GatewayKeysRejectedError('Razorpay did not accept this key ID and secret.');
      }
      throw error;
    }
  }

  createPayment(input: CreatePaymentInput): Promise<CreatedPayment> {
    return this.inner.createPayment(input);
  }

  parseWebhook(rawBody: Buffer, headers: IncomingHttpHeaders): WebhookOutcome {
    return this.inner.parseWebhook(rawBody, headers);
  }

  refund(request_: RefundRequest): Promise<RefundResult> {
    return this.inner.refund({ ...request_, reverseTransfer: false });
  }
}

class OwnStripe implements StoreGatewayAdapter {
  private readonly stripe: Stripe;
  private readonly inner: StripePaymentProvider;
  readonly name: string;

  constructor(ctx: AdapterContext) {
    this.name = ctx.name;
    this.stripe = new Stripe(ctx.credentials.secretKey ?? '');
    this.inner = new StripePaymentProvider(this.stripe, ctx.credentials.webhookSecret ?? '');
  }

  async verify(): Promise<void> {
    try {
      await this.stripe.balance.retrieve();
    } catch (error) {
      if (error instanceof Stripe.errors.StripeAuthenticationError) {
        throw new GatewayKeysRejectedError('Stripe did not accept this secret key.');
      }
      throw error;
    }
  }

  createPayment(input: CreatePaymentInput): Promise<CreatedPayment> {
    return this.inner.createPayment(input);
  }

  parseWebhook(rawBody: Buffer, headers: IncomingHttpHeaders): WebhookOutcome {
    return this.inner.parseWebhook(rawBody, headers);
  }

  refund(request_: RefundRequest): Promise<RefundResult> {
    return this.inner.refund({ ...request_, reverseTransfer: false });
  }
}

// ── PayU India: browser form post with SHA-512 hashes ────────────────────────────

const PAYU_PRODUCT_INFO = 'Store order';

export class PayuAdapter implements StoreGatewayAdapter {
  readonly name: string;
  private readonly key: string;
  private readonly salt: string;

  constructor(private readonly ctx: AdapterContext) {
    this.name = ctx.name;
    this.key = ctx.credentials.merchantKey ?? '';
    this.salt = ctx.credentials.merchantSalt ?? '';
  }

  private get host(): string {
    return this.ctx.mode === 'test' ? 'https://test.payu.in' : 'https://secure.payu.in';
  }

  private get infoHost(): string {
    return this.ctx.mode === 'test' ? 'https://test.payu.in' : 'https://info.payu.in';
  }

  private command(command: string, var1: string, extra: Record<string, string> = {}) {
    const hash = createHash('sha512')
      .update(`${this.key}|${command}|${var1}|${this.salt}`)
      .digest('hex');
    return request(this.ctx, `${this.infoHost}/merchant/postservice.php?form=2`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ key: this.key, command, var1, hash, ...extra }).toString(),
    });
  }

  async verify(): Promise<void> {
    // Looking up a transaction that cannot exist: bad keys get a hash or key error instead.
    const response = await this.command(
      'verify_payment',
      `check-${randomBytes(6).toString('hex')}`,
    );
    const text = await response.text();
    if (!response.ok) throw new Error(`PayU answered ${response.status}`);
    if (/invalid hash|invalid key|checksum|hash mismatch/i.test(text)) {
      throw new GatewayKeysRejectedError('PayU did not accept this merchant key and salt.');
    }
  }

  createPayment(input: CreatePaymentInput): Promise<CreatedPayment> {
    // PayU limits txnid to 25 characters. Each attempt needs its own.
    const reference = randomBytes(12).toString('hex');
    return Promise.resolve({
      providerRef: reference,
      checkoutUrl: this.ctx.urls.payUrl(reference),
      returnUrl: input.successUrl,
    });
  }

  payForm(input: PayFormInput): PayForm {
    const amount = decimalAmount(input.amount, input.currency);
    const firstname = input.name.split(/\s+/)[0] ?? input.name;
    const udf1 = input.orderId;
    const hash = createHash('sha512')
      .update(
        [
          this.key,
          input.reference,
          amount,
          PAYU_PRODUCT_INFO,
          firstname,
          input.email,
          udf1,
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          this.salt,
        ].join('|'),
      )
      .digest('hex');
    return {
      action: `${this.host}/_payment`,
      fields: {
        key: this.key,
        txnid: input.reference,
        amount,
        productinfo: PAYU_PRODUCT_INFO,
        firstname,
        email: input.email,
        phone: input.phone,
        udf1,
        surl: this.ctx.urls.returnUrl,
        furl: this.ctx.urls.returnUrl,
        hash,
      },
    };
  }

  /** The return post and the server-to-server webhook carry the same signed fields. */
  private outcome(rawBody: Buffer | undefined): WebhookOutcome {
    if (!rawBody) throw new InvalidWebhookError('Missing PayU fields');
    const text = rawBody.toString('utf8');
    const fields: Record<string, string> = text.trimStart().startsWith('{')
      ? (JSON.parse(text) as Record<string, string>)
      : Object.fromEntries(new URLSearchParams(text));
    const get = (name: string) => String(fields[name] ?? '');
    const reversed = [
      this.salt,
      get('status'),
      '',
      '',
      '',
      '',
      '',
      get('udf5'),
      get('udf4'),
      get('udf3'),
      get('udf2'),
      get('udf1'),
      get('email'),
      get('firstname'),
      get('productinfo'),
      get('amount'),
      get('txnid'),
      this.key,
    ].join('|');
    const charges = get('additionalCharges');
    const expected = createHash('sha512')
      .update(charges ? `${charges}|${reversed}` : reversed)
      .digest('hex');
    if (get('key') !== this.key || !safeEqual(expected, get('hash').toLowerCase())) {
      throw new InvalidWebhookError('Invalid PayU hash');
    }
    const status = get('status').toLowerCase();
    const type = `payu.${status}`;
    const eventId = `${get('mihpayid') || get('txnid')}:${status}`;
    if (status === 'success') {
      return {
        kind: 'payment_succeeded',
        eventId,
        type,
        providerRef: get('txnid'),
        providerPaymentId: get('mihpayid') || null,
        amount: minorAmount(get('amount'), 'INR'),
        currency: 'INR',
      };
    }
    if (status === 'failure' || status === 'failed' || status === 'cancel') {
      return { kind: 'payment_failed', eventId, type, providerRef: get('txnid') };
    }
    return { kind: 'ignored', eventId, type };
  }

  parseWebhook(rawBody: Buffer): WebhookOutcome {
    return this.outcome(rawBody);
  }

  completeReturn(input: GatewayReturn): Promise<WebhookOutcome> {
    return Promise.resolve(this.outcome(input.rawBody));
  }

  async refund(refund: RefundRequest): Promise<RefundResult> {
    if (!refund.providerPaymentId) throw new Error('Missing PayU payment id for refund');
    const token = createHash('sha256').update(refund.idempotencyKey).digest('hex').slice(0, 23);
    const response = await this.command('cancel_refund_transaction', refund.providerPaymentId, {
      var2: token,
      var3: decimalAmount(refund.amount, refund.currency),
    });
    if (!response.ok) throw new Error(`PayU refund answered ${response.status}`);
    const body = (await response.json()) as { status?: number; request_id?: string; msg?: string };
    if (Number(body.status) !== 1) throw new Error(`PayU refused the refund: ${body.msg ?? ''}`);
    return { providerRef: body.request_id ?? token, status: 'PENDING' };
  }
}

// ── Cashfree: payment links, signed webhooks ─────────────────────────────────────

const CASHFREE_VERSION = '2023-08-01';

export class CashfreeAdapter implements StoreGatewayAdapter {
  readonly name: string;

  constructor(private readonly ctx: AdapterContext) {
    this.name = ctx.name;
  }

  private call(method: string, path: string, body?: unknown) {
    const base =
      this.ctx.mode === 'test' ? 'https://sandbox.cashfree.com/pg' : 'https://api.cashfree.com/pg';
    return request(this.ctx, `${base}${path}`, {
      method,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'x-api-version': CASHFREE_VERSION,
        'x-client-id': this.ctx.credentials.appId ?? '',
        'x-client-secret': this.ctx.credentials.secretKey ?? '',
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  }

  async verify(): Promise<void> {
    // A link that cannot exist: working keys get 404, bad keys get 401 or 403.
    const response = await this.call('GET', `/links/check-${randomBytes(6).toString('hex')}`);
    if (response.status === 401 || response.status === 403) {
      throw new GatewayKeysRejectedError('Cashfree did not accept this app ID and secret key.');
    }
    if (response.status >= 500) throw new Error(`Cashfree answered ${response.status}`);
  }

  async createPayment(input: CreatePaymentInput): Promise<CreatedPayment> {
    const linkId = randomBytes(16).toString('hex');
    const response = await this.call('POST', '/links', {
      link_id: linkId,
      link_amount: Number(decimalAmount(input.amount, input.currency)),
      link_currency: input.currency,
      link_purpose: `Order #${input.orderNumber}`,
      customer_details: {
        customer_email: input.email,
        customer_phone: input.phone ?? '',
        ...(input.customerName ? { customer_name: input.customerName } : {}),
      },
      link_notify: { send_email: false, send_sms: false },
      link_meta: { return_url: input.successUrl },
      link_notes: { orderId: input.orderId },
    });
    const body = (await response.json()) as { link_url?: string; message?: string };
    if (!response.ok || !body.link_url) {
      throw new Error(`Cashfree link failed (${response.status}): ${body.message ?? ''}`);
    }
    return { providerRef: linkId, checkoutUrl: body.link_url };
  }

  parseWebhook(rawBody: Buffer, headers: IncomingHttpHeaders): WebhookOutcome {
    const timestamp = headerValue(headers['x-webhook-timestamp']) ?? '';
    const signature = headerValue(headers['x-webhook-signature']) ?? '';
    const expected = createHmac('sha256', this.ctx.credentials.secretKey ?? '')
      .update(`${timestamp}${rawBody.toString('utf8')}`)
      .digest('base64');
    if (!safeEqual(expected, signature))
      throw new InvalidWebhookError('Invalid Cashfree signature');

    const event = JSON.parse(rawBody.toString('utf8')) as {
      type?: string;
      data?: {
        link_id?: string;
        link_status?: string;
        link_amount_paid?: number;
        link_currency?: string;
        order?: { order_id?: string; transaction_id?: number | string };
      };
    };
    const type = event.type ?? 'unknown';
    const data = event.data;
    const eventId = `sha256:${createHash('sha256').update(rawBody).digest('hex')}`;
    if (type !== 'PAYMENT_LINK_EVENT' || !data?.link_id) return { kind: 'ignored', eventId, type };
    if (data.link_status === 'PAID') {
      const currency = (data.link_currency ?? '').toUpperCase();
      return {
        kind: 'payment_succeeded',
        eventId,
        type,
        providerRef: data.link_id,
        providerPaymentId: data.order?.order_id ?? null,
        amount: minorAmount(data.link_amount_paid ?? 0, currency || 'INR'),
        currency,
      };
    }
    if (data.link_status === 'EXPIRED' || data.link_status === 'CANCELLED') {
      return { kind: 'payment_failed', eventId, type, providerRef: data.link_id };
    }
    return { kind: 'ignored', eventId, type };
  }

  async refund(refund: RefundRequest): Promise<RefundResult> {
    if (!refund.providerPaymentId) throw new Error('Missing Cashfree order id for refund');
    const refundId = createHash('sha256').update(refund.idempotencyKey).digest('hex').slice(0, 40);
    const response = await this.call(
      'POST',
      `/orders/${encodeURIComponent(refund.providerPaymentId)}/refunds`,
      {
        refund_amount: Number(decimalAmount(refund.amount, refund.currency)),
        refund_id: refundId,
      },
    );
    const body = (await response.json()) as { refund_status?: string; message?: string };
    if (!response.ok) throw new Error(`Cashfree refund failed: ${body.message ?? ''}`);
    const status =
      body.refund_status === 'SUCCESS'
        ? 'SUCCEEDED'
        : body.refund_status === 'CANCELLED'
          ? 'FAILED'
          : 'PENDING';
    return { providerRef: refundId, status };
  }
}

// ── PayPal: orders are captured server-side when the shopper returns ─────────────

interface PaypalOrder {
  id: string;
  status: string;
  links?: { rel: string; href: string }[];
  purchase_units?: {
    payments?: {
      captures?: { id: string; status: string; amount: { value: string; currency_code: string } }[];
    };
  }[];
}

export class PaypalAdapter implements StoreGatewayAdapter {
  readonly name: string;

  constructor(private readonly ctx: AdapterContext) {
    this.name = ctx.name;
  }

  private get base(): string {
    return this.ctx.mode === 'test'
      ? 'https://api-m.sandbox.paypal.com'
      : 'https://api-m.paypal.com';
  }

  private async token(): Promise<string> {
    const basic = Buffer.from(
      `${this.ctx.credentials.clientId ?? ''}:${this.ctx.credentials.clientSecret ?? ''}`,
    ).toString('base64');
    const response = await request(this.ctx, `${this.base}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basic}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });
    if (response.status === 401) {
      throw new GatewayKeysRejectedError('PayPal did not accept this client ID and secret.');
    }
    if (!response.ok) throw new Error(`PayPal answered ${response.status}`);
    return ((await response.json()) as { access_token: string }).access_token;
  }

  private async call<T>(
    method: string,
    path: string,
    body?: unknown,
    requestId?: string,
  ): Promise<T> {
    const response = await request(this.ctx, `${this.base}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${await this.token()}`,
        'Content-Type': 'application/json',
        ...(requestId ? { 'PayPal-Request-Id': requestId } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const json = (await response.json()) as T & { message?: string };
    if (!response.ok) throw new Error(`PayPal ${response.status}: ${json.message ?? ''}`);
    return json;
  }

  async verify(): Promise<void> {
    await this.token();
  }

  async createPayment(input: CreatePaymentInput): Promise<CreatedPayment> {
    const order = await this.call<PaypalOrder>(
      'POST',
      '/v2/checkout/orders',
      {
        intent: 'CAPTURE',
        purchase_units: [
          {
            custom_id: input.orderId,
            description: `Order #${input.orderNumber}`,
            amount: {
              currency_code: input.currency,
              value: decimalAmount(input.amount, input.currency),
            },
          },
        ],
        application_context: {
          user_action: 'PAY_NOW',
          shipping_preference: 'NO_SHIPPING',
          return_url: this.ctx.urls.returnUrl,
          cancel_url: input.cancelUrl,
        },
      },
      input.idempotencyKey,
    );
    const approve = order.links?.find((l) => l.rel === 'approve' || l.rel === 'payer-action');
    if (!approve) throw new Error('PayPal did not return an approval link');
    return { providerRef: order.id, checkoutUrl: approve.href, returnUrl: input.successUrl };
  }

  /** No webhook is needed: the capture below is a server-to-server call we make ourselves. */
  parseWebhook(): WebhookOutcome {
    throw new InvalidWebhookError('PayPal payments are confirmed when the shopper returns');
  }

  async completeReturn(input: GatewayReturn): Promise<WebhookOutcome> {
    const id = input.query.token;
    if (!id) throw new InvalidWebhookError('Missing PayPal order');
    const path = `/v2/checkout/orders/${encodeURIComponent(id)}`;
    let order = await this.call<PaypalOrder>('GET', path);
    if (order.status === 'APPROVED') {
      order = await this.call<PaypalOrder>('POST', `${path}/capture`, {}, `capture-${id}`);
    }
    const capture = order.purchase_units?.[0]?.payments?.captures?.[0];
    const type = `paypal.${order.status.toLowerCase()}`;
    if (order.status === 'COMPLETED' && capture) {
      const currency = capture.amount.currency_code;
      return {
        kind: 'payment_succeeded',
        eventId: `capture:${capture.id}`,
        type,
        providerRef: order.id,
        providerPaymentId: capture.id,
        amount: minorAmount(capture.amount.value, currency),
        currency,
      };
    }
    return { kind: 'ignored', eventId: `order:${order.id}:${order.status}`, type };
  }

  async refund(refund: RefundRequest): Promise<RefundResult> {
    if (!refund.providerPaymentId) throw new Error('Missing PayPal capture id for refund');
    const result = await this.call<{ id: string; status: string }>(
      'POST',
      `/v2/payments/captures/${encodeURIComponent(refund.providerPaymentId)}/refund`,
      {
        amount: {
          value: decimalAmount(refund.amount, refund.currency),
          currency_code: refund.currency,
        },
      },
      refund.idempotencyKey,
    );
    const status =
      result.status === 'COMPLETED'
        ? 'SUCCEEDED'
        : result.status === 'FAILED' || result.status === 'CANCELLED'
          ? 'FAILED'
          : 'PENDING';
    return { providerRef: result.id, status };
  }
}

// ── PhonePe: standard checkout, re-read from PhonePe when the shopper returns ────

interface PhonepeOrderStatus {
  orderId?: string;
  state?: string;
  amount?: number;
  paymentDetails?: { transactionId?: string; state?: string }[];
}

export class PhonepeAdapter implements StoreGatewayAdapter {
  readonly name: string;

  constructor(private readonly ctx: AdapterContext) {
    this.name = ctx.name;
  }

  private get base(): string {
    return this.ctx.mode === 'test'
      ? 'https://api-preprod.phonepe.com/apis/pg-sandbox'
      : 'https://api.phonepe.com/apis/pg';
  }

  private get tokenUrl(): string {
    return this.ctx.mode === 'test'
      ? 'https://api-preprod.phonepe.com/apis/pg-sandbox/v1/oauth/token'
      : 'https://api.phonepe.com/apis/identity-manager/v1/oauth/token';
  }

  private async token(): Promise<string> {
    const response = await request(this.ctx, this.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: this.ctx.credentials.clientId ?? '',
        client_version: this.ctx.credentials.clientVersion ?? '',
        client_secret: this.ctx.credentials.clientSecret ?? '',
        grant_type: 'client_credentials',
      }).toString(),
    });
    if (response.status === 400 || response.status === 401 || response.status === 403) {
      throw new GatewayKeysRejectedError('PhonePe did not accept these client details.');
    }
    if (!response.ok) throw new Error(`PhonePe answered ${response.status}`);
    return ((await response.json()) as { access_token: string }).access_token;
  }

  private async call<T>(method: string, path: string, body?: unknown): Promise<T> {
    const response = await request(this.ctx, `${this.base}${path}`, {
      method,
      headers: {
        Authorization: `O-Bearer ${await this.token()}`,
        'Content-Type': 'application/json',
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const json = (await response.json()) as T & { message?: string };
    if (!response.ok) throw new Error(`PhonePe ${response.status}: ${json.message ?? ''}`);
    return json;
  }

  async verify(): Promise<void> {
    await this.token();
  }

  async createPayment(input: CreatePaymentInput): Promise<CreatedPayment> {
    const reference = randomBytes(16).toString('hex');
    const created = await this.call<{ redirectUrl?: string }>('POST', '/checkout/v2/pay', {
      merchantOrderId: reference,
      amount: input.amount,
      paymentFlow: {
        type: 'PG_CHECKOUT',
        message: `Order #${input.orderNumber}`,
        merchantUrls: { redirectUrl: `${this.ctx.urls.returnUrl}?reference=${reference}` },
      },
      metaInfo: { udf1: input.orderId },
    });
    if (!created.redirectUrl) throw new Error('PhonePe did not return a payment page');
    return {
      providerRef: reference,
      checkoutUrl: created.redirectUrl,
      returnUrl: input.successUrl,
    };
  }

  private outcome(reference: string, status: PhonepeOrderStatus, type: string): WebhookOutcome {
    const state = status.state ?? 'UNKNOWN';
    const eventId = `${reference}:${state}`;
    if (state === 'COMPLETED') {
      return {
        kind: 'payment_succeeded',
        eventId,
        type,
        providerRef: reference,
        providerPaymentId: status.paymentDetails?.[0]?.transactionId ?? status.orderId ?? null,
        amount: Number(status.amount ?? 0),
        currency: 'INR',
      };
    }
    if (state === 'FAILED')
      return { kind: 'payment_failed', eventId, type, providerRef: reference };
    return { kind: 'ignored', eventId, type };
  }

  /** PhonePe sends SHA-256 of "username:password", both chosen by the merchant. */
  parseWebhook(rawBody: Buffer, headers: IncomingHttpHeaders): WebhookOutcome {
    const { webhookUsername, webhookPassword } = this.ctx.credentials;
    if (!webhookUsername || !webhookPassword) {
      throw new InvalidWebhookError('PhonePe webhook details are not saved');
    }
    const expected = createHash('sha256')
      .update(`${webhookUsername}:${webhookPassword}`)
      .digest('hex');
    const given = (headerValue(headers.authorization) ?? '').replace(/^SHA256\s*/i, '');
    if (!safeEqual(expected, given.toLowerCase())) {
      throw new InvalidWebhookError('Invalid PhonePe webhook authorization');
    }
    const event = JSON.parse(rawBody.toString('utf8')) as {
      event?: string;
      payload?: PhonepeOrderStatus & { merchantOrderId?: string };
    };
    const reference = event.payload?.merchantOrderId;
    const type = event.event ?? 'unknown';
    if (!reference || !event.payload || !type.startsWith('checkout.order.')) {
      return {
        kind: 'ignored',
        eventId: `sha256:${createHash('sha256').update(rawBody).digest('hex')}`,
        type,
      };
    }
    return this.outcome(reference, event.payload, type);
  }

  /** The redirect itself proves nothing, so the result is read from PhonePe. */
  async completeReturn(input: GatewayReturn): Promise<WebhookOutcome> {
    const reference = input.query.reference;
    if (!reference) throw new InvalidWebhookError('Missing PhonePe order');
    const status = await this.call<PhonepeOrderStatus>(
      'GET',
      `/checkout/v2/order/${encodeURIComponent(reference)}/status`,
    );
    return this.outcome(reference, status, 'phonepe.return');
  }

  async refund(refund: RefundRequest): Promise<RefundResult> {
    const merchantRefundId = createHash('sha256')
      .update(refund.idempotencyKey)
      .digest('hex')
      .slice(0, 40);
    const result = await this.call<{ refundId?: string; state?: string }>(
      'POST',
      '/payments/v2/refund',
      {
        merchantRefundId,
        originalMerchantOrderId: refund.providerRef,
        amount: refund.amount,
      },
    );
    const status =
      result.state === 'COMPLETED' ? 'SUCCEEDED' : result.state === 'FAILED' ? 'FAILED' : 'PENDING';
    return { providerRef: result.refundId ?? merchantRefundId, status };
  }
}

export function createAdapter(id: StoreGatewayId, ctx: AdapterContext): StoreGatewayAdapter {
  switch (id) {
    case 'razorpay':
      return new OwnRazorpay(ctx);
    case 'stripe':
      return new OwnStripe(ctx);
    case 'payu':
      return new PayuAdapter(ctx);
    case 'cashfree':
      return new CashfreeAdapter(ctx);
    case 'paypal':
      return new PaypalAdapter(ctx);
    case 'phonepe':
      return new PhonepeAdapter(ctx);
  }
}
