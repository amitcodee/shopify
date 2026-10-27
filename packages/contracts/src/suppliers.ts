import { z } from 'zod';
import { paginated } from './common.js';
import { LOW_STOCK_THRESHOLD } from './inventory.js';

const moneyMinor = z.number().int().min(0).max(100_000_000);
const text = (max: number) => z.string().trim().max(max).default('');
const blankToUndefined = (v: unknown) => (v === '' ? undefined : v);

// ───────────────────────────── Suppliers ─────────────────────────────

export const supplierInputSchema = z.strictObject({
  name: z.string().trim().min(1, 'Name the supplier').max(100),
  contactName: text(100),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(254)
    .refine((v) => v === '' || z.email().safeParse(v).success, { message: 'Enter a valid email' })
    .default(''),
  phone: text(40),
  address: text(500),
  website: z
    .string()
    .trim()
    .max(2048)
    .refine((v) => v === '' || (URL.canParse(v) && /^https?:$/.test(new URL(v).protocol)), {
      message: 'Enter a full link starting with https://',
    })
    .default(''),
  /** Typical days from ordering to delivery; prefills a purchase order's expected date. */
  leadTimeDays: z.number().int().min(0).max(365).nullable().default(null),
  notes: text(2000),
  active: z.boolean().default(true),
});
export type SupplierInput = z.input<typeof supplierInputSchema>;

export const supplierSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  contactName: z.string(),
  email: z.string(),
  phone: z.string(),
  address: z.string(),
  website: z.string(),
  leadTimeDays: z.number().int().nullable(),
  notes: z.string(),
  active: z.boolean(),
  /** Products that name this supplier. */
  productCount: z.number().int(),
  /** Purchase orders still expecting stock (ordered or partially received). */
  openPurchaseOrders: z.number().int(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type Supplier = z.infer<typeof supplierSchema>;

/** Stock to reorder from a supplier: its tracked variants at or below the low-stock level. */
export const REORDER_TARGET = LOW_STOCK_THRESHOLD * 4;

export const reorderSuggestionSchema = z.object({
  variantId: z.uuid(),
  productId: z.uuid(),
  productTitle: z.string(),
  variantTitle: z.string(),
  sku: z.string().nullable(),
  inventoryQuantity: z.number().int(),
  /** Units already on open purchase orders (ordered, not yet received). */
  incoming: z.number().int(),
  costPerItem: z.number().int().nullable(),
  /** Brings stock (with incoming units) up to REORDER_TARGET. */
  suggestedQuantity: z.number().int(),
});
export type ReorderSuggestion = z.infer<typeof reorderSuggestionSchema>;

// ─────────────────────────── Purchase orders ───────────────────────────

export const purchaseOrderStatusSchema = z.enum([
  'DRAFT',
  'ORDERED',
  'PARTIALLY_RECEIVED',
  'RECEIVED',
  'CANCELLED',
]);
export type PurchaseOrderStatus = z.infer<typeof purchaseOrderStatusSchema>;

export const MAX_PURCHASE_ORDER_LINES = 200;

const dateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a date like 2026-12-31')
  .refine((v) => new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) === v, {
    message: 'Use a real date',
  });

export const purchaseOrderLineInputSchema = z.strictObject({
  variantId: z.uuid(),
  quantity: z.number().int().min(1).max(100_000),
  /** Cost per unit (minor units, store currency). */
  unitCost: moneyMinor,
  supplierSku: text(64),
});

export const purchaseOrderInputSchema = z.strictObject({
  supplierId: z.uuid(),
  /** Location the stock will be received into. */
  locationId: z.uuid(),
  supplierReference: text(100),
  /** Expected delivery date (YYYY-MM-DD), or null. */
  expectedAt: dateOnly.nullable().default(null),
  shippingCost: moneyMinor.default(0),
  notes: text(2000),
  lines: z
    .array(purchaseOrderLineInputSchema)
    .min(1, 'Add at least one item')
    .max(MAX_PURCHASE_ORDER_LINES)
    .refine((lines) => new Set(lines.map((l) => l.variantId)).size === lines.length, {
      message: 'Each item can be on the order once',
    }),
});
export type PurchaseOrderInput = z.input<typeof purchaseOrderInputSchema>;

