import { z } from 'zod';
import { emailSchema } from './common.js';
import { cartLineSchema } from './storefront.js';

export const addressSchema = z.strictObject({
  name: z.string().trim().min(1, 'Enter a name').max(100),
  line1: z.string().trim().min(1, 'Enter an address').max(200),
  line2: z.string().trim().max(200).optional(),
  city: z.string().trim().min(1, 'Enter a city').max(100),
  region: z.string().trim().max(100).optional(),
  postalCode: z.string().trim().min(1, 'Enter a postal code').max(20),
  country: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2}$/, 'Use a 2-letter country code'),
  phone: z.string().trim().max(30).optional(),
});
export type Address = z.infer<typeof addressSchema>;

export const checkoutPreviewInputSchema = z.strictObject({
  country: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2}$/)
    .optional(),
  region: z.string().trim().max(100).optional(),
  shippingRateId: z.string().max(64).optional(),
  discountCode: z.string().trim().max(50).optional(),
});
export type CheckoutPreviewInput = z.infer<typeof checkoutPreviewInputSchema>;

export const shippingOptionSchema = z.object({
  id: z.string(),
  name: z.string(),
  price: z.number().int(),
});
export type ShippingOption = z.infer<typeof shippingOptionSchema>;

export const checkoutTotalsSchema = z.object({
  currency: z.string(),
  subtotal: z.number().int(),
  discountTotal: z.number().int(),
  shippingTotal: z.number().int(),
  taxTotal: z.number().int(),
  total: z.number().int(),
});
export type CheckoutTotals = z.infer<typeof checkoutTotalsSchema>;

export const checkoutPreviewSchema = checkoutTotalsSchema.extend({
  lines: z.array(cartLineSchema),
  requiresShipping: z.boolean(),
  shippingOptions: z.array(shippingOptionSchema),
  selectedShippingRateId: z.string().nullable(),
  discount: z
    .object({ code: z.string(), applied: z.boolean(), message: z.string().optional() })
    .nullable(),
  warnings: z.array(z.string()),
});
export type CheckoutPreview = z.infer<typeof checkoutPreviewSchema>;

export const checkoutInputSchema = z.strictObject({
  email: emailSchema,
  shippingAddress: addressSchema,
  shippingRateId: z.string().max(64).optional(),
  discountCode: z.string().trim().max(50).optional(),
  note: z.string().trim().max(500).optional(),
  /** Generated once per checkout page; retries with the same key never create a second order. */
  idempotencyKey: z.uuid(),
});
export type CheckoutInput = z.input<typeof checkoutInputSchema>;

export const checkoutResultSchema = z.object({
  orderNumber: z.number().int(),
  /** Where to send the shopper to pay (provider-hosted page or the sandbox page). */
  paymentUrl: z.string(),
});
export type CheckoutResult = z.infer<typeof checkoutResultSchema>;

export const mockPaymentSchema = z.object({
  reference: z.string(),
  storeName: z.string(),
  orderNumber: z.number().int(),
  amount: z.number().int(),
  currency: z.string(),
  status: z.enum(['PENDING', 'SUCCEEDED', 'FAILED', 'CANCELLED']),
  returnUrl: z.string().nullable(),
});
export type MockPayment = z.infer<typeof mockPaymentSchema>;

export const mockPaymentOutcomeSchema = z.strictObject({
  outcome: z.enum(['succeed', 'fail']),
});
