import { z } from 'zod';
import { paginated } from './common.js';

export const orderStatusSchema = z.enum(['PENDING_PAYMENT', 'OPEN', 'CANCELLED']);
export const financialStatusSchema = z.enum([
  'PENDING',
  'PAID',
  'PARTIALLY_REFUNDED',
  'REFUNDED',
  'VOIDED',
]);
export const fulfillmentStatusSchema = z.enum(['UNFULFILLED', 'FULFILLED']);
export type OrderStatus = z.infer<typeof orderStatusSchema>;
export type FinancialStatus = z.infer<typeof financialStatusSchema>;
export type FulfillmentStatus = z.infer<typeof fulfillmentStatusSchema>;

const addressShape = z.object({
  name: z.string(),
  line1: z.string(),
  line2: z.string().optional(),
  city: z.string(),
  region: z.string().optional(),
  postalCode: z.string(),
  country: z.string(),
  phone: z.string().optional(),
});

export const orderListItemSchema = z.object({
  id: z.uuid(),
  number: z.number().int(),
  email: z.string(),
  customerName: z.string().nullable(),
  status: orderStatusSchema,
  financialStatus: financialStatusSchema,
  fulfillmentStatus: fulfillmentStatusSchema,
  currency: z.string(),
  total: z.number().int(),
  itemCount: z.number().int(),
  createdAt: z.iso.datetime(),
});
export type OrderListItem = z.infer<typeof orderListItemSchema>;
export const orderListSchema = paginated(orderListItemSchema);

export const orderListQuerySchema = z.strictObject({
  q: z.string().trim().max(100).optional(),
  status: orderStatusSchema.optional(),
  financialStatus: financialStatusSchema.optional(),
  fulfillmentStatus: fulfillmentStatusSchema.optional(),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});
export type OrderListQuery = z.infer<typeof orderListQuerySchema>;

export const orderLineSchema = z.object({
  id: z.uuid(),
  productId: z.uuid().nullable(),
  variantId: z.uuid().nullable(),
  title: z.string(),
  variantTitle: z.string(),
  sku: z.string().nullable(),
  unitPrice: z.number().int(),
  quantity: z.number().int(),
  discountTotal: z.number().int(),
  total: z.number().int(),
  restockedQuantity: z.number().int(),
  /** How many units can still be returned to stock. */
  restockable: z.number().int(),
});

export const disputeStatusSchema = z.enum(['NEEDS_RESPONSE', 'UNDER_REVIEW', 'WON', 'LOST']);
export type DisputeStatus = z.infer<typeof disputeStatusSchema>;

/** A chargeback raised by the shopper's bank, mirrored from the payment provider. */
export const disputeSchema = z.object({
  id: z.uuid(),
  orderId: z.uuid(),
  orderNumber: z.number().int(),
  amount: z.number().int(),
  currency: z.string(),
  reason: z.string().nullable(),
  status: disputeStatusSchema,
  evidenceDueBy: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
});
export type Dispute = z.infer<typeof disputeSchema>;

export const orderDetailSchema = orderListItemSchema.extend({
  subtotal: z.number().int(),
  discountTotal: z.number().int(),
  shippingTotal: z.number().int(),
  taxTotal: z.number().int(),
  /** Part of the total paid with a gift card. */
  giftCardAmount: z.number().int(),
  discountCode: z.string().nullable(),
  shippingMethod: z.string().nullable(),
  shippingAddress: addressShape,
  note: z.string().nullable(),
  paidAt: z.iso.datetime().nullable(),
  cancelledAt: z.iso.datetime().nullable(),
  cancelReason: z.string().nullable(),
  customer: z.object({ id: z.uuid(), email: z.string(), name: z.string().nullable() }).nullable(),
  lines: z.array(orderLineSchema),
  payments: z.array(
    z.object({
      id: z.uuid(),
      provider: z.string(),
      amount: z.number().int(),
      status: z.string(),
      createdAt: z.iso.datetime(),
    }),
  ),
  refunds: z.array(
    z.object({
      id: z.uuid(),
      amount: z.number().int(),
      reason: z.string().nullable(),
      status: z.string(),
      createdAt: z.iso.datetime(),
    }),
  ),
  disputes: z.array(disputeSchema),
  fulfillments: z.array(
    z.object({
      id: z.uuid(),
      trackingCompany: z.string().nullable(),
      trackingNumber: z.string().nullable(),
      trackingUrl: z.string().nullable(),
      createdAt: z.iso.datetime(),
    }),
  ),
  events: z.array(
    z.object({
      id: z.uuid(),
      type: z.string(),
      message: z.string(),
      createdAt: z.iso.datetime(),
    }),
  ),
  /** Amount that can still be refunded (paid minus refunded). */
  refundableAmount: z.number().int(),
});
export type OrderDetail = z.infer<typeof orderDetailSchema>;