export const purchaseOrderActionSchema = z.strictObject({
  /**
   * mark_ordered: sent to the supplier (locks the items); cancel: nothing more is expected;
   * close: done receiving, even if short.
   */
  action: z.enum(['mark_ordered', 'cancel', 'close']),
});

export const purchaseOrderReceiveInputSchema = z
  .strictObject({
    lines: z
      .array(z.strictObject({ lineId: z.uuid(), quantity: z.number().int().min(0).max(100_000) }))
      .min(1)
      .max(MAX_PURCHASE_ORDER_LINES),
    /** Also set each variant's cost per item to the order's unit cost. */
    updateCost: z.boolean().default(false),
  })
  .refine((v) => v.lines.some((l) => l.quantity > 0), {
    path: ['lines'],
    message: 'Enter how many units arrived',
  });
export type PurchaseOrderReceiveInput = z.input<typeof purchaseOrderReceiveInputSchema>;

export const purchaseOrderLineSchema = z.object({
  id: z.uuid(),
  variantId: z.uuid().nullable(),
  productId: z.uuid().nullable(),
  productTitle: z.string(),
  variantTitle: z.string(),
  sku: z.string().nullable(),
  supplierSku: z.string(),
  quantity: z.number().int(),
  receivedQuantity: z.number().int(),
  unitCost: z.number().int(),
  /** quantity × unitCost. */
  total: z.number().int(),
  imageUrl: z.string().nullable(),
});
export type PurchaseOrderLine = z.infer<typeof purchaseOrderLineSchema>;

export const purchaseOrderSchema = z.object({
  id: z.uuid(),
  number: z.number().int(),
  /** "#PO12". */
  name: z.string(),
  status: purchaseOrderStatusSchema,
  supplier: z.object({ id: z.uuid(), name: z.string(), email: z.string() }),
  location: z.object({ id: z.uuid(), name: z.string() }),
  supplierReference: z.string(),
  expectedAt: z.string().nullable(),
  shippingCost: z.number().int(),
  notes: z.string(),
  lines: z.array(purchaseOrderLineSchema),
  subtotal: z.number().int(),
  total: z.number().int(),
  unitsOrdered: z.number().int(),
  unitsReceived: z.number().int(),
  /** Ordered, expected before today and not fully received. */
  overdue: z.boolean(),
  orderedAt: z.iso.datetime().nullable(),
  receivedAt: z.iso.datetime().nullable(),
  cancelledAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type PurchaseOrder = z.infer<typeof purchaseOrderSchema>;

export const purchaseOrderListItemSchema = z.object({
  id: z.uuid(),
  number: z.number().int(),
  name: z.string(),
  status: purchaseOrderStatusSchema,
  supplierId: z.uuid(),
  supplierName: z.string(),
  locationName: z.string(),
  expectedAt: z.string().nullable(),
  total: z.number().int(),
  unitsOrdered: z.number().int(),
  unitsReceived: z.number().int(),
  overdue: z.boolean(),
  createdAt: z.iso.datetime(),
});
export type PurchaseOrderListItem = z.infer<typeof purchaseOrderListItemSchema>;
export const purchaseOrderListSchema = paginated(purchaseOrderListItemSchema);

export const purchaseOrderListQuerySchema = z.strictObject({
  status: z.preprocess(
    blankToUndefined,
    z.enum(['DRAFT', 'ORDERED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED', 'open']).optional(),
  ),
  supplierId: z.preprocess(blankToUndefined, z.uuid().optional()),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});
export type PurchaseOrderListQuery = z.infer<typeof purchaseOrderListQuerySchema>;

export function purchaseOrderName(number: number): string {
  return `#PO${number}`;
}
