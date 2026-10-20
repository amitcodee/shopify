import { z } from 'zod';
import { passwordSchema } from './auth.js';
import { emailSchema, paginated } from './common.js';
import {
  financialStatusSchema,
  fulfillmentStatusSchema,
  orderListItemSchema,
  orderStatusSchema,
} from './orders.js';

export const customerRegisterInputSchema = z.strictObject({
  name: z.string().trim().min(1, 'Enter your name').max(100),
  email: emailSchema,
  password: passwordSchema,
  acceptsMarketing: z.boolean().default(false),
});

export const customerLoginInputSchema = z.strictObject({
  email: emailSchema,
  password: z.string().min(1).max(128),
});

export const customerTokenInputSchema = z.strictObject({
  token: z.string().min(10).max(200),
  password: passwordSchema,
});

export const customerEmailInputSchema = z.strictObject({ email: emailSchema });

export const customerSessionSchema = z.object({
  token: z.string(),
  expiresAt: z.iso.datetime(),
  customer: z.object({ id: z.uuid(), email: z.string(), name: z.string().nullable() }),
});
export type CustomerSession = z.infer<typeof customerSessionSchema>;

export const customerRegisterResultSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('created'), session: customerSessionSchema }),
  /** A guest record already exists: an activation link was emailed instead (prevents takeover). */
  z.object({ status: z.literal('activation_sent') }),
]);
export type CustomerRegisterResult = z.infer<typeof customerRegisterResultSchema>;

export const customerAccountSchema = z.object({
  id: z.uuid(),
  email: z.string(),
  name: z.string().nullable(),
  orders: z.array(
    z.object({
      number: z.number().int(),
      status: orderStatusSchema,
      financialStatus: financialStatusSchema,
      fulfillmentStatus: fulfillmentStatusSchema,
      total: z.number().int(),
      currency: z.string(),
      createdAt: z.iso.datetime(),
    }),
  ),
});
export type CustomerAccount = z.infer<typeof customerAccountSchema>;

export const adminCustomerSchema = z.object({
  id: z.uuid(),
  email: z.string(),
  name: z.string().nullable(),
  hasAccount: z.boolean(),
  acceptsMarketing: z.boolean(),
  ordersCount: z.number().int(),
  totalSpent: z.number().int(),
  createdAt: z.iso.datetime(),
});
export type AdminCustomer = z.infer<typeof adminCustomerSchema>;
export const adminCustomerListSchema = paginated(adminCustomerSchema);

export const adminCustomerDetailSchema = adminCustomerSchema.extend({
  orders: z.array(orderListItemSchema),
});
export type AdminCustomerDetail = z.infer<typeof adminCustomerDetailSchema>;
