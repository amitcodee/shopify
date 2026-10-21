import { z } from 'zod';
import { paginated } from './common.js';

export const manualInventoryReasons = [
  'MANUAL',
  'RESTOCK',
  'CORRECTION',
  'DAMAGED',
  'RETURN',
] as const;
export const inventoryReasonSchema = z.enum([
  'INITIAL',
  ...manualInventoryReasons,
  'ORDER',
  'ORDER_CANCELLED',
  'TRANSFER',
]);

export const inventoryAdjustInputSchema = z
  .strictObject({
    /** Relative change (e.g. +10 restock, -2 damaged). */
    delta: z.number().int().min(-1_000_000).max(1_000_000).optional(),
    /** Absolute new quantity (stock count). */
    setTo: z.number().int().min(0).max(1_000_000).optional(),
    reason: z.enum(manualInventoryReasons).default('MANUAL'),
    note: z.string().trim().max(500).optional(),
    /** Location whose stock changes; the default location when omitted. */
    locationId: z.uuid().optional(),
  })
  .refine((v) => (v.delta === undefined) !== (v.setTo === undefined), {
    message: 'Provide either delta or setTo',
  })
  .refine((v) => v.delta !== 0, { message: 'delta cannot be zero', path: ['delta'] });
export type InventoryAdjustInput = z.input<typeof inventoryAdjustInputSchema>;

export const inventoryItemSchema = z.object({
  variantId: z.uuid(),
  productId: z.uuid(),
  productTitle: z.string(),
  variantTitle: z.string(),
  sku: z.string().nullable(),
  trackInventory: z.boolean(),
  allowBackorder: z.boolean(),
  /** Total across locations. */
  inventoryQuantity: z.number().int(),
  levels: z.array(z.object({ locationId: z.uuid(), available: z.number().int() })),
});
export type InventoryItem = z.infer<typeof inventoryItemSchema>;
export const inventoryListSchema = paginated(inventoryItemSchema);

export const inventoryListQuerySchema = z.strictObject({
  q: z.string().trim().max(100).optional(),
  lowStock: z.enum(['true', 'false']).optional(),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});

export const inventoryAdjustmentSchema = z.object({
  id: z.uuid(),
  delta: z.number().int(),
  quantityAfter: z.number().int(),
  reason: inventoryReasonSchema,
  note: z.string().nullable(),
  locationName: z.string().nullable(),
  createdAt: z.iso.datetime(),
});
export type InventoryAdjustment = z.infer<typeof inventoryAdjustmentSchema>;

export const LOW_STOCK_THRESHOLD = 5;

export const locationInputSchema = z.strictObject({
  name: z.string().trim().min(1, 'Name the location').max(100),
  address: z.string().trim().max(300).default(''),
  active: z.boolean().default(true),
  priority: z.number().int().min(0).max(1000).default(0),
  isDefault: z.boolean().default(false),
});
export type LocationInput = z.input<typeof locationInputSchema>;

export const locationSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  address: z.string(),
  active: z.boolean(),
  priority: z.number().int(),
  isDefault: z.boolean(),
  /** Units on hand across all variants. */
  unitsOnHand: z.number().int(),
});
export type Location = z.infer<typeof locationSchema>;

export const inventoryTransferInputSchema = z
  .strictObject({
    fromLocationId: z.uuid(),
    toLocationId: z.uuid(),
    quantity: z.number().int().min(1).max(1_000_000),
    note: z.string().trim().max(500).optional(),
  })
  .refine((v) => v.fromLocationId !== v.toLocationId, {
    message: 'Choose two different locations',
    path: ['toLocationId'],
  });
