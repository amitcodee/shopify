import { z } from 'zod';
import { handleSchema } from './products.js';

export const collectionInputSchema = z.strictObject({
  title: z.string().trim().min(1, 'Enter a title').max(200),
  handle: handleSchema.optional(),
  description: z.string().max(5000).default(''),
  ruleTag: z
    .string()
    .trim()
    .toLowerCase()
    .max(40)
    .transform((v) => (v === '' ? null : v))
    .nullable()
    .optional(),
  published: z.boolean().default(true),
});
export type CollectionInput = z.input<typeof collectionInputSchema>;

export const collectionProductsInputSchema = z.strictObject({
  productIds: z.array(z.uuid()).max(500),
});

export const collectionSchema = z.object({
  id: z.uuid(),
  title: z.string(),
  handle: z.string(),
  description: z.string(),
  ruleTag: z.string().nullable(),
  published: z.boolean(),
  productCount: z.number().int(),
  productIds: z.array(z.uuid()),
  updatedAt: z.iso.datetime(),
});
export type Collection = z.infer<typeof collectionSchema>;
