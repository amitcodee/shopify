import { z } from 'zod';
import { currencyCodeSchema, emailSchema } from './common.js';
import { permissionSchema, storeRoleSchema } from './permissions.js';

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

export const storeStatusSchema = z.enum(['ACTIVE', 'SUSPENDED']);

export const createStoreInputSchema = z.strictObject({
  name: z.string().trim().min(1, 'Enter a store name').max(100),
  subdomain: subdomainSchema,
  contactEmail: emailSchema,
  currency: currencyCodeSchema.default('USD'),
});
export type CreateStoreInput = z.infer<typeof createStoreInputSchema>;

export const updateStoreInputSchema = z.strictObject({
  name: z.string().trim().min(1).max(100).optional(),
  contactEmail: emailSchema.optional(),
  currency: currencyCodeSchema.optional(),
  timezone: z.string().trim().min(1).max(64).optional(),
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
  permissions: z.array(permissionSchema),
  createdAt: z.iso.datetime(),
});
export type StoreDetail = z.infer<typeof storeDetailSchema>;
