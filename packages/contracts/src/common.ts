import { z } from 'zod';

export const uuidSchema = z.uuid();

/** RFC 9457 problem details returned by the API for every error. */
export const problemDetailsSchema = z.object({
  type: z.string(),
  title: z.string(),
  status: z.number().int(),
  detail: z.string().optional(),
  errors: z.array(z.object({ path: z.string(), message: z.string() })).optional(),
});
export type ProblemDetails = z.infer<typeof problemDetailsSchema>;

export const paginationQuerySchema = z.strictObject({
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});
export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

export function paginated<T extends z.ZodType>(item: T) {
  return z.object({
    items: z.array(item),
    page: z.number().int(),
    pageSize: z.number().int(),
    total: z.number().int(),
  });
}
export type Paginated<T> = { items: T[]; page: number; pageSize: number; total: number };

export const emailSchema = z
  .email()
  .max(254)
  .transform((value) => value.trim().toLowerCase());

export const currencyCodeSchema = z
  .string()
  .regex(/^[A-Z]{3}$/, 'Use a 3-letter ISO currency code');

export const SUPPORTED_CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'INR', 'JPY'] as const;
