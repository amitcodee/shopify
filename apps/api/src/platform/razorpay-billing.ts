import { createHmac, timingSafeEqual } from 'node:crypto';
import {
  type FetchLike,
  RazorpayClient,
  verifyRazorpaySignature,
} from '../payments/razorpay/razorpay-client.js';

/** Razorpay subscription states (https://razorpay.com/docs/payments/subscriptions/states/). */
export type RazorpaySubscriptionStatus =
  | 'created'
  | 'authenticated'
  | 'active'
  | 'pending'
  | 'halted'
  | 'cancelled'
  | 'completed'
  | 'expired'
  | 'paused';

export interface RazorpaySubscription {
  id: string;
  plan_id: string;
  status: RazorpaySubscriptionStatus;
  /** Unix seconds; null until the first charge. */
  current_start: number | null;
  current_end: number | null;
  start_at: number | null;
  charge_at: number | null;
  paid_count: number;
  total_count: number;
  remaining_count: number | string;
  short_url: string | null;
  offer_id?: string | null;
  notes: Record<string, string> | unknown[];
}

export interface RazorpayInvoice {
  id: string;
  status: string;
  amount_paid: number;
  amount: number;
  currency: string;
  billing_start: number | null;
  billing_end: number | null;
  paid_at: number | null;
  subscription_id: string | null;
}

export interface RazorpayPlanIds {
  regular?: string;
  intro?: string;
}

/** Notes we attach to every subscription so webhooks map back to a store and plan. */
export interface SubscriptionNotes {
  storeId: string;
  planId: string;
  /** "intro": the intro months on their own mandate; "regular": the normal price. */
  phase: 'intro' | 'regular';
}

export function subscriptionNotes(sub: RazorpaySubscription): Partial<SubscriptionNotes> {
  if (Array.isArray(sub.notes)) return {};
  const notes = sub.notes;
  return {
    storeId: notes.storeId,
    planId: notes.planId,
    phase: notes.phase === 'intro' ? 'intro' : notes.phase === 'regular' ? 'regular' : undefined,
  };
}

/**
 * The platform's own Razorpay account, used to bill merchants for their subscription (separate
 * from the keys each merchant connects to take their own payments).
 *
 * Intro pricing (e.g. ₹99 for 3 months, then ₹799): Razorpay offers can only be created in its
 * Dashboard. When the plan has an offer id, one mandate covers everything (regular plan + offer).
 * Without one, the intro months run on their own short subscription and the merchant authorises
 * the regular one when they end (UPI mandates cannot be moved to a dearer plan through the API).
 */
export class RazorpayBilling {
  private readonly client: RazorpayClient;

  constructor(
    readonly keyId: string,
    private readonly keySecret: string,
    private readonly webhookSecret: string,
    fetchImpl?: FetchLike,
    baseUrl?: string,
  ) {
    this.client = new RazorpayClient(keyId, keySecret, fetchImpl, baseUrl);
  }

  /** Creates a monthly Razorpay plan (plans are immutable, so a price change makes a new one). */
  async createPlan(input: {
    name: string;
    amount: number;
    currency: string;
    planId: string;
    kind: 'regular' | 'intro';
  }): Promise<string> {
    const plan = await this.client.request<{ id: string }>('POST', '/v1/plans', {
      period: 'monthly',
      interval: 1,
      item: { name: input.name, amount: input.amount, currency: input.currency },
      notes: { planId: input.planId, kind: input.kind },
    });
    return plan.id;
  }

  createSubscription(input: {
    razorpayPlanId: string;
    totalCount: number;
    startAt: Date | null;
    offerId: string | null;
    notes: SubscriptionNotes;
  }): Promise<RazorpaySubscription> {
    return this.client.request<RazorpaySubscription>('POST', '/v1/subscriptions', {
      plan_id: input.razorpayPlanId,
      total_count: input.totalCount,
      quantity: 1,
      // Razorpay emails the merchant about upcoming and failed charges as well.
      customer_notify: true,
      ...(input.startAt ? { start_at: Math.floor(input.startAt.getTime() / 1000) } : {}),
      ...(input.offerId ? { offer_id: input.offerId } : {}),
      notes: input.notes,
    });
  }

  fetchSubscription(id: string): Promise<RazorpaySubscription> {
    return this.client.request<RazorpaySubscription>(
      'GET',
      `/v1/subscriptions/${encodeURIComponent(id)}`,
    );
  }

  cancelSubscription(id: string, atCycleEnd: boolean): Promise<RazorpaySubscription> {
    return this.client.request<RazorpaySubscription>(
      'POST',
      `/v1/subscriptions/${encodeURIComponent(id)}/cancel`,
      { cancel_at_cycle_end: atCycleEnd ? 1 : 0 },
    );
  }

  async listInvoices(subscriptionId: string): Promise<RazorpayInvoice[]> {
    const page = await this.client.request<{ items: RazorpayInvoice[] }>(
      'GET',
      `/v1/invoices?subscription_id=${encodeURIComponent(subscriptionId)}&count=100`,
    );
    return page.items;
  }

  /**
   * Checkout's success callback for a subscription: HMAC-SHA256 of
   * `payment_id|subscription_id` with the key secret. The subscription id must be the one our
   * server created, never the one the browser sends back.
   */
  verifyCheckout(paymentId: string, subscriptionId: string, signature: string): boolean {
    const expected = Buffer.from(
      createHmac('sha256', this.keySecret).update(`${paymentId}|${subscriptionId}`).digest('hex'),
      'hex',
    );
    const given = Buffer.from(signature, 'hex');
    return expected.length === given.length && timingSafeEqual(expected, given);
  }

  verifyWebhook(rawBody: Buffer, signature: string | undefined): boolean {
    return verifyRazorpaySignature(rawBody, signature, this.webhookSecret);
  }
}

export const RAZORPAY_BILLING = Symbol('RAZORPAY_BILLING');
