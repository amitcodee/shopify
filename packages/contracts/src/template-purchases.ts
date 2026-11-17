import { z } from 'zod';
import { PREMIUM_STYLES, type PremiumStyleId } from './themes.js';

const premiumStyleIds = PREMIUM_STYLES.map((s) => s.id) as [PremiumStyleId, ...PremiumStyleId[]];
export const premiumStyleIdSchema = z.enum(premiumStyleIds);

/** A premium style as the admin shows it, with whether this store owns it. */
export const premiumTemplateSchema = z.object({
  styleId: premiumStyleIdSchema,
  label: z.string(),
  description: z.string(),
  /** One-time price in minor units (paise). */
  price: z.number().int(),
  currency: z.literal('INR'),
  owned: z.boolean(),
  purchasedAt: z.iso.datetime().nullable(),
});
export type PremiumTemplate = z.infer<typeof premiumTemplateSchema>;

export const templatePurchaseRecordSchema = z.object({
  id: z.uuid(),
  styleId: z.string(),
  styleLabel: z.string(),
  amount: z.number().int(),
  currency: z.string(),
  status: z.enum(['PENDING', 'PAID', 'FAILED']),
  createdAt: z.iso.datetime(),
  paidAt: z.iso.datetime().nullable(),
});
export type TemplatePurchaseRecord = z.infer<typeof templatePurchaseRecordSchema>;

export const purchaseTemplateInputSchema = z.strictObject({ styleId: premiumStyleIdSchema });

/** Razorpay Checkout options for a one-time order. */
export const templateCheckoutSchema = z.object({
  keyId: z.string(),
  orderId: z.string(),
  amount: z.number().int(),
  currency: z.string(),
  name: z.string(),
  description: z.string(),
  email: z.string(),
});
export type TemplateCheckout = z.infer<typeof templateCheckoutSchema>;

/** Either the style is now owned (already bought, or the development provider), or pay first. */
export type PurchaseTemplateResult =
  { status: 'owned' } | { status: 'checkout'; checkout: TemplateCheckout };

/** Checkout's success callback for an order. */
export const confirmTemplatePurchaseInputSchema = z.strictObject({
  orderId: z.string().min(1).max(100),
  paymentId: z.string().min(1).max(100),
  signature: z.string().regex(/^[0-9a-f]{64}$/),
});

/** Error code when a store applies a premium template it has not bought. */
export const TEMPLATE_NOT_OWNED = 'template_not_owned';
