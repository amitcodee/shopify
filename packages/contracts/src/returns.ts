import { z } from 'zod';

export const RETURN_REASONS = [
  'SIZE',
  'DAMAGED',
  'NOT_AS_DESCRIBED',
  'WRONG_ITEM',
  'CHANGED_MIND',
  'OTHER',
] as const;
export const returnReasonSchema = z.enum(RETURN_REASONS);
export type ReturnReason = z.infer<typeof returnReasonSchema>;

export const RETURN_REASON_LABELS: Record<ReturnReason, string> = {
  SIZE: 'Size or fit',
  DAMAGED: 'Damaged or defective',
  NOT_AS_DESCRIBED: 'Not as described',
  WRONG_ITEM: 'Wrong item sent',
  CHANGED_MIND: 'Changed my mind',
  OTHER: 'Other',
};

/** Customers may ask for a return this many days after paying. */
export const RETURN_WINDOW_DAYS = 30;

export const returnRequestInputSchema = z.strictObject({
  lines: z
    .array(
      z.strictObject({
        orderLineId: z.uuid(),
        quantity: z.number().int().min(1).max(999),
        reason: returnReasonSchema,
      }),
    )
    .min(1, 'Choose at least one item to return')
    .max(100),
  note: z.string().trim().max(1000).optional(),
});
export type ReturnRequestInput = z.input<typeof returnRequestInputSchema>;

export const declineReturnInputSchema = z.strictObject({
  reason: z.string().trim().min(1, 'Tell the customer why').max(500),
});

export const closeReturnInputSchema = z.strictObject({
  /** Amount to refund (minor units); defaults to the items' value plus their share of tax. */
  amount: z.number().int().min(0).optional(),
  restock: z.boolean().default(true),
});

export const returnStatusSchema = z.enum(['REQUESTED', 'OPEN', 'DECLINED', 'CLOSED']);
export type ReturnStatus = z.infer<typeof returnStatusSchema>;

export const returnSchema = z.object({
  id: z.uuid(),
  orderId: z.uuid(),
  orderNumber: z.number().int(),
  email: z.string(),
  status: returnStatusSchema,
  requestedByCustomer: z.boolean(),
  customerNote: z.string().nullable(),
  declineReason: z.string().nullable(),
  lines: z.array(
    z.object({
      orderLineId: z.uuid(),
      title: z.string(),
      variantTitle: z.string(),
      quantity: z.number().int(),
      reason: returnReasonSchema,
    }),
  ),
  /** Suggested refund for the returned items (net of discounts, plus their tax). */
  suggestedRefund: z.number().int(),
  refundId: z.uuid().nullable(),
  createdAt: z.iso.datetime(),
  closedAt: z.iso.datetime().nullable(),
});
export type Return = z.infer<typeof returnSchema>;

export const returnListQuerySchema = z.strictObject({
  status: returnStatusSchema.optional(),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});
export type ReturnListQuery = z.infer<typeof returnListQuerySchema>;
