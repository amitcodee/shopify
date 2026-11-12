import { z } from 'zod';

/**
 * Payment gateways a merchant connects with their own account and API keys. Money settles directly
 * in that account. (The other route, payouts through the platform, is in payments.ts.)
 */
export const STORE_GATEWAY_IDS = [
  'razorpay',
  'phonepe',
  'payu',
  'stripe',
  'cashfree',
  'paypal',
] as const;
export const storeGatewayIdSchema = z.enum(STORE_GATEWAY_IDS);
export type StoreGatewayId = z.infer<typeof storeGatewayIdSchema>;

export const gatewayModeSchema = z.enum(['test', 'live']);
export type GatewayMode = z.infer<typeof gatewayModeSchema>;

export interface StoreGatewayField {
  key: string;
  label: string;
  /** Secrets are write-only: stored encrypted and never sent back to the browser. */
  secret: boolean;
  /** Can be left blank (everything else is required). */
  optional?: boolean;
  placeholder?: string;
  hint?: string;
}

export interface StoreGatewayInfo {
  id: StoreGatewayId;
  label: string;
  description: string;
  /** What shoppers can pay with on this gateway's page. */
  methods: readonly string[];
  /** Store currencies it can charge; null = any the merchant's account supports. */
  currencies: readonly string[] | null;
  fields: readonly StoreGatewayField[];
  /** The field that identifies the account, shown masked after saving. */
  hintField: string;
  /** Test or live comes from the key's prefix; otherwise the merchant chooses it. */
  modeFromKey: { field: string; test: string; live: readonly string[] } | null;
  /** Needs the shopper's phone number to start a payment. */
  requiresPhone: boolean;
  /** Where the merchant finds these keys. */
  keysUrl: string;
  /** Steps for the webhook at the gateway's dashboard; null when none is needed. */
  webhookSteps: string | null;
}

