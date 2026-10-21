import { z } from 'zod';
import { permissionSchema, type Permission } from './permissions.js';

/** Permissions an API token may hold: never staff or billing management. */
export const API_TOKEN_PERMISSIONS = permissionSchema.options.filter(
  (p): p is Exclude<Permission, 'staff:manage' | 'billing:manage'> =>
    p !== 'staff:manage' && p !== 'billing:manage',
);
export const API_TOKEN_PREFIX = 'cpat_';

export const apiTokenInputSchema = z.strictObject({
  name: z.string().trim().min(1, 'Name the token').max(100),
  permissions: z
    .array(z.enum(API_TOKEN_PERMISSIONS as [Permission, ...Permission[]]))
    .min(1, 'Choose at least one permission')
    .transform((p) => [...new Set(p)]),
});
export type ApiTokenInput = z.input<typeof apiTokenInputSchema>;

export const apiTokenSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  prefix: z.string(),
  permissions: z.array(permissionSchema),
  createdBy: z.string(),
  lastUsedAt: z.iso.datetime().nullable(),
  revokedAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
});
export type ApiToken = z.infer<typeof apiTokenSchema>;

/** Returned once, at creation: the only time the token itself is shown. */
export const createdApiTokenSchema = apiTokenSchema.extend({ token: z.string() });
export type CreatedApiToken = z.infer<typeof createdApiTokenSchema>;

export const WEBHOOK_TOPICS = [
  'orders/paid',
  'orders/cancelled',
  'orders/fulfilled',
  'refunds/created',
  'products/created',
  'products/updated',
  'products/deleted',
] as const;
export const webhookTopicSchema = z.enum(WEBHOOK_TOPICS);
export type WebhookTopic = z.infer<typeof webhookTopicSchema>;

/** Headers on every webhook delivery. Verify the HMAC over the raw body before trusting it. */
export const WEBHOOK_HEADERS = {
  topic: 'x-commerce-topic',
  storeId: 'x-commerce-store-id',
  deliveryId: 'x-commerce-webhook-id',
  /** Base64 HMAC-SHA256 of the raw request body, keyed with the subscription's secret. */
  signature: 'x-commerce-hmac-sha256',
} as const;

export const webhookInputSchema = z.strictObject({
  topic: webhookTopicSchema,
  url: z.url({ protocol: /^https?$/, message: 'Enter an http(s) URL' }).max(500),
});

export const webhookSchema = z.object({
  id: z.uuid(),
  topic: webhookTopicSchema,
  url: z.string(),
  failureCount: z.number().int(),
  disabled: z.boolean(),
  createdAt: z.iso.datetime(),
});
export type Webhook = z.infer<typeof webhookSchema>;

/** Returned once, at creation: the signing secret. */
export const createdWebhookSchema = webhookSchema.extend({ secret: z.string() });
export type CreatedWebhook = z.infer<typeof createdWebhookSchema>;

export const webhookDeliverySchema = z.object({
  id: z.uuid(),
  topic: z.string(),
  status: z.enum(['PENDING', 'SUCCEEDED', 'FAILED']),
  attempts: z.number().int(),
  lastStatusCode: z.number().int().nullable(),
  lastError: z.string().nullable(),
  createdAt: z.iso.datetime(),
  deliveredAt: z.iso.datetime().nullable(),
});
export type WebhookDelivery = z.infer<typeof webhookDeliverySchema>;

/** Body of orders/* and refunds/created webhooks. */
export interface WebhookOrderPayload {
  id: string;
  number: number;
  email: string;
  status: string;
  financialStatus: string;
  fulfillmentStatus: string;
  currency: string;
  subtotal: number;
  discountTotal: number;
  shippingTotal: number;
  taxTotal: number;
  total: number;
  lines: {
    variantId: string | null;
    sku: string | null;
    title: string;
    quantity: number;
    unitPrice: number;
  }[];
  createdAt: string;
  /** refunds/created only. */
  refund?: { id: string; amount: number };
}

/** Body of products/* webhooks (products/deleted carries only id and handle). */
export interface WebhookProductPayload {
  id: string;
  handle: string;
  title?: string;
  status?: string;
  variants?: { id: string; sku: string | null; price: number; inventoryQuantity: number }[];
}
