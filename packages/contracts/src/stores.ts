import { z } from 'zod';
import { currencyCodeSchema, emailSchema } from './common.js';
import { permissionSchema, type StoreRole, storeRoleSchema } from './permissions.js';
import type { Theme } from './settings.js';

export const RESERVED_SUBDOMAINS = [
  'www',
  'admin',
  'api',
  'app',
  'mail',
  'platform',
  'static',
  'cdn',
  'assets',
  'support',
  'help',
  'status',
  'billing',
] as const;

export const subdomainSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, 'Use at least 3 characters')
  .max(40, 'Use at most 40 characters')
  .regex(
    /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/,
    'Use lowercase letters, numbers and hyphens (not at the start or end)',
  )
  .refine((value) => !(RESERVED_SUBDOMAINS as readonly string[]).includes(value), {
    message: 'This address is reserved',
  });

export const storeStatusSchema = z.enum(['ACTIVE', 'SUSPENDED', 'CLOSED']);

export const createStoreInputSchema = z.strictObject({
  name: z.string().trim().min(1, 'Enter a store name').max(100),
  subdomain: subdomainSchema,
  contactEmail: emailSchema,
  currency: currencyCodeSchema.default('USD'),
});
export type CreateStoreInput = z.infer<typeof createStoreInputSchema>;

/** Hours before an abandoned-checkout email; null turns recovery emails off. */
export const ABANDONED_CHECKOUT_DELAYS = [1, 6, 10, 24] as const;
export const abandonedCheckoutDelaySchema = z
  .number()
  .int()
  .refine((h) => (ABANDONED_CHECKOUT_DELAYS as readonly number[]).includes(h), {
    message: `Choose ${ABANDONED_CHECKOUT_DELAYS.join(', ')} hours`,
  })
  .nullable();

export const updateStoreInputSchema = z.strictObject({
  name: z.string().trim().min(1).max(100).optional(),
  contactEmail: emailSchema.optional(),
  currency: currencyCodeSchema.optional(),
  timezone: z.string().trim().min(1).max(64).optional(),
  abandonedCheckoutDelayHours: abandonedCheckoutDelaySchema.optional(),
});
export type UpdateStoreInput = z.infer<typeof updateStoreInputSchema>;

export const storeSummarySchema = z.object({
  id: z.uuid(),
  name: z.string(),
  subdomain: z.string(),
  status: storeStatusSchema,
  role: storeRoleSchema,
});
export type StoreSummary = z.infer<typeof storeSummarySchema>;

export const storeDetailSchema = storeSummarySchema.extend({
  contactEmail: z.string(),
  currency: z.string(),
  timezone: z.string(),
  abandonedCheckoutDelayHours: z.number().int().nullable(),
  permissions: z.array(permissionSchema),
  /** Billing lapsed: the storefront is offline and only billing pages work. */
  billingLocked: z.boolean(),
  /** When the free trial ends (null when not on a trial). */
  trialEndsAt: z.iso.datetime().nullable(),
  /** What the owner must do about billing: subscribe, authorise a mandate, fix a payment. */
  billingAction: z.enum(['subscribe', 'authorize', 'update_payment']).nullable(),
  closedAt: z.iso.datetime().nullable(),
  /** A closed store's data is permanently erased at this time unless it is reopened. */
  deletionScheduledAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
});
export type StoreDetail = z.infer<typeof storeDetailSchema>;

/** Days a closed store can still be reopened before its data is erased. */
export const STORE_DELETION_GRACE_DAYS = 30;

export const closeStoreInputSchema = z.strictObject({
  /** The owner types the store's address (subdomain) to confirm. */
  confirmSubdomain: z.string().trim().toLowerCase().min(1).max(63),
});

/**
 * One card on the store picker. Every number is gated by the same permission as the page it comes
 * from, so a field is null when this member may not see it (or the store is suspended).
 */
export interface StoreOverview extends StoreSummary {
  createdAt: string;
  currency: string;
  timezone: string;
  passwordProtected: boolean;
  /** The published theme and up to four product photos, to draw a preview of the store. */
  theme: Theme;
  photos: { url: string; alt: string }[];
  metrics: {
    /** Products on sale now. */
    products: number | null;
    customers: number | null;
    /** Paid orders, all time. */
    orders: number | null;
    lastOrderAt: string | null;
    /** Gross sales from orders paid in the last 30 days, in minor units. */
    sales30d: number | null;
  };
  /** Up to five names, earliest member first; `count` is the whole team. */
  team: { count: number; members: { name: string; role: StoreRole }[] } | null;
  plan: { name: string; status: string; trialEndsAt: string | null } | null;
}
