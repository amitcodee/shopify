import 'server-only';
import { z } from 'zod';

const publicPlanSchema = z.object({
  code: z.string(),
  name: z.string(),
  priceMonthly: z.number().int(),
  maxProducts: z.number().int().nullable(),
  maxStaff: z.number().int().nullable(),
  maxOrdersPerMonth: z.number().int().nullable(),
  transactionFeeBps: z.number().int(),
});
export type PublicPlan = z.infer<typeof publicPlanSchema>;

/** Active plans for the pricing section; null when the API is unreachable (pricing is hidden). */
export async function fetchPublicPlans(): Promise<PublicPlan[] | null> {
  const apiUrl = process.env.API_URL ?? 'http://localhost:4000';
  try {
    const res = await fetch(`${apiUrl}/api/v1/public/plans`, {
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return null;
    const plans = z.array(publicPlanSchema).safeParse(await res.json());
    return plans.success && plans.data.length > 0 ? plans.data : null;
  } catch {
    return null;
  }
}
