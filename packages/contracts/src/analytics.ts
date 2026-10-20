import { z } from 'zod';

export const analyticsQuerySchema = z.strictObject({
  days: z.coerce.number().int().min(1).max(365).default(30),
});

export const analyticsSchema = z.object({
  currency: z.string(),
  rangeDays: z.number().int(),
  /** Paid order totals minus refunds in the range. */
  netSales: z.number().int(),
  grossSales: z.number().int(),
  refunded: z.number().int(),
  orderCount: z.number().int(),
  averageOrderValue: z.number().int(),
  daily: z.array(z.object({ date: z.string(), sales: z.number().int(), orders: z.number().int() })),
  topProducts: z.array(
    z.object({ title: z.string(), quantity: z.number().int(), revenue: z.number().int() }),
  ),
});
export type Analytics = z.infer<typeof analyticsSchema>;
