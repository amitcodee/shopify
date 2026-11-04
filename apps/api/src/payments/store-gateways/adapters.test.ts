import { createHash, createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { InvalidWebhookError } from '../payment-provider.js';
import {
  type AdapterContext,
  CashfreeAdapter,
  decimalAmount,
  GatewayKeysRejectedError,
  minorAmount,
  ownProviderName,
  parseOwnProviderName,
  PaypalAdapter,
  PayuAdapter,
  PhonepeAdapter,
} from './adapters.js';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

function context(
  credentials: Record<string, string>,
  fetch: AdapterContext['fetch'] = () => Promise.reject(new Error('unexpected request')),
): AdapterContext {
  return {
    storeId: 'store',
    name: 'own_test',
    mode: 'test',
    credentials,
    urls: {
      returnUrl: 'https://api.example/return',
      payUrl: (reference) => `https://api.example/pay/${reference}`,
    },
    fetch,
  };
}

const sha512 = (text: string) => createHash('sha512').update(text).digest('hex');

describe('amounts and names', () => {
  it('converts between minor units and gateway decimals', () => {
    expect(decimalAmount(123450, 'INR')).toBe('1234.50');
    expect(decimalAmount(500, 'JPY')).toBe('500');
    expect(minorAmount('1234.50', 'INR')).toBe(123450);
    expect(minorAmount('19.99', 'USD')).toBe(1999);
  });

  it('names test and live payments apart and parses both back', () => {
    expect(ownProviderName('payu', 'live')).toBe('own_payu');
    expect(ownProviderName('payu', 'test')).toBe('own_payu_test');
    expect(parseOwnProviderName('own_payu_test')).toBe('payu');
    expect(parseOwnProviderName('razorpay')).toBeNull();
  });
});

describe('PayU', () => {
  const adapter = new PayuAdapter(context({ merchantKey: 'KEY', merchantSalt: 'SALT' }));
  const signed = (status: string, overrides: Record<string, string> = {}) => {
    const fields: Record<string, string> = {
      key: 'KEY',
      status,
      txnid: 'txn1',
      amount: '100.00',
      productinfo: 'Store order',
      firstname: 'Asha',
      email: 'a@example.com',
      udf1: 'order-1',
      mihpayid: '999',
      ...overrides,
    };
    fields.hash = sha512(
      `SALT|${fields.status}||||||||||order-1|a@example.com|Asha|Store order|${fields.amount}|txn1|KEY`,
    );
    return Buffer.from(new URLSearchParams(fields).toString());
  };

  it('signs the payment form with the documented field order', () => {
    const form = adapter.payForm({
      reference: 'txn1',
      amount: 10000,
      currency: 'INR',
      orderId: 'order-1',
      orderNumber: 7,
      email: 'a@example.com',
      name: 'Asha Rao',
      phone: '9876543210',
    });
    expect(form.action).toBe('https://test.payu.in/_payment');
    expect(form.fields).toMatchObject({
      txnid: 'txn1',
      amount: '100.00',
      firstname: 'Asha',
      surl: 'https://api.example/return',
    });
    expect(form.fields.hash).toBe(
      sha512('KEY|txn1|100.00|Store order|Asha|a@example.com|order-1||||||||||SALT'),
    );
  });

  it('accepts a correctly signed success and reports the payment', () => {
    expect(adapter.parseWebhook(signed('success'))).toMatchObject({
      kind: 'payment_succeeded',
      providerRef: 'txn1',
      providerPaymentId: '999',
      amount: 10000,
      currency: 'INR',
    });
    expect(adapter.parseWebhook(signed('failure')).kind).toBe('payment_failed');
  });

  it('rejects tampered amounts and a wrong merchant key', () => {
    const tampered = Buffer.from(signed('success').toString().replace('100.00', '1.00'));
    expect(() => adapter.parseWebhook(tampered)).toThrow(InvalidWebhookError);
    const other = new PayuAdapter(context({ merchantKey: 'OTHER', merchantSalt: 'SALT' }));
    expect(() => other.parseWebhook(signed('success'))).toThrow(InvalidWebhookError);
  });

  it('reports refused keys when checking them', async () => {
    const bad = new PayuAdapter(
      context({ merchantKey: 'KEY', merchantSalt: 'SALT' }, () =>
        Promise.resolve(new Response('Invalid Hash.')),
      ),
    );
    await expect(bad.verify()).rejects.toThrow(GatewayKeysRejectedError);
    const good = new PayuAdapter(
      context({ merchantKey: 'KEY', merchantSalt: 'SALT' }, () =>
        Promise.resolve(json({ status: 0, msg: '0 out of 1 Transactions Fetched Successfully' })),
      ),
    );
    await expect(good.verify()).resolves.toBeUndefined();
  });
});

describe('Cashfree', () => {
  const adapter = new CashfreeAdapter(context({ appId: 'APP', secretKey: 'SECRET' }));
  const body = Buffer.from(
    JSON.stringify({
      type: 'PAYMENT_LINK_EVENT',
      data: {
        link_id: 'link1',
        link_status: 'PAID',
        link_amount_paid: 250.5,
        link_currency: 'INR',
        order: { order_id: 'order1' },
      },
    }),
  );
  const signature = (raw: Buffer, secret = 'SECRET') =>
    createHmac('sha256', secret).update(`1700000000${raw.toString()}`).digest('base64');

  it('verifies the signature and reports a paid link', () => {
    expect(
      adapter.parseWebhook(body, {
        'x-webhook-timestamp': '1700000000',
        'x-webhook-signature': signature(body),
      }),
    ).toMatchObject({
      kind: 'payment_succeeded',
      providerRef: 'link1',
      providerPaymentId: 'order1',
      amount: 25050,
      currency: 'INR',
    });
  });

  it('rejects a forged signature', () => {
    expect(() =>
      adapter.parseWebhook(body, {
        'x-webhook-timestamp': '1700000000',
        'x-webhook-signature': signature(body, 'WRONG'),
      }),
    ).toThrow(InvalidWebhookError);
  });

  it('treats 401 as rejected keys and 404 as working keys', async () => {
    const answer = (status: number) =>
      new CashfreeAdapter(
        context({ appId: 'A', secretKey: 'S' }, () => Promise.resolve(json({}, status))),
      );
    await expect(answer(401).verify()).rejects.toThrow(GatewayKeysRejectedError);
    await expect(answer(404).verify()).resolves.toBeUndefined();
  });
});

describe('PhonePe', () => {
  const credentials = {
    clientId: 'ID',
    clientVersion: '1',
    clientSecret: 'SECRET',
    webhookUsername: 'user',
    webhookPassword: 'pass',
  };
  const authorization = createHash('sha256').update('user:pass').digest('hex');

  it('starts a payment on the test host with the amount in paise', async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const adapter = new PhonepeAdapter(
      context(credentials, (url, init) => {
        calls.push({ url, init });
        return Promise.resolve(
          url.endsWith('/oauth/token')
            ? json({ access_token: 'T' })
            : json({ orderId: 'P1', state: 'PENDING', redirectUrl: 'https://pay.phonepe/x' }),
        );
      }),
    );
    const created = await adapter.createPayment({
      storeId: 'store',
      orderId: 'order-1',
      orderNumber: 7,
      amount: 10050,
      currency: 'INR',
      email: 'a@example.com',
      successUrl: 'https://shop/orders/1',
      cancelUrl: 'https://shop/checkout',
      idempotencyKey: 'k',
      destination: null,
    });
    expect(created.checkoutUrl).toBe('https://pay.phonepe/x');
    const pay = calls.at(-1);
    expect(pay?.url).toBe('https://api-preprod.phonepe.com/apis/pg-sandbox/checkout/v2/pay');
    expect(new Headers(pay?.init.headers).get('authorization')).toBe('O-Bearer T');
    const body = JSON.parse(String(pay?.init.body));
    expect(body.amount).toBe(10050);
    expect(body.paymentFlow.merchantUrls.redirectUrl).toBe(
      `https://api.example/return?reference=${created.providerRef}`,
    );
  });

  it('marks paid from PhonePe status on return, never from the redirect alone', async () => {
    const status = (state: string) =>
      new PhonepeAdapter(
        context(credentials, (url) =>
          Promise.resolve(
            url.endsWith('/oauth/token')
              ? json({ access_token: 'T' })
              : json({
                  orderId: 'P1',
                  state,
                  amount: 10050,
                  paymentDetails: [{ transactionId: 'TX1' }],
                }),
          ),
        ),
      );
    const input = { query: { reference: 'R1' }, rawBody: undefined };
    await expect(status('COMPLETED').completeReturn(input)).resolves.toMatchObject({
      kind: 'payment_succeeded',
      providerRef: 'R1',
      providerPaymentId: 'TX1',
      amount: 10050,
      currency: 'INR',
    });
    await expect(status('FAILED').completeReturn(input)).resolves.toMatchObject({
      kind: 'payment_failed',
    });
    await expect(status('PENDING').completeReturn(input)).resolves.toMatchObject({
      kind: 'ignored',
    });
  });

  it('checks the webhook authorization', () => {
    const adapter = new PhonepeAdapter(context(credentials));
    const body = Buffer.from(
      JSON.stringify({
        event: 'checkout.order.completed',
        payload: { merchantOrderId: 'R1', orderId: 'P1', state: 'COMPLETED', amount: 500 },
      }),
    );
    expect(adapter.parseWebhook(body, { authorization })).toMatchObject({
      kind: 'payment_succeeded',
      providerRef: 'R1',
      amount: 500,
    });
    expect(() => adapter.parseWebhook(body, { authorization: 'wrong' })).toThrow(
      InvalidWebhookError,
    );
    const noWebhook = new PhonepeAdapter(context({ clientId: 'I', clientSecret: 'S' }));
    expect(() => noWebhook.parseWebhook(body, { authorization })).toThrow(InvalidWebhookError);
  });

  it('treats a refused token as rejected keys', async () => {
    const adapter = new PhonepeAdapter(context(credentials, () => Promise.resolve(json({}, 401))));
    await expect(adapter.verify()).rejects.toThrow(GatewayKeysRejectedError);
  });
});

