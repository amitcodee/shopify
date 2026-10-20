import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import type { IncomingHttpHeaders } from 'node:http';
import type {
  ConnectedAccountState,
  ConnectProvider,
  ConnectWebhookOutcome,
  CreateAccountInput,
  CreatedAccount,
  ProviderPayout,
} from './connect-provider.js';
import { PAYOUT_COUNTRIES } from '@repo/contracts';
import { MOCK_SIGNATURE_HEADER } from './mock-payment.provider.js';
import { InvalidWebhookError } from './payment-provider.js';

type MockConnectEvent =
  | { id: string; type: 'account.updated'; account: ConnectedAccountState }
  | { id: string; type: 'account.application.deauthorized'; accountId: string };

/**
 * Sandbox Connect for development and tests. Onboarding happens on a sandbox page in the
 * merchant admin, and its outcome arrives as a *signed webhook* through the same verification,
 * de-duplication and status code as Stripe's `account.updated`.
 */
export class MockConnectProvider implements ConnectProvider {
  readonly name = 'mock';
  readonly label = 'Sandbox';
  readonly onboarding = 'hosted' as const;
  readonly countries = PAYOUT_COUNTRIES;
  readonly currencies = null;
  readonly hasDashboard = true;

  constructor(
    private readonly secret: string,
    private readonly adminUrl: string,
  ) {}

  createAccount(_input: CreateAccountInput): Promise<CreatedAccount> {
    return Promise.resolve({ accountId: `acct_mock_${randomUUID().replaceAll('-', '')}` });
  }

  createOnboardingLink(accountId: string, urls: { storeId: string }): Promise<string> {
    return Promise.resolve(
      `${this.adminUrl}/s/${urls.storeId}/settings/payments/sandbox?account=${accountId}`,
    );
  }

  /** The sandbox keeps no state of its own: account status arrives only by webhook. */
  retrieveAccount(_accountId: string): Promise<ConnectedAccountState | null> {
    return Promise.resolve(null);
  }

  createDashboardLink(_accountId: string, storeId: string): Promise<string> {
    return Promise.resolve(`${this.adminUrl}/s/${storeId}/settings/payments?sandbox-dashboard=1`);
  }

  listPayouts(_accountId: string, _limit: number): Promise<ProviderPayout[] | null> {
    return Promise.resolve(null);
  }

  /** Builds the webhook the sandbox "provider" sends when onboarding finishes. */
  buildAccountWebhook(
    accountId: string,
    outcome: 'complete' | 'restricted' | 'deauthorized',
    country: string | null,
  ) {
    const id = `evt_${randomUUID()}`;
    const event: MockConnectEvent =
      outcome === 'deauthorized'
        ? { id, type: 'account.application.deauthorized', accountId }
        : {
            id,
            type: 'account.updated',
            account: {
              accountId,
              chargesEnabled: outcome === 'complete',
              payoutsEnabled: outcome === 'complete',
              detailsSubmitted: true,
              requirementsDue: outcome === 'complete' ? [] : ['external_account'],
              disabledReason: outcome === 'complete' ? null : 'requirements.past_due',
              country,
            },
          };
    const body = Buffer.from(JSON.stringify(event));
    return { body, signature: this.sign(body) };
  }

  parseWebhook(rawBody: Buffer, headers: IncomingHttpHeaders): ConnectWebhookOutcome {
    const given = headers[MOCK_SIGNATURE_HEADER];
    const signature = Array.isArray(given) ? given[0] : given;
    const expected = Buffer.from(this.sign(rawBody), 'hex');
    const actual = Buffer.from(signature ?? '', 'hex');
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
      throw new InvalidWebhookError('Invalid mock webhook signature');
    }
    const event = JSON.parse(rawBody.toString('utf8')) as MockConnectEvent;
    if (event.type === 'account.updated') {
      return {
        kind: 'account_updated',
        eventId: event.id,
        type: event.type,
        account: event.account,
      };
    }
    if (event.type === 'account.application.deauthorized') {
      return {
        kind: 'account_deauthorized',
        eventId: event.id,
        type: event.type,
        accountId: event.accountId,
      };
    }
    const unknown = event as { id?: unknown; type?: unknown };
    return { kind: 'ignored', eventId: String(unknown.id), type: String(unknown.type) };
  }

  /** Domain-separated from payment webhooks so one can never be replayed as the other. */
  private sign(body: Buffer): string {
    return createHmac('sha256', `connect:${this.secret}`).update(body).digest('hex');
  }
}
