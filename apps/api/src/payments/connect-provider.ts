import type { IncomingHttpHeaders } from 'node:http';
import type { RazorpayBusinessDetails } from '@repo/contracts';

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
  /** Form-onboarding providers (Razorpay Route): the merchant's business and bank details. */
  business?: RazorpayBusinessDetails;
}

export interface CreatedAccount {
  accountId: string;
  /** Provider-specific ids kept with the account (e.g. Razorpay's product configuration id). */
  providerData?: Record<string, string>;
  /** Form-onboarding providers know the state right away. */
  state?: ConnectedAccountState;
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

/** How merchants onboard: the provider's hosted pages, or a form in our admin (pass-through). */
export type OnboardingKind = 'hosted' | 'form';

/**
 * Port for merchant payout accounts (Stripe Connect, Razorpay Route). We store only the account
 * id, its status and provider ids; identity documents and bank details stay with the provider.
 */
export interface ConnectProvider {
  readonly name: string;
  readonly label: string;
  readonly onboarding: OnboardingKind;
  /** Countries a merchant can onboard from. */
  readonly countries: readonly string[];
  /** Store currencies the provider can settle; null = any. */
  readonly currencies: readonly string[] | null;
  /** Whether createDashboardLink can give merchants a dashboard login. */
  readonly hasDashboard: boolean;
  createAccount(input: CreateAccountInput): Promise<CreatedAccount>;
  /** Single-use link to the hosted onboarding (or to continue it); null for form onboarding. */
  createOnboardingLink(
    accountId: string,
    urls: { storeId: string; returnUrl: string; refreshUrl: string },
  ): Promise<string | null>;
  /** Current state; null when the provider cannot be queried and state arrives by webhook only. */
  retrieveAccount(
    accountId: string,
    providerData: Record<string, string>,
  ): Promise<ConnectedAccountState | null>;
  /** Link to the provider's dashboard for the merchant; null when the provider offers none. */
  createDashboardLink(accountId: string, storeId: string): Promise<string | null>;
  /** Latest payouts; null when the provider does not report payouts. */
  listPayouts(accountId: string, limit: number): Promise<ProviderPayout[] | null>;
  /** Verifies the signature and normalizes the event; throws InvalidWebhookError if invalid. */
  parseWebhook(rawBody: Buffer, headers: IncomingHttpHeaders): ConnectWebhookOutcome;
}

export const CONNECT_PROVIDERS = Symbol('CONNECT_PROVIDERS');

/** Platform fee for an amount in minor units, rounded half up (never more than the amount). */
export function applicationFee(amount: number, feeBps: number): number {
  if (amount <= 0 || feeBps <= 0) return 0;
  return Math.min(amount, Math.floor((amount * feeBps + 5_000) / 10_000));
}