describe('PayPal', () => {
  it('captures an approved order on return and reports the money captured', async () => {
    const calls: string[] = [];
    const adapter = new PaypalAdapter(
      context({ clientId: 'ID', clientSecret: 'SECRET' }, (url, init) => {
        calls.push(`${init.method} ${url}`);
        if (url.endsWith('/oauth2/token')) return Promise.resolve(json({ access_token: 'T' }));
        if (url.endsWith('/capture')) {
          return Promise.resolve(
            json({
              id: 'O1',
              status: 'COMPLETED',
              purchase_units: [
                {
                  payments: {
                    captures: [
                      {
                        id: 'C1',
                        status: 'COMPLETED',
                        amount: { value: '19.99', currency_code: 'USD' },
                      },
                    ],
                  },
                },
              ],
            }),
          );
        }
        return Promise.resolve(json({ id: 'O1', status: 'APPROVED' }));
      }),
    );
    await expect(
      adapter.completeReturn({ query: { token: 'O1' }, rawBody: undefined }),
    ).resolves.toMatchObject({
      kind: 'payment_succeeded',
      providerRef: 'O1',
      providerPaymentId: 'C1',
      amount: 1999,
      currency: 'USD',
    });
    expect(calls.at(-1)).toContain('/v2/checkout/orders/O1/capture');
  });

  it('does not report payment for an order the shopper never approved', async () => {
    const adapter = new PaypalAdapter(
      context({ clientId: 'ID', clientSecret: 'SECRET' }, (url) =>
        Promise.resolve(
          url.endsWith('/oauth2/token')
            ? json({ access_token: 'T' })
            : json({ id: 'O1', status: 'CREATED' }),
        ),
      ),
    );
    const outcome = await adapter.completeReturn({ query: { token: 'O1' }, rawBody: undefined });
    expect(outcome.kind).toBe('ignored');
  });
});
