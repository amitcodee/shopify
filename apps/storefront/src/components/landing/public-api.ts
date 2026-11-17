import 'server-only';
import { z } from 'zod';

const publicPlanSchema = z.object({
  code: z.string(),
  name: z.string(),
  priceMonthly: z.number().int(),
  currency: z.string().default('INR'),
  trialDays: z.number().int().default(0),
  introPrice: z.number().int().nullable().default(null),
  introCycles: z.number().int().default(0),
  introUpiOnly: z.boolean().default(false),
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

const inr = (minor: number, currency: string) =>
  new Intl.NumberFormat(currency === 'INR' ? 'en-IN' : 'en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: minor % 100 === 0 ? 0 : 2,
  }).format(minor / 100);

/** A plan's price journey, from the live plan so marketing copy never drifts from billing. */
export interface PlanTerms {
  trialDays: number;
  /** "free for 7 days, then ₹99/month for 3 months, then ₹799/month" (no capital, no period). */
  phrase: string;
  /** No platform fee on sales. */
  noSalesFee: boolean;
}

export function planTerms(plan: PublicPlan): PlanTerms {
  const parts: string[] = [];
  if (plan.trialDays > 0) parts.push(`free for ${plan.trialDays} days`);
  if (plan.introPrice !== null && plan.introCycles > 0 && plan.introPrice < plan.priceMonthly)
    parts.push(
      `${inr(plan.introPrice, plan.currency)}/month for ${plan.introCycles} month${plan.introCycles === 1 ? '' : 's'}`,
    );
  parts.push(`${inr(plan.priceMonthly, plan.currency)}/month`);
  return {
    trialDays: plan.trialDays,
    phrase: parts.join(', then '),
    noSalesFee: plan.transactionFeeBps === 0,
  };
}

/** Terms of the first (entry) plan; null when the API is unreachable. */
export async function fetchPlanTerms(): Promise<PlanTerms | null> {
  const plans = await fetchPublicPlans();
  return plans?.[0] ? planTerms(plans[0]) : null;
}

/** "Free for 7 days, then …/month." or a neutral fallback. */
export function termsSentence(terms: PlanTerms | null): string {
  if (!terms) return 'Start with a free trial. See pricing for details.';
  return `${terms.phrase.charAt(0).toUpperCase()}${terms.phrase.slice(1)}.`;
}

/** Active plans for pricing; null when the API is unreachable (pricing is hidden). */
export async function fetchPublicPlans(): Promise<PublicPlan[] | null> {
  const plans = await getPublic('plans', z.array(publicPlanSchema));
  return plans && plans.length > 0 ? plans : null;
}

const contactSchema = z.object({
  supportEmail: z.email().nullable(),
  legalName: z.string().nullable().default(null),
  registeredAddress: z.string().nullable().default(null),
  gstin: z.string().nullable().default(null),
  supportPhone: z.string().nullable().default(null),
  grievanceOfficerName: z.string().nullable().default(null),
  grievanceOfficerEmail: z.email().nullable().default(null),
});
export type PlatformContact = z.infer<typeof contactSchema>;

const NO_CONTACT: PlatformContact = {
  supportEmail: null,
  legalName: null,
  registeredAddress: null,
  gstin: null,
  supportPhone: null,
  grievanceOfficerName: null,
  grievanceOfficerEmail: null,
};

/** The operator's public contact and legal identity; every field null when unset or unavailable. */
export async function fetchContact(): Promise<PlatformContact> {
  return (await getPublic('contact', contactSchema)) ?? NO_CONTACT;
}

/** The platform support address for the contact page; null when unset or unavailable. */
export async function fetchSupportEmail(): Promise<string | null> {
  return (await fetchContact()).supportEmail;
}
