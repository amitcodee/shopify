import { z } from 'zod';
import { paginated } from './common.js';

export const handleSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1)
  .max(120)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase letters, numbers and single hyphens');

/** Turns a title into a URL handle ("Blue T-Shirt!" -> "blue-t-shirt"). */
export function slugify(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}

export const productStatusSchema = z.enum(['DRAFT', 'ACTIVE', 'ARCHIVED']);
export type ProductStatus = z.infer<typeof productStatusSchema>;

const moneyMinor = z.number().int().min(0).max(100_000_000);
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === '' ? null : v))
    .nullable()
    .optional();

export const productOptionInputSchema = z.strictObject({
  name: z.string().trim().min(1).max(50),
  values: z
    .array(z.string().trim().min(1).max(50))
    .min(1)
    .max(50)
    .refine((values) => new Set(values.map((v) => v.toLowerCase())).size === values.length, {
      message: 'Option values must be unique',
    }),
});

export const variantInputSchema = z.strictObject({
  /** Present when updating an existing variant. */
  id: z.uuid().optional(),
  options: z.array(z.string().trim().min(1).max(50)).max(3).default([]),
  sku: optionalText(64),
  barcode: optionalText(64),
  price: moneyMinor,
  compareAtPrice: moneyMinor.nullable().optional(),
  weightGrams: z.number().int().min(0).max(1_000_000).default(0),
  requiresShipping: z.boolean().default(true),
  taxable: z.boolean().default(true),
  trackInventory: z.boolean().default(true),
  allowBackorder: z.boolean().default(false),
  /** Starting stock for new variants; existing stock changes go through inventory adjustments. */
  inventoryQuantity: z.number().int().min(0).max(1_000_000).optional(),
});
export type VariantInput = z.infer<typeof variantInputSchema>;

export const productInputSchema = z
  .strictObject({
    title: z.string().trim().min(1, 'Enter a title').max(200),
    handle: handleSchema.optional(),
    description: z.string().max(20_000).default(''),
    status: productStatusSchema.default('DRAFT'),
    vendor: optionalText(100),
    productType: optionalText(100),
    tags: z
      .array(z.string().trim().toLowerCase().min(1).max(40))
      .max(50)
      .default([])
      .transform((tags) => [...new Set(tags)]),
    seoTitle: optionalText(70),
    seoDescription: optionalText(320),
    isGiftCard: z.boolean().default(false),
    options: z
      .array(productOptionInputSchema)
      .max(3)
      .default([])
      .refine((opts) => new Set(opts.map((o) => o.name.toLowerCase())).size === opts.length, {
        message: 'Option names must be unique',
      }),
    variants: z.array(variantInputSchema).min(1, 'Add at least one variant').max(100),
  })
  .superRefine((product, ctx) => {
    const seen = new Set<string>();
    product.variants.forEach((variant, index) => {
      if (variant.options.length !== product.options.length) {
        ctx.addIssue({
          code: 'custom',
          path: ['variants', index, 'options'],
          message: 'Each variant needs one value per option',
        });
        return;
      }
      variant.options.forEach((value, position) => {
        if (!product.options[position]?.values.includes(value)) {
          ctx.addIssue({
            code: 'custom',
            path: ['variants', index, 'options', position],
            message: `"${value}" is not a value of option ${product.options[position]?.name ?? position + 1}`,
          });
        }
      });
      const key = variant.options.join('\u0000').toLowerCase();
      if (seen.has(key)) {
        ctx.addIssue({
          code: 'custom',
          path: ['variants', index],
          message: 'Duplicate variant combination',
        });
      }
      seen.add(key);
    });
    if (product.options.length === 0 && product.variants.length > 1) {
      ctx.addIssue({
        code: 'custom',
        path: ['variants'],
        message: 'Products without options have exactly one variant',
      });
    }
    const skus = product.variants.map((v) => v.sku).filter(Boolean);
    if (new Set(skus).size !== skus.length) {
      ctx.addIssue({ code: 'custom', path: ['variants'], message: 'SKUs must be unique' });
    }
  })
  // Gift cards are delivered by email: never shipped, taxed (tax applies when they are spent)
  // or limited by stock.
  .transform((product) =>
    product.isGiftCard
      ? {
          ...product,
          variants: product.variants.map((v) => ({
            ...v,
            requiresShipping: false,
            taxable: false,
            trackInventory: false,
            allowBackorder: false,
            weightGrams: 0,
          })),
        }
      : product,
  );
export type ProductInput = z.input<typeof productInputSchema>;
export type ProductInputParsed = z.output<typeof productInputSchema>;

export const productImageSchema = z.object({
  id: z.uuid(),
  url: z.string(),
  alt: z.string(),
  width: z.number().int(),
  height: z.number().int(),
  position: z.number().int(),
});
export type ProductImage = z.infer<typeof productImageSchema>;

export const variantSchema = z.object({
  id: z.uuid(),
  title: z.string(),
  options: z.array(z.string()),
  sku: z.string().nullable(),
  barcode: z.string().nullable(),
  price: z.number().int(),
  compareAtPrice: z.number().int().nullable(),
  weightGrams: z.number().int(),
  requiresShipping: z.boolean(),
  taxable: z.boolean(),
  trackInventory: z.boolean(),
  allowBackorder: z.boolean(),
  inventoryQuantity: z.number().int(),
  position: z.number().int(),
});
export type Variant = z.infer<typeof variantSchema>;

export const productSchema = z.object({
  id: z.uuid(),
  title: z.string(),
  handle: z.string(),
  description: z.string(),
  status: productStatusSchema,
  vendor: z.string().nullable(),
  productType: z.string().nullable(),
  tags: z.array(z.string()),
  seoTitle: z.string().nullable(),
  seoDescription: z.string().nullable(),
  isGiftCard: z.boolean(),
  options: z.array(z.object({ name: z.string(), values: z.array(z.string()) })),
  variants: z.array(variantSchema),
  images: z.array(productImageSchema),
  collectionIds: z.array(z.uuid()),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type Product = z.infer<typeof productSchema>;

export const productListItemSchema = z.object({
  id: z.uuid(),
  title: z.string(),
  handle: z.string(),
  status: productStatusSchema,
  vendor: z.string().nullable(),
  variantCount: z.number().int(),
  totalInventory: z.number().int(),
  minPrice: z.number().int(),
  maxPrice: z.number().int(),
  imageUrl: z.string().nullable(),
  updatedAt: z.iso.datetime(),
});
export type ProductListItem = z.infer<typeof productListItemSchema>;
export const productListSchema = paginated(productListItemSchema);

export const productListQuerySchema = z.strictObject({
  q: z.string().trim().max(100).optional(),
  status: productStatusSchema.optional(),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});
export type ProductListQuery = z.infer<typeof productListQuerySchema>;

export const updateImageInputSchema = z.strictObject({
  alt: z.string().trim().max(200).optional(),
  position: z.number().int().min(0).max(100).optional(),
});
