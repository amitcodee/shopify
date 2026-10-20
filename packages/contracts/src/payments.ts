import { z } from 'zod';
import { disputeSchema, disputeStatusSchema } from './orders.js';

/**
 * Countries where merchants can connect a payout account (Stripe Connect Express availability,
 * trimmed to the markets the platform supports).
 */
export const PAYOUT_COUNTRIES = [
  'US',
  'CA',
  'GB',
  'IE',
  'DE',
  'FR',
  'ES',
  'IT',
  'NL',
  'AU',
  'NZ',
  'SG',
  'JP',
] as const;

export const paymentAccountStatusSchema = z.enum([
  /** Created; the merchant has not finished the provider's onboarding. */
  'ONBOARDING',
  /** Can accept payments. */
  'ACTIVE',
  /** Onboarding submitted but the provider needs more information or disabled charges. */
  'RESTRICTED',
  /** The merchant disconnected the account from the platform. */
  'DISCONNECTED',
]);
export type PaymentAccountStatus = z.infer<typeof paymentAccountStatusSchema>;

export const paymentAccountSchema = z.object({
  provider: z.string(),
  accountId: z.string(),
  status: paymentAccountStatusSchema,
  chargesEnabled: z.boolean(),
  payoutsEnabled: z.boolean(),
  detailsSubmitted: z.boolean(),
  /** Provider requirement codes still outstanding (e.g. "external_account"). */
  requirementsDue: z.array(z.string()),
  disabledReason: z.string().nullable(),
  country: z.string().nullable(),
  updatedAt: z.iso.datetime(),
});
export type PaymentAccount = z.infer<typeof paymentAccountSchema>;

export const payoutSchema = z.object({
  id: z.string(),
  amount: z.number().int(),
  currency: z.string(),
  status: z.string(),
  arrivalDate: z.iso.datetime(),
});
export type Payout = z.infer<typeof payoutSchema>;

/** Sales settled through the platform over a period, from the platform's own records. */
export const salesSummarySchema = z.object({
  currency: z.string(),
  days: z.number().int(),
  paidOrders: z.number().int(),
  gross: z.number().int(),
  platformFees: z.number().int(),
  refunds: z.number().int(),
  /** Chargebacks lost in the period (funds returned to the shopper's bank). */
  chargebacks: z.number().int(),
  /** gross − fees − refunds − chargebacks (before the payment provider's own processing fees). */
  net: z.number().int(),
});
export type SalesSummary = z.infer<typeof salesSummarySchema>;

export const paymentsOverviewSchema = z.object({
  /** Active payment provider for checkout ("stripe" or the "mock" sandbox). */
  provider: z.string(),
  sandbox: z.boolean(),
  account: paymentAccountSchema.nullable(),
  /** True when shoppers can check out (account connected and charges enabled). */
  acceptingPayments: z.boolean(),
  /** Platform fee on each sale from the store's plan, in basis points. */
  transactionFeeBps: z.number().int(),
  summary: salesSummarySchema,
  /** Disputes that still need the merchant's response or a decision. */
  openDisputes: z.number().int(),
  disputes: z.array(disputeSchema),
  /** Latest payouts reported by the provider; null when the provider cannot list them. */
  payouts: z.array(payoutSchema).nullable(),
});
export type PaymentsOverview = z.infer<typeof paymentsOverviewSchema>;

export const connectAccountInputSchema = z.strictObject({
  country: z.enum(PAYOUT_COUNTRIES),
});

export const providerLinkSchema = z.object({ url: z.string() });
export type ProviderLink = z.infer<typeof providerLinkSchema>;

export const sandboxOnboardingInputSchema = z.strictObject({
  outcome: z.enum(['complete', 'restricted']),
});

export const sandboxDisputeInputSchema = z.strictObject({
  orderId: z.uuid(),
  status: disputeStatusSchema,
});
