import { z } from 'zod';
import { adminCustomerSchema } from './customers.js';

const count = z.number().int().min(0).max(1_000_000);
const days = z.number().int().min(0).max(36_500);
const compare = z.enum(['gte', 'lte']);

/** One typed condition; a segment matches customers meeting all of its conditions. */
export const segmentConditionSchema = z.discriminatedUnion('field', [
  z.strictObject({
    field: z.literal('ordersCount'),
    op: z.enum(['gte', 'lte', 'eq']),
    value: count,
  }),
  /** Paid order totals, minor units. */
  z.strictObject({ field: z.literal('totalSpent'), op: compare, value: z.number().int().min(0) }),
  /** lte: ordered within the last N days; gte: has ordered, but not in the last N days. */
  z.strictObject({ field: z.literal('lastOrderDaysAgo'), op: compare, value: days }),
  /** lte: joined within the last N days; gte: joined more than N days ago. */
  z.strictObject({ field: z.literal('createdDaysAgo'), op: compare, value: days }),
  z.strictObject({ field: z.literal('acceptsMarketing'), value: z.boolean() }),
  z.strictObject({ field: z.literal('hasAccount'), value: z.boolean() }),
]);
export type SegmentCondition = z.infer<typeof segmentConditionSchema>;

export const SEGMENT_FIELDS: Record<SegmentCondition['field'], string> = {
  ordersCount: 'Number of paid orders',
  totalSpent: 'Amount spent',
  lastOrderDaysAgo: 'Days since last order',
  createdDaysAgo: 'Days since signing up',
  acceptsMarketing: 'Accepts email marketing',
  hasAccount: 'Has an account',
};

export const segmentInputSchema = z.strictObject({
  name: z.string().trim().min(1, 'Name the segment').max(100),
  conditions: z.array(segmentConditionSchema).max(10),
});
export type SegmentInput = z.input<typeof segmentInputSchema>;

export const segmentSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  conditions: z.array(segmentConditionSchema),
  customerCount: z.number().int(),
  updatedAt: z.iso.datetime(),
});
export type Segment = z.infer<typeof segmentSchema>;

export const segmentMembersSchema = z.object({
  items: z.array(adminCustomerSchema.extend({ lastOrderAt: z.iso.datetime().nullable() })),
  page: z.number().int(),
  pageSize: z.number().int(),
  total: z.number().int(),
});
export type SegmentMembers = z.infer<typeof segmentMembersSchema>;

/** Human-readable summary, e.g. "Number of paid orders ≥ 2". */
export function describeCondition(
  c: SegmentCondition,
  formatAmount: (minor: number) => string = String,
): string {
  const label = SEGMENT_FIELDS[c.field];
  if (c.field === 'acceptsMarketing' || c.field === 'hasAccount') {
    return `${label}: ${c.value ? 'yes' : 'no'}`;
  }
  const symbol = { gte: '≥', lte: '≤', eq: '=' }[c.op];
  return `${label} ${symbol} ${c.field === 'totalSpent' ? formatAmount(c.value) : c.value}`;
}