export const STORE_GATEWAYS: readonly StoreGatewayInfo[] = [
  {
    id: 'razorpay',
    label: 'Razorpay',
    description: 'India: all major cards, UPI, netbanking and wallets on a hosted payment page.',
    methods: ['Visa', 'Mastercard', 'RuPay', 'Amex', 'UPI', 'Netbanking', 'Wallets'],
    currencies: null,
    fields: [
      { key: 'keyId', label: 'Key ID', secret: false, placeholder: 'rzp_test_…' },
      { key: 'keySecret', label: 'Key secret', secret: true },
      {
        key: 'webhookSecret',
        label: 'Webhook secret',
        secret: true,
        hint: 'The secret you type when you create the webhook in Razorpay.',
      },
    ],
    hintField: 'keyId',
    modeFromKey: { field: 'keyId', test: 'rzp_test_', live: ['rzp_live_'] },
    requiresPhone: false,
    keysUrl: 'https://dashboard.razorpay.com/app/keys',
    webhookSteps:
      'In Razorpay, open Account & Settings → Webhooks and add the URL below. Choose your own secret and turn on payment_link.paid, payment_link.expired, payment_link.cancelled and the payment.dispute events.',
  },
  {
    id: 'phonepe',
    label: 'PhonePe',
    description: 'India: UPI, cards and netbanking on the PhonePe payment page.',
    methods: ['UPI', 'Visa', 'Mastercard', 'RuPay', 'Netbanking'],
    currencies: ['INR'],
    fields: [
      { key: 'clientId', label: 'Client ID', secret: false },
      { key: 'clientVersion', label: 'Client version', secret: false, placeholder: '1' },
      { key: 'clientSecret', label: 'Client secret', secret: true },
      {
        key: 'webhookUsername',
        label: 'Webhook username',
        secret: false,
        optional: true,
        hint: 'What you choose when creating the webhook in PhonePe.',
      },
      { key: 'webhookPassword', label: 'Webhook password', secret: true, optional: true },
    ],
    hintField: 'clientId',
    modeFromKey: null,
    requiresPhone: false,
    keysUrl: 'https://business.phonepe.com/developer-settings',
    webhookSteps:
      'Optional but recommended: in the PhonePe dashboard, add the URL below as a webhook for checkout.order.completed and checkout.order.failed. It confirms payments even if the shopper closes the page early.',
  },
  {
    id: 'payu',
    label: 'PayU',
    description: 'India (PayU India): cards, UPI, netbanking, wallets and EMI on a hosted page.',
    methods: ['Visa', 'Mastercard', 'RuPay', 'Amex', 'UPI', 'Netbanking', 'EMI'],
    currencies: ['INR'],
    fields: [
      { key: 'merchantKey', label: 'Merchant key', secret: false },
      { key: 'merchantSalt', label: 'Merchant salt', secret: true, hint: 'Salt version 1.' },
    ],
    hintField: 'merchantKey',
    modeFromKey: null,
    requiresPhone: true,
    keysUrl: 'https://onboarding.payu.in/app/account/integration-details',
    webhookSteps:
      'Optional but recommended: in PayU, open Developers → Webhooks and add the URL below for successful and failed payments. It confirms payments even if the shopper closes the page early.',
  },
  {
    id: 'stripe',
    label: 'Stripe',
    description: 'Worldwide: cards and wallets on Stripe Checkout, paid into your Stripe account.',
    methods: ['Visa', 'Mastercard', 'Amex', 'Discover', 'Apple Pay', 'Google Pay'],
    currencies: null,
    fields: [
      { key: 'secretKey', label: 'Secret key', secret: true, placeholder: 'sk_test_…' },
      {
        key: 'webhookSecret',
        label: 'Webhook signing secret',
        secret: true,
        placeholder: 'whsec_…',
      },
    ],
    hintField: 'secretKey',
    modeFromKey: { field: 'secretKey', test: 'sk_test_', live: ['sk_live_'] },
    requiresPhone: false,
    keysUrl: 'https://dashboard.stripe.com/apikeys',
    webhookSteps:
      'In Stripe, open Developers → Webhooks and add the URL below. Send checkout.session.completed, checkout.session.async_payment_succeeded, checkout.session.async_payment_failed, checkout.session.expired and the charge.dispute events, then copy its signing secret here.',
  },
  {
    id: 'cashfree',
    label: 'Cashfree',
    description: 'India: cards, UPI, netbanking and wallets through Cashfree payment links.',
    methods: ['Visa', 'Mastercard', 'RuPay', 'UPI', 'Netbanking', 'Wallets'],
    currencies: ['INR'],
    fields: [
      { key: 'appId', label: 'App ID', secret: false },
      { key: 'secretKey', label: 'Secret key', secret: true },
    ],
    hintField: 'appId',
    modeFromKey: null,
    requiresPhone: true,
    keysUrl: 'https://merchant.cashfree.com/merchants/pg/developers/api-keys',
    webhookSteps:
      'In Cashfree, open Developers → Webhooks and add the URL below for payment link events. Orders are marked paid from this webhook, so it is required.',
  },
  {
    id: 'paypal',
    label: 'PayPal',
    description: 'International: PayPal balance and cards, for stores selling abroad.',
    methods: ['PayPal', 'Visa', 'Mastercard', 'Amex'],
    currencies: [
      'USD',
      'EUR',
      'GBP',
      'CAD',
      'AUD',
      'NZD',
      'SGD',
      'HKD',
      'JPY',
      'CHF',
      'SEK',
      'NOK',
      'DKK',
      'PLN',
      'MXN',
    ],
    fields: [
      { key: 'clientId', label: 'Client ID', secret: false },
      { key: 'clientSecret', label: 'Client secret', secret: true },
    ],
    hintField: 'clientId',
    modeFromKey: null,
    requiresPhone: false,
    keysUrl: 'https://developer.paypal.com/dashboard/applications',
    webhookSteps: null,
  },
];

export function findStoreGateway(id: string): StoreGatewayInfo | undefined {
  return STORE_GATEWAYS.find((g) => g.id === id);
}

export const saveStoreGatewayInputSchema = z.strictObject({
  /** Ignored when the key's prefix decides the mode. */
  mode: gatewayModeSchema.optional(),
  /** A blank secret keeps the saved one, so keys can be rotated one at a time. */
  credentials: z.record(z.string().max(64), z.string().trim().max(500)),
});
export type SaveStoreGatewayInput = z.infer<typeof saveStoreGatewayInputSchema>;

export interface ConnectedStoreGateway {
  id: StoreGatewayId;
  mode: GatewayMode;
  /** Shoppers pay with this one. A store has at most one active gateway. */
  active: boolean;
  /** Masked account identifier; secrets never leave the server. */
  keyHint: string;
  verifiedAt: string;
  updatedAt: string;
}

export interface StoreGatewaysOverview {
  connected: ConnectedStoreGateway[];
  /** Webhook address per gateway to paste into its dashboard. */
  webhookUrls: Record<StoreGatewayId, string>;
  cod: { enabled: boolean; maxAmount: number | null; requireConfirmation: boolean };
}

/** Result of saving keys: the first gateway a store connects starts taking payments right away. */
export interface SavedStoreGateway {
  active: boolean;
}

export const codSettingsInputSchema = z.strictObject({
  enabled: z.boolean(),
  maxAmount: z.number().int().positive().nullable(),
  /** Shoppers confirm cash orders from their email before stock is held for long. */
  requireConfirmation: z.boolean().default(true),
});
export type CodSettingsInput = z.infer<typeof codSettingsInputSchema>;
