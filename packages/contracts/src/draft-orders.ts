import { z } from 'zod';
import { addressSchema } from './checkout.js';
import { emailSchema, paginated } from './common.js';

const quantitySchema = z.number().int().min(1).max(999);
const priceSchema = z.number().int().min(0).max(100_000_000);

/** A catalog variant (optionally at a custom price) or a custom item that is not in the catalog. */
export const draftLineInputSchema = z.union([
  z.strictObject({
    variantId: z.uuid(),
    quantity: quantitySchema,
    /** Overrides the variant's price for this draft. */
    unitPrice: priceSchema.optional(),
  }),
  z.strictObject({
    title: z.string().trim().min(1, 'Enter an item name').max(200),
    unitPrice: priceSchema,
    quantity: quantitySchema,
    taxable: z.boolean().default(true),
    requiresShipping: z.boolean().default(true),
  }),
]);
export type DraftLineInput = z.input<typeof draftLineInputSchema>;

export const draftDiscountSchema = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('PERCENTAGE'), value: z.number().int().min(1).max(100) }),
  z.strictObject({ type: z.literal('FIXED_AMOUNT'), value: priceSchema.min(1) }),
]);
export type DraftDiscount = z.infer<typeof draftDiscountSchema>;

export const draftOrderInputSchema = z.strictObject({
  email: emailSchema.nullable().optional(),
  lines: z.array(draftLineInputSchema).min(1, 'Add at least one item').max(100),
  shippingAddress: addressSchema.nullable().optional(),
  shipping: z
    .strictObject({ title: z.string().trim().min(1).max(100), price: priceSchema })
    .nullable()
    .optional(),
  discount: draftDiscountSchema.nullable().optional(),
  note: z.string().trim().max(1000).nullable().optional(),
});
export type DraftOrderInput = z.input<typeof draftOrderInputSchema>;

/** A priced line as stored on the draft. */
export const draftOrderLineSchema = z.object({
  variantId: z.uuid().nullable(),
  productId: z.uuid().nullable(),
  title: z.string(),
  variantTitle: z.string(),
  sku: z.string().nullable(),
  unitPrice: z.number().int(),
  quantity: z.number().int(),
  taxable: z.boolean(),
  requiresShipping: z.boolean(),
  weightGrams: z.number().int(),
});
export type DraftOrderLine = z.infer<typeof draftOrderLineSchema>;

export const draftOrderStatusSchema = z.enum(['OPEN', 'INVOICE_SENT', 'COMPLETED']);
export type DraftOrderStatus = z.infer<typeof draftOrderStatusSchema>;

export const draftOrderSchema = z.object({
  id: z.uuid(),
  number: z.number().int(),
  status: draftOrderStatusSchema,
  email: z.string().nullable(),
  customerId: z.uuid().nullable(),
  lines: z.array(draftOrderLineSchema.extend({ total: z.number().int() })),
  shippingAddress: addressSchema.nullable(),
  shipping: z.object({ title: z.string(), price: z.number().int() }).nullable(),
  discount: draftDiscountSchema.nullable(),
  note: z.string().nullable(),
  currency: z.string(),
  subtotal: z.number().int(),
  discountTotal: z.number().int(),
  shippingTotal: z.number().int(),
  taxTotal: z.number().int(),
  total: z.number().int(),
  /** The order created from this draft (awaiting payment or completed). */
  order: z.object({ id: z.uuid(), number: z.number().int(), status: z.string() }).nullable(),
  invoiceSentAt: z.iso.datetime().nullable(),
  completedAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type DraftOrder = z.infer<typeof draftOrderSchema>;

export const draftOrderListItemSchema = draftOrderSchema.pick({
  id: true,
  number: true,
  status: true,
  email: true,
  currency: true,
  total: true,
  createdAt: true,
});
export type DraftOrderListItem = z.infer<typeof draftOrderListItemSchema>;
export const draftOrderListSchema = paginated(draftOrderListItemSchema);

export const draftOrderListQuerySchema = z.strictObject({
  status: draftOrderStatusSchema.optional(),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});
export type DraftOrderListQuery = z.infer<typeof draftOrderListQuerySchema>;

export const sendInvoiceInputSchema = z.strictObject({
  /** Optional note shown above the invoice. */
  message: z.string().trim().max(1000).optional(),
});

/** What the shopper sees when opening an emailed invoice. */
export const storefrontInvoiceSchema = z.object({
  storeName: z.string(),
  number: z.number().int(),
  /** payable: can be paid now; paid: already completed; unavailable: withdrawn by the store. */
  state: z.enum(['payable', 'paid', 'unavailable']),
  currency: z.string(),
  lines: z.array(
    z.object({
      title: z.string(),
      variantTitle: z.string(),
      quantity: z.number().int(),
      total: z.number().int(),
    }),
  ),
  subtotal: z.number().int(),
  discountTotal: z.number().int(),
  shippingTotal: z.number().int(),
  taxTotal: z.number().int(),
  total: z.number().int(),
  message: z.string().nullable(),
});
export type StorefrontInvoice = z.infer<typeof storefrontInvoiceSchema>;
