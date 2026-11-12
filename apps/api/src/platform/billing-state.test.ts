import { createHmac } from 'node:crypto';
import type { Subscription } from '@repo/db';
import { describe, expect, it } from 'vitest';
import { phoneKey } from '../checkout/checkout.service.js';
import { billingState } from './plans.service.js';
import { RazorpayBilling, subscriptionNotes } from './razorpay-billing.js';

const DAY = 24 * 60 * 60 * 1000;
const now = new Date('2026-11-12T10:00:00Z');
const at = (days: number) => new Date(now.getTime() + days * DAY);

function sub(overrides: Partial<Subscription>): Subscription {
  return {
    id: '00000000-0000-7000-8000-000000000001',
    storeId: '00000000-0000-7000-8000-000000000002',
    planId: '00000000-0000-7000-8000-000000000003',
    status: 'TRIALING',
    currentPeriodStart: at(-3),
    currentPeriodEnd: at(4),
    trialEndsAt: at(4),
    pendingPlanId: null,
    provider: 'none',
    providerRef: null,
    providerPhase: null,
    graceEndsAt: null,
    introUsed: false,
    cancelAtPeriodEnd: false,
    lastSyncedAt: null,
    createdAt: at(-3),
    updatedAt: at(-3),
    ...overrides,
  };
}

describe('billingState', () => {
  it('runs a trial without a subscription, asking to subscribe', () => {
    expect(billingState(sub({}), now)).toEqual({ locked: false, action: 'subscribe' });
  });

  it('locks the store the moment an unpaid trial ends', () => {
    expect(billingState(sub({ trialEndsAt: at(-0.01) }), now)).toEqual({
      locked: true,
      action: 'subscribe',
    });
  });

  it('gives a subscribed trial time for the first charge to land', () => {
    const subscribed = sub({ provider: 'razorpay', providerRef: 'sub_1', providerPhase: 'intro' });
    expect(billingState({ ...subscribed, trialEndsAt: at(-1) }, now)).toEqual({
      locked: false,
      action: null,
    });
    expect(billingState({ ...subscribed, trialEndsAt: at(-3) }, now).locked).toBe(true);
  });

  it('treats an abandoned checkout as not subscribed', () => {
    const pending = sub({
      provider: 'razorpay',
      providerRef: 'sub_1',
      providerPhase: 'pending_auth',
    });
    expect(billingState(pending, now).action).toBe('subscribe');
  });

  it('keeps a failing subscription online until the grace period ends', () => {
    const failing = sub({ status: 'PAST_DUE', provider: 'razorpay', providerPhase: 'regular' });
    expect(billingState({ ...failing, graceEndsAt: at(2) }, now)).toEqual({
      locked: false,
      action: 'update_payment',
    });
    expect(billingState({ ...failing, graceEndsAt: at(-1) }, now).locked).toBe(true);
  });

  it('asks to authorise the regular mandate after the intro months', () => {
    const state = billingState(
      sub({
        status: 'ACTIVE',
        provider: 'razorpay',
        providerPhase: 'pending_auth',
        trialEndsAt: null,
      }),
      now,
    );
    expect(state).toEqual({ locked: false, action: 'authorize' });
  });

  it('keeps a cancelled subscription online until the paid period ends', () => {
    expect(billingState(sub({ status: 'CANCELLED', currentPeriodEnd: at(5) }), now).locked).toBe(
      false,
    );
    expect(billingState(sub({ status: 'CANCELLED', currentPeriodEnd: at(-1) }), now).locked).toBe(
      true,
    );
    expect(billingState(sub({ status: 'EXPIRED' }), now).locked).toBe(true);
  });
});

describe('RazorpayBilling', () => {
  const billing = new RazorpayBilling('rzp_test_key', 'key-secret-123', 'webhook-secret-123');

  it('verifies the Checkout signature against the server-side subscription id', () => {
    const signature = createHmac('sha256', 'key-secret-123')
      .update('pay_ABC|sub_XYZ')
      .digest('hex');
    expect(billing.verifyCheckout('pay_ABC', 'sub_XYZ', signature)).toBe(true);
    expect(billing.verifyCheckout('pay_ABC', 'sub_OTHER', signature)).toBe(false);
    expect(billing.verifyCheckout('pay_ABC', 'sub_XYZ', 'ab'.repeat(32))).toBe(false);
  });

  it('verifies webhook bodies with the webhook secret', () => {
    const body = Buffer.from('{"event":"subscription.charged"}');
    const signature = createHmac('sha256', 'webhook-secret-123').update(body).digest('hex');
    expect(billing.verifyWebhook(body, signature)).toBe(true);
    expect(billing.verifyWebhook(body, undefined)).toBe(false);
  });

  it('sends intro, trial start and offer to Razorpay and reads notes back', async () => {
    const calls: { url: string; body: unknown }[] = [];
    const fake = new RazorpayBilling(
      'rzp_test_key',
      's3cret-key',
      'w3bhook-secret',
      (url, init) => {
        calls.push({ url, body: JSON.parse(init.body as string) });
        return Promise.resolve(
          new Response(
            JSON.stringify({
              id: 'sub_123',
              status: 'created',
              notes: { storeId: 's1', planId: 'p1', phase: 'regular' },
            }),
            { status: 200 },
          ),
        );
      },
    );
    const created = await fake.createSubscription({
      razorpayPlanId: 'plan_1',
      totalCount: 120,
      startAt: new Date('2026-11-19T10:00:00Z'),
      offerId: 'offer_ABCDEFGHIJKLMN',
      notes: { storeId: 's1', planId: 'p1', phase: 'regular' },
    });
    expect(calls[0]?.url).toBe('https://api.razorpay.com/v1/subscriptions');
    expect(calls[0]?.body).toMatchObject({
      plan_id: 'plan_1',
      total_count: 120,
      start_at: Math.floor(Date.parse('2026-11-19T10:00:00Z') / 1000),
      offer_id: 'offer_ABCDEFGHIJKLMN',
    });
    expect(subscriptionNotes(created)).toEqual({ storeId: 's1', planId: 'p1', phase: 'regular' });
  });
});

describe('phoneKey', () => {
  it('matches the same Indian number written differently', () => {
    expect(phoneKey('+91 98765 43210')).toBe(phoneKey('098765-43210'));
    expect(phoneKey('9876543210')).toBe('9876543210');
  });
});
