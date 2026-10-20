import type { IncomingHttpHeaders } from 'node:http';

/** A connected account as the provider reports it. */
export interface ConnectedAccountState {
  accountId: string;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
  requirementsDue: string[];
  disabledReason: string | null;
  country: string | null;
}

export interface CreateAccountInput {
  storeId: string;
  storeName: string;
  email: string;
  country: string;
  /** Same key → same account on retries; a reconnect after disconnection uses a new key. */
  idempotencyKey: string;
}

export interface ProviderPayout {
  id: string;
  amount: number;
  currency: string;
  status: string;
  arrivalDate: Date;
}

export type ConnectWebhookOutcome =
  | { kind: 'account_updated'; eventId: string; type: string; account: ConnectedAccountState }
  | { kind: 'account_deauthorized'; eventId: string; type: string; accountId: string }
  | { kind: 'ignored'; eventId: string; type: string };

/**
 * Port for merchant payout accounts (Stripe Connect). Merchants complete identity and bank
 * details on the provider's hosted onboarding; we store only the account id and its status.
 */
export interface ConnectProvider {
  readonly name: string;
  createAccount(input: CreateAccountInput): Promise<{ accountId: string }>;
  /** Single-use link to the hosted onboarding (or to continue it). */
  createOnboardingLink(
    accountId: string,
    urls: { storeId: string; returnUrl: string; refreshUrl: string },
  ): Promise<string>;
  /** Current state; null when the provider cannot be queried and state arrives by webhook only. */
  retrieveAccount(accountId: string): Promise<ConnectedAccountState | null>;
  /** Link to the provider's dashboard for the merchant (payouts, bank account, tax forms). */
  createDashboardLink(accountId: string, storeId: string): Promise<string>;
  /** Latest payouts; null when the provider does not report payouts. */
  listPayouts(accountId: string, limit: number): Promise<ProviderPayout[] | null>;
  /** Verifies the signature and normalizes the event; throws InvalidWebhookError if invalid. */
  parseWebhook(rawBody: Buffer, headers: IncomingHttpHeaders): ConnectWebhookOutcome;
}

export const CONNECT_PROVIDERS = Symbol('CONNECT_PROVIDERS');
export const ACTIVE_CONNECT_PROVIDER = Symbol('ACTIVE_CONNECT_PROVIDER');

/** Platform fee for an amount in minor units, rounded half up (never more than the amount). */
export function applicationFee(amount: number, feeBps: number): number {
  if (amount <= 0 || feeBps <= 0) return 0;
  return Math.min(amount, Math.floor((amount * feeBps + 5_000) / 10_000));
}
