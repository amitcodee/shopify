import Stripe from 'stripe';
import { describe, expect, it } from 'vitest';
import { applicationFee } from './connect-provider.js';
import { deriveStatus } from './payment-accounts.service.js';
import { InvalidWebhookError } from './payment-provider.js';
import { StripeConnectProvider } from './stripe-connect.provider.js';

const WEBHOOK_SECRET = 'whsec_connect_secret_for_unit_tests';
const stripe = new Stripe('sk_test_dummy');
const provider = new StripeConnectProvider(stripe, WEBHOOK_SECRET);

function signedEvent(event: object, secret = WEBHOOK_SECRET) {
  const payload = JSON.stringify(event);
  const header = stripe.webhooks.generateTestHeaderString({ payload, secret });
  return { body: Buffer.from(payload), headers: { 'stripe-signature': header } };
}

describe('StripeConnectProvider.parseWebhook (offline)', () => {
  it('normalizes account.updated, merging past-due and currently-due requirements', () => {
    const { body, headers } = signedEvent({
      id: 'evt_a1',
      object: 'event',
      type: 'account.updated',
      account: 'acct_123',
      data: {
        object: {
          id: 'acct_123',
          object: 'account',
          charges_enabled: false,
          payouts_enabled: false,
          details_submitted: true,
          country: 'US',
          requirements: {
            past_due: ['external_account'],
            currently_due: ['external_account', 'individual.id_number'],
            disabled_reason: 'requirements.past_due',
          },
        },
      },
    });
    const outcome = provider.parseWebhook(body, headers);
    expect(outcome).toEqual({
      kind: 'account_updated',
      eventId: 'evt_a1',
      type: 'account.updated',
      account: {
        accountId: 'acct_123',
        chargesEnabled: false,
        payoutsEnabled: false,
        detailsSubmitted: true,
        requirementsDue: ['external_account', 'individual.id_number'],
        disabledReason: 'requirements.past_due',
        country: 'US',
      },
    });
    if (outcome.kind === 'account_updated')
      expect(deriveStatus(outcome.account)).toBe('RESTRICTED');
  });

  it('maps deauthorization to the connected account on the event', () => {
    const { body, headers } = signedEvent({
      id: 'evt_a2',
      object: 'event',
      type: 'account.application.deauthorized',
      account: 'acct_456',
      data: { object: { id: 'ca_1', object: 'application' } },
    });
    expect(provider.parseWebhook(body, headers)).toEqual({
      kind: 'account_deauthorized',
      eventId: 'evt_a2',
      type: 'account.application.deauthorized',
      accountId: 'acct_456',
    });
  });

  it('rejects events signed for the payments endpoint', () => {
    const { body, headers } = signedEvent(
      { id: 'evt_a3', object: 'event', type: 'account.updated', data: { object: {} } },
      'whsec_payments_endpoint_secret',
    );
    expect(() => provider.parseWebhook(body, headers)).toThrow(InvalidWebhookError);
  });
});

describe('applicationFee', () => {
  it('rounds half up in basis points and never exceeds the amount', () => {
    expect(applicationFee(10_000, 200)).toBe(200);
    expect(applicationFee(125, 200)).toBe(3); // 2.5 → 3
    expect(applicationFee(124, 200)).toBe(2); // 2.48 → 2
    expect(applicationFee(0, 200)).toBe(0);
    expect(applicationFee(5000, 0)).toBe(0);
    expect(applicationFee(10, 10_000)).toBe(10);
  });
});

describe('deriveStatus', () => {
  const base = {
    accountId: 'acct_1',
    payoutsEnabled: false,
    requirementsDue: [],
    disabledReason: null,
    country: 'US',
  };
  it('is ACTIVE with charges enabled, RESTRICTED when something is due, else ONBOARDING', () => {
    expect(deriveStatus({ ...base, chargesEnabled: true, detailsSubmitted: true })).toBe('ACTIVE');
    expect(
      deriveStatus({
        ...base,
        chargesEnabled: false,
        detailsSubmitted: true,
        requirementsDue: ['external_account'],
      }),
    ).toBe('RESTRICTED');
    // Submitted with nothing outstanding: the provider is reviewing it.
    expect(deriveStatus({ ...base, chargesEnabled: false, detailsSubmitted: true })).toBe(
      'ONBOARDING',
    );
    expect(deriveStatus({ ...base, chargesEnabled: false, detailsSubmitted: false })).toBe(
      'ONBOARDING',
    );
  });
});
