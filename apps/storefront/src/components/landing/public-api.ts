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

/** GET an unauthenticated `/api/v1/public/*` resource; null on any failure (callers fail soft). */
async function getPublic<T>(path: string, schema: z.ZodType<T>): Promise<T | null> {
  const apiUrl = process.env.API_URL ?? 'http://localhost:4000';
  try {
    const res = await fetch(`${apiUrl}/api/v1/public/${path}`, {
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return null;
    const parsed = schema.safeParse(await res.json());
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/** Active plans for pricing; null when the API is unreachable (pricing is hidden). */
export async function fetchPublicPlans(): Promise<PublicPlan[] | null> {
  const plans = await getPublic('plans', z.array(publicPlanSchema));
  return plans && plans.length > 0 ? plans : null;
}

/** The platform support address for the contact page; null when unset or unavailable. */
export async function fetchSupportEmail(): Promise<string | null> {
  const contact = await getPublic('contact', z.object({ supportEmail: z.email().nullable() }));
  return contact?.supportEmail ?? null;
}