export const refundInputSchema = z.strictObject({
  amount: z.number().int().min(1),
  reason: z.string().trim().max(200).optional(),
  restock: z
    .array(z.strictObject({ lineId: z.uuid(), quantity: z.number().int().min(1) }))
    .max(100)
    .default([]),
});
export type RefundInput = z.input<typeof refundInputSchema>;

export const fulfillInputSchema = z.strictObject({
  trackingCompany: z.string().trim().max(100).optional(),
  trackingNumber: z.string().trim().max(100).optional(),
  trackingUrl: z
    .url({ protocol: /^https?$/ })
    .max(500)
    .optional(),
  notifyCustomer: z.boolean().default(true),
});
export type FulfillInput = z.input<typeof fulfillInputSchema>;

export const cancelOrderInputSchema = z.strictObject({
  reason: z.enum(['CUSTOMER', 'FRAUD', 'INVENTORY', 'DECLINED', 'OTHER']).default('OTHER'),
  restock: z.boolean().default(true),
  refund: z.boolean().default(true),
});
export type CancelOrderInput = z.input<typeof cancelOrderInputSchema>;

/** What the order-status page and customer accounts may see. */
export const publicOrderSchema = z.object({
  number: z.number().int(),
  storeName: z.string(),
  status: orderStatusSchema,
  financialStatus: financialStatusSchema,
  fulfillmentStatus: fulfillmentStatusSchema,
  currency: z.string(),
  subtotal: z.number().int(),
  discountTotal: z.number().int(),
  shippingTotal: z.number().int(),
  taxTotal: z.number().int(),
  total: z.number().int(),
  giftCardAmount: z.number().int(),
  shippingMethod: z.string().nullable(),
  shippingAddress: addressShape,
  lines: z.array(
    z.object({
      title: z.string(),
      variantTitle: z.string(),
      quantity: z.number().int(),
      unitPrice: z.number().int(),
      total: z.number().int(),
    }),
  ),
  fulfillments: z.array(
    z.object({
      trackingCompany: z.string().nullable(),
      trackingNumber: z.string().nullable(),
      trackingUrl: z.string().nullable(),
      createdAt: z.iso.datetime(),
    }),
  ),
  createdAt: z.iso.datetime(),
});
export type PublicOrder = z.infer<typeof publicOrderSchema>;

/** An unpaid checkout that expired (the shopper never paid). */
export const abandonedCheckoutSchema = z.object({
  id: z.uuid(),
  email: z.string(),
  currency: z.string(),
  total: z.number().int(),
  itemCount: z.number().int(),
  createdAt: z.iso.datetime(),
  recoveryStatus: z.enum(['PENDING', 'SENT', 'SKIPPED']),
  recoveryEmailSentAt: z.iso.datetime().nullable(),
  /** A later paid order from the same email, if any. */
  recoveredOrder: z.object({ id: z.uuid(), number: z.number().int() }).nullable(),
});
export type AbandonedCheckout = z.infer<typeof abandonedCheckoutSchema>;
export const abandonedCheckoutListSchema = paginated(abandonedCheckoutSchema);

export const recoverCartInputSchema = z.strictObject({ token: z.string().min(10).max(200) });
