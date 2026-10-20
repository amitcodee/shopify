import { z } from 'zod';
import { paginated } from './common.js';

// ── Plans & billing ────────────────────────────────────────────────────────────

const limit = z.number().int().min(0).max(10_000_000).nullable();

export const planInputSchema = z.strictObject({
  code: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9-]{2,30}$/, 'Use lowercase letters, numbers and hyphens'),
  name: z.string().trim().min(1).max(60),
  priceMonthly: z.number().int().min(0).max(10_000_000),
  maxProducts: limit,
  maxStaff: limit,
  maxOrdersPerMonth: limit,
  transactionFeeBps: z.number().int().min(0).max(10_000).default(0),
  active: z.boolean().default(true),
  sortOrder: z.number().int().min(0).max(1000).default(0),
});
export type PlanInput = z.input<typeof planInputSchema>;

export const planSchema = z.object({
  id: z.uuid(),
  code: z.string(),
  name: z.string(),
  priceMonthly: z.number().int(),
  maxProducts: z.number().int().nullable(),
  maxStaff: z.number().int().nullable(),
  maxOrdersPerMonth: z.number().int().nullable(),
  transactionFeeBps: z.number().int(),
  active: z.boolean(),
  isDefault: z.boolean(),
  sortOrder: z.number().int(),
});
export type Plan = z.infer<typeof planSchema>;

export const subscriptionStatusSchema = z.enum(['TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELLED']);

export const usageSchema = z.object({
  products: z.number().int(),
  staff: z.number().int(),
  ordersThisMonth: z.number().int(),
});
export type Usage = z.infer<typeof usageSchema>;

export const billingOverviewSchema = z.object({
  plan: planSchema,
  status: subscriptionStatusSchema,
  currentPeriodEnd: z.iso.datetime(),
  trialEndsAt: z.iso.datetime().nullable(),
  pendingPlan: planSchema.nullable(),
  provider: z.string(),
  usage: usageSchema,
  plans: z.array(planSchema),
  invoices: z.array(
    z.object({
      id: z.uuid(),
      planName: z.string(),
      amount: z.number().int(),
      currency: z.string(),
      status: z.enum(['OPEN', 'PAID', 'VOID']),
      periodStart: z.iso.datetime(),
      periodEnd: z.iso.datetime(),
      createdAt: z.iso.datetime(),
    }),
  ),
});
export type BillingOverview = z.infer<typeof billingOverviewSchema>;

export const changePlanInputSchema = z.strictObject({ planId: z.uuid() });

export const changePlanResultSchema = z.object({
  /** Set when the provider needs the merchant to complete payment on a hosted page. */
  checkoutUrl: z.string().nullable(),
  billing: billingOverviewSchema,
});
export type ChangePlanResult = z.infer<typeof changePlanResultSchema>;

// ── Platform admin ─────────────────────────────────────────────────────────────

export const platformOverviewSchema = z.object({
  stores: z.object({
    total: z.number().int(),
    active: z.number().int(),
    suspended: z.number().int(),
  }),
  users: z.number().int(),
  merchants: z.number().int(),
  /** Monthly recurring revenue from paid, active subscriptions (USD cents). */
  mrr: z.number().int(),
  paidOrders30d: z.number().int(),
  /** Gross merchandise volume per currency in the last 30 days. */
  gmv30d: z.array(z.object({ currency: z.string(), amount: z.number().int() })),
  planBreakdown: z.array(z.object({ plan: z.string(), stores: z.number().int() })),
});
export type PlatformOverview = z.infer<typeof platformOverviewSchema>;

export const platformStoreSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  subdomain: z.string(),
  status: z.enum(['ACTIVE', 'SUSPENDED']),
  suspendedReason: z.string().nullable(),
  ownerEmail: z.string(),
  plan: z.string(),
  subscriptionStatus: subscriptionStatusSchema,
  usage: usageSchema,
  createdAt: z.iso.datetime(),
});
export type PlatformStore = z.infer<typeof platformStoreSchema>;
export const platformStoreListSchema = paginated(platformStoreSchema);

export const platformStoreQuerySchema = z.strictObject({
  q: z.string().trim().max(100).optional(),
  status: z.enum(['ACTIVE', 'SUSPENDED']).optional(),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export const suspendStoreInputSchema = z.strictObject({
  reason: z.string().trim().min(3).max(500),
});

export const setStorePlanInputSchema = z.strictObject({
  planId: z.uuid(),
  status: subscriptionStatusSchema.default('ACTIVE'),
});

export const platformUserSchema = z.object({
  id: z.uuid(),
  email: z.string(),
  name: z.string(),
  platformRole: z.enum(['NONE', 'SUPPORT', 'SUPER_ADMIN']),
  disabled: z.boolean(),
  stores: z.number().int(),
  createdAt: z.iso.datetime(),
});
export type PlatformUser = z.infer<typeof platformUserSchema>;
export const platformUserListSchema = paginated(platformUserSchema);

export const platformSettingsSchema = z.strictObject({
  signupsEnabled: z.boolean().default(true),
  supportEmail: z.email().default('support@example.com'),
  /** Optional banner shown in the merchant admin. */
  adminNotice: z.string().trim().max(300).default(''),
});
export type PlatformSettings = z.output<typeof platformSettingsSchema>;

export const platformAuditEntrySchema = z.object({
  id: z.uuid(),
  actor: z.object({ id: z.uuid(), email: z.string() }).nullable(),
  action: z.string(),
  targetType: z.string(),
  targetId: z.string().nullable(),
  data: z.unknown().nullable(),
  createdAt: z.iso.datetime(),
});
export type PlatformAuditEntry = z.infer<typeof platformAuditEntrySchema>;
export const platformAuditPageSchema = paginated(platformAuditEntrySchema);
