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

export const gatewaySchema = z.enum(['mock', 'stripe', 'razorpay']);
export type GatewayName = z.infer<typeof gatewaySchema>;

/** A payment gateway the platform offers merchants (from the API's PAYMENT_PROVIDERS). */
export const gatewayInfoSchema = z.object({
  provider: gatewaySchema,
  label: z.string(),
  /** "hosted": onboarding on the provider's pages; "form": details entered in the admin. */
  onboarding: z.enum(['hosted', 'form']),
  countries: z.array(z.string()),
  /** Store currencies the gateway can settle; null = any. */
  currencies: z.array(z.string()).nullable(),
  sandbox: z.boolean(),
});
export type GatewayInfo = z.infer<typeof gatewayInfoSchema>;

export const RAZORPAY_BUSINESS_TYPES = [
  'individual',
  'proprietorship',
  'partnership',
  'private_limited',
  'public_limited',
  'llp',
  'ngo',
  'trust',
  'society',
] as const;

/**
 * Razorpay Route linked-account onboarding. Razorpay has no hosted onboarding for linked
 * accounts, so these go from the admin straight to Razorpay; we never store the bank details.
 */
export const razorpayBusinessDetailsSchema = z.strictObject({
  legalBusinessName: z.string().trim().min(4).max(200),
  businessType: z.enum(RAZORPAY_BUSINESS_TYPES),
  contactName: z.string().trim().min(4).max(100),
  phone: z
    .string()
    .trim()
    .regex(/^[6-9]\d{9}$/, 'Enter a 10-digit Indian mobile number'),
  pan: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{5}\d{4}[A-Z]$/, 'Enter a valid PAN'),
  street1: z.string().trim().min(3).max(100),
  street2: z.string().trim().max(100).optional(),
  city: z.string().trim().min(2).max(100),
  state: z.string().trim().min(2).max(100),
  postalCode: z
    .string()
    .trim()
    .regex(/^\d{6}$/, 'Enter a 6-digit PIN code'),
  accountNumber: z
    .string()
    .trim()
    .regex(/^\d{9,18}$/, 'Enter the bank account number (9–18 digits)'),
  ifsc: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, 'Enter a valid IFSC code'),
  beneficiaryName: z.string().trim().min(4).max(120),
});
export type RazorpayBusinessDetails = z.infer<typeof razorpayBusinessDetailsSchema>;

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
  provider: gatewaySchema,
  label: z.string(),
  accountId: z.string(),
  status: paymentAccountStatusSchema,
  chargesEnabled: z.boolean(),
  payoutsEnabled: z.boolean(),
  detailsSubmitted: z.boolean(),
  /** Provider requirement codes still outstanding (e.g. "external_account"). */
  requirementsDue: z.array(z.string()),
  disabledReason: z.string().nullable(),
  country: z.string().nullable(),
  /** Whether the gateway offers merchants a dashboard link (payouts, bank account, tax forms). */
  hasDashboard: z.boolean(),
  /** False when the platform no longer offers this gateway (checkout is then off). */
  gatewayEnabled: z.boolean(),
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
  /** Gateways this store can connect (currency-compatible ones first). */
  gateways: z.array(gatewayInfoSchema),
  /** True when the connected gateway (or, before connecting, every offered one) is the sandbox. */
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

export const connectAccountInputSchema = z.discriminatedUnion('provider', [
  z.strictObject({ provider: z.enum(['mock', 'stripe']), country: z.enum(PAYOUT_COUNTRIES) }),
  z.strictObject({ provider: z.literal('razorpay'), business: razorpayBusinessDetailsSchema }),
]);
export type ConnectAccountInput = z.infer<typeof connectAccountInputSchema>;

/** Where to continue onboarding; null when it is already complete (form onboarding). */
export const providerLinkSchema = z.object({ url: z.string().nullable() });
export type ProviderLink = z.infer<typeof providerLinkSchema>;

export const sandboxOnboardingInputSchema = z.strictObject({
  outcome: z.enum(['complete', 'restricted']),
});

export const sandboxDisputeInputSchema = z.strictObject({
  orderId: z.uuid(),
  status: disputeStatusSchema,
});
