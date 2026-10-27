import { z } from 'zod';
import { paginated } from './common.js';
import { customizationSchema, customizationsInputSchema } from './customizations.js';

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

/** How shoppers pick an option's value on the product page. */
export const optionStyleSchema = z.enum(['buttons', 'dropdown', 'swatches']);
export type OptionStyle = z.infer<typeof optionStyleSchema>;

/** "#RGB" or "#RRGGBB" (normalized to lowercase "#rrggbb"), or "" for no swatch. */
export const swatchColorSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^(#[0-9a-f]{3}|#[0-9a-f]{6})?$/, 'Use a colour like #1f6feb')
  .transform((v) => (v.length === 4 ? `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}` : v));

export const productOptionInputSchema = z
  .strictObject({
    name: z.string().trim().min(1).max(50),
    values: z
      .array(z.string().trim().min(1).max(50))
      .min(1)
      .max(50)
      .refine((values) => new Set(values.map((v) => v.toLowerCase())).size === values.length, {
        message: 'Option values must be unique',
      }),
    style: optionStyleSchema.default('buttons'),
    /** One colour per value (same order), or empty. Shown when the style is "swatches". */
    swatches: z.array(swatchColorSchema).max(50).default([]),
  })
  .refine((o) => o.swatches.length === 0 || o.swatches.length === o.values.length, {
    path: ['swatches'],
    message: 'Give one swatch colour per value',
  })
  // Swatches without any colour are dropped.
  .transform((o) => ({ ...o, swatches: o.swatches.some(Boolean) ? o.swatches : [] }));

/** ISO 3166-1 alpha-2 ("us" and "" are accepted and normalized to "US" / null). */
const countryCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .transform((v) => (v === '' ? null : v))
  .pipe(
    z
      .string()
      .regex(/^[A-Z]{2}$/, 'Use a two-letter country code')
      .nullable(),
  );

/** Harmonized System code: 6-10 digits; dots and spaces ("6109.10") are dropped. */
const hsCodeSchema = z
  .string()
  .trim()
  .transform((v) => v.replace(/[.\s]/g, ''))
  .transform((v) => (v === '' ? null : v))
  .pipe(
    z
      .string()
      .regex(/^\d{6,10}$/, 'HS codes have 6 to 10 digits')
      .nullable(),
  );

export const MAX_VARIANTS_PER_PRODUCT = 250;
export const MAX_IMAGES_PER_PRODUCT = 50;
export const MAX_METAFIELDS_PER_PRODUCT = 30;
export const MAX_BUNDLE_COMPONENTS = 10;

export const metafieldTypeSchema = z.enum([
  'single_line_text',
  'multi_line_text',
  'number_integer',
  'number_decimal',
  'boolean',
  'url',
  'date',
]);
export type MetafieldType = z.infer<typeof metafieldTypeSchema>;

/**
 * Validates a metafield value for its type and returns the canonical string that is stored
 * ("007" -> "7" for integers, "TRUE" -> "true", URLs normalized), or an error message.
 */
export function normalizeMetafieldValue(
  type: MetafieldType,
  raw: string | number | boolean,
): { value: string } | { error: string } {
  const text = String(raw).trim();
  switch (type) {
    case 'single_line_text':
      if (text === '') return { error: 'Enter a value' };
      if (/[\r\n]/.test(text)) return { error: 'Single-line text cannot contain line breaks' };
      if (text.length > 255) return { error: 'Use at most 255 characters' };
      return { value: text };
    case 'multi_line_text':
      if (text === '') return { error: 'Enter a value' };
      if (text.length > 5000) return { error: 'Use at most 5000 characters' };
      return { value: text.replace(/\r\n/g, '\n') };
    case 'number_integer': {
      if (!/^[-+]?\d{1,16}$/.test(text)) return { error: 'Enter a whole number' };
      const n = Number(text);
      if (!Number.isSafeInteger(n)) return { error: 'The number is too large' };
      return { value: String(n) };
    }
    case 'number_decimal': {
      const match = /^([-+]?)(\d{1,15})(?:\.(\d{1,9}))?$/.exec(text);
      if (!match) return { error: 'Enter a number such as 12.5' };
      const [, sign, whole = '0', fraction = ''] = match;
      const decimals = fraction.replace(/0+$/, '');
      const integer = whole.replace(/^0+(?=\d)/, '');
      const value = `${sign === '-' ? '-' : ''}${integer}${decimals ? `.${decimals}` : ''}`;
      return { value: value === '-0' ? '0' : value };
    }
    case 'boolean': {
      const lower = text.toLowerCase();
      if (lower === 'true' || lower === 'false') return { value: lower };
      return { error: 'Use true or false' };
    }
    case 'url': {
      let url: URL;
      try {
        url = new URL(text);
      } catch {
        return { error: 'Enter a full URL starting with https://' };
      }
      if (url.protocol !== 'https:') return { error: 'Only https:// links are allowed' };
      if (url.username || url.password) return { error: 'Links cannot contain credentials' };
      const value = url.toString();
      if (value.length > 2048) return { error: 'The link is too long' };
      return { value };
    }
    case 'date': {
      const valid =
        /^\d{4}-\d{2}-\d{2}$/.test(text) &&
        new Date(`${text}T00:00:00Z`).toISOString().slice(0, 10) === text;
      return valid ? { value: text } : { error: 'Use a date like 2026-12-31' };
    }
  }
}

export const metafieldInputSchema = z
  .strictObject({
    namespace: z
      .string()
      .trim()
      .regex(/^[a-z0-9_]{1,20}$/, 'Use 1-20 lowercase letters, numbers and underscores')
      .default('custom'),
    key: z
      .string()
      .trim()
      .regex(/^[a-z0-9_]{1,40}$/, 'Use 1-40 lowercase letters, numbers and underscores'),
    type: metafieldTypeSchema,
    value: z.union([z.string().max(5000), z.number(), z.boolean()]),
    showOnStorefront: z.boolean().default(false),
  })
  .transform((field, ctx) => {
    const result = normalizeMetafieldValue(field.type, field.value);
    if ('error' in result) {
      ctx.addIssue({ code: 'custom', path: ['value'], message: result.error });
      return z.NEVER;
    }
    return { ...field, value: result.value };
  });
export type MetafieldInput = z.input<typeof metafieldInputSchema>;

export const variantInputSchema = z.strictObject({
  /** Present when updating an existing variant. */
  id: z.uuid().optional(),
  options: z.array(z.string().trim().min(1).max(50)).max(3).default([]),
  sku: optionalText(64),
  barcode: optionalText(64),
  price: moneyMinor,
  compareAtPrice: moneyMinor.nullable().optional(),
  /**
   * Unit cost (admin only). On update, omitting it keeps the stored value and null clears it;
   * countryOfOrigin, hsCode and imageId behave the same way.
   */
  costPerItem: moneyMinor.nullable().optional(),
  weightGrams: z.number().int().min(0).max(1_000_000).default(0),
  requiresShipping: z.boolean().default(true),
  countryOfOrigin: countryCodeSchema.nullable().optional(),
  hsCode: hsCodeSchema.nullable().optional(),
  /** One of this product's images, shown when the variant is selected. */
  imageId: z.uuid().nullable().optional(),
  taxable: z.boolean().default(true),
  trackInventory: z.boolean().default(true),
  allowBackorder: z.boolean().default(false),
  /** Starting stock for new variants; existing stock changes go through inventory adjustments. */
  inventoryQuantity: z.number().int().min(0).max(1_000_000).optional(),
  /**
   * Bundle products only: what one unit of this variant contains. Its stock, tracking and
   * backorder settings are then derived from these variants.
   */
  components: z
    .array(
      z.strictObject({
        variantId: z.uuid(),
        quantity: z.number().int().min(1).max(100).default(1),
      }),
    )
    .max(MAX_BUNDLE_COMPONENTS, `A bundle holds at most ${MAX_BUNDLE_COMPONENTS} items`)
    .refine((items) => new Set(items.map((i) => i.variantId)).size === items.length, {
      message: 'Each item can be in a bundle once',
    })
    .optional(),
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
    /** A bundle (combo) of other variants; every variant then lists its components. */
    isBundle: z.boolean().default(false),
    /** Supplier the product is bought from (null for none; omitted keeps it). */
    supplierId: z.uuid().nullable().optional(),
    /** Shopper inputs. Replaces the product's customizations when present; omitted keeps them. */
    customizations: customizationsInputSchema.optional(),
    options: z
      .array(productOptionInputSchema)
      .max(3)
      .default([])
      .refine((opts) => new Set(opts.map((o) => o.name.toLowerCase())).size === opts.length, {
        message: 'Option names must be unique',
      }),
    variants: z
      .array(variantInputSchema)
      .min(1, 'Add at least one variant')
      .max(MAX_VARIANTS_PER_PRODUCT),
    /**
     * When the product goes live on the storefront (with status ACTIVE). A future time schedules
     * it; null publishes now (clearing a schedule); omitted keeps the current publish time.
     */
    publishAt: z.iso.datetime({ offset: true }).nullable().optional(),
    /** Custom fields. Replaces all of the product's metafields when present; omitted keeps them. */
    metafields: z
      .array(metafieldInputSchema)
      .max(MAX_METAFIELDS_PER_PRODUCT, `Use at most ${MAX_METAFIELDS_PER_PRODUCT} custom fields`)
      .refine(
        (fields) => new Set(fields.map((f) => `${f.namespace}.${f.key}`)).size === fields.length,
        { message: 'Custom field keys must be unique' },
      )
      .optional(),
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
    if (product.isBundle && product.isGiftCard) {
      ctx.addIssue({
        code: 'custom',
        path: ['isBundle'],
        message: 'A gift card cannot be a bundle',
      });
    }
    product.variants.forEach((variant, index) => {
      const count = variant.components?.length ?? 0;
      if (product.isBundle && count === 0) {
        ctx.addIssue({
          code: 'custom',
          path: ['variants', index, 'components'],
          message: 'Add at least one product to this bundle',
        });
      }
      if (!product.isBundle && count > 0) {
        ctx.addIssue({
          code: 'custom',
          path: ['variants', index, 'components'],
          message: 'Only bundles have components',
        });
      }
    });
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

/** A resized WebP copy of an image, for `srcset`. */
export const imageRenditionSchema = z.object({ width: z.number().int(), url: z.string() });
export type ImageRendition = z.infer<typeof imageRenditionSchema>;

export const productImageSchema = z.object({
  id: z.uuid(),
  /** Full-size WebP (at most 5000 px per side). */
  url: z.string(),
  alt: z.string(),
  width: z.number().int(),
  height: z.number().int(),
  position: z.number().int(),
  /** Smaller copies, narrowest first (only widths below the original; empty for old images). */
  renditions: z.array(imageRenditionSchema),
});
export type ProductImage = z.infer<typeof productImageSchema>;

export const productMetafieldSchema = z.object({
  id: z.uuid(),
  namespace: z.string(),
  key: z.string(),
  type: metafieldTypeSchema,
  value: z.string(),
  showOnStorefront: z.boolean(),
});
export type ProductMetafield = z.infer<typeof productMetafieldSchema>;

export const bundleComponentSchema = z.object({
  variantId: z.uuid(),
  productId: z.uuid(),
  productTitle: z.string(),
  variantTitle: z.string(),
  sku: z.string().nullable(),
  /** Units in one bundle. */
  quantity: z.number().int(),
  /** The component's own price, for comparing with the bundle price. */
  price: z.number().int(),
  inventoryQuantity: z.number().int(),
  trackInventory: z.boolean(),
});
export type BundleComponent = z.infer<typeof bundleComponentSchema>;

export const variantSchema = z.object({
  id: z.uuid(),
  title: z.string(),
  options: z.array(z.string()),
  sku: z.string().nullable(),
  barcode: z.string().nullable(),
  price: z.number().int(),
  compareAtPrice: z.number().int().nullable(),
  costPerItem: z.number().int().nullable(),
  /** price - costPerItem (null without a cost). */
  profit: z.number().int().nullable(),
  /** Profit as a percentage of price, one decimal (null without a cost or with a zero price). */
  margin: z.number().nullable(),
  weightGrams: z.number().int(),
  requiresShipping: z.boolean(),
  countryOfOrigin: z.string().nullable(),
  hsCode: z.string().nullable(),
  taxable: z.boolean(),
  trackInventory: z.boolean(),
  allowBackorder: z.boolean(),
  inventoryQuantity: z.number().int(),
  position: z.number().int(),
  imageId: z.uuid().nullable(),
  /** Bundle variants: what one unit contains (empty otherwise). */
  components: z.array(bundleComponentSchema),
});
export type Variant = z.infer<typeof variantSchema>;

export const productOptionSchema = z.object({
  name: z.string(),
  values: z.array(z.string()),
  style: optionStyleSchema,
  swatches: z.array(z.string()),
});
export type ProductOption = z.infer<typeof productOptionSchema>;

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
  isBundle: z.boolean(),
  supplierId: z.uuid().nullable(),
  customizations: z.array(customizationSchema),
  options: z.array(productOptionSchema),
  variants: z.array(variantSchema),
  images: z.array(productImageSchema),
  collectionIds: z.array(z.uuid()),
  metafields: z.array(productMetafieldSchema),
  /** When the product went (or goes) live; null for products never activated. */
  publishedAt: z.iso.datetime().nullable(),
  /** ACTIVE with a future publishedAt: hidden from the storefront until then. */
  scheduled: z.boolean(),
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
  productType: z.string().nullable(),
  tags: z.array(z.string()),
  isBundle: z.boolean(),
  supplierName: z.string().nullable(),
  variantCount: z.number().int(),
  totalInventory: z.number().int(),
  minPrice: z.number().int(),
  maxPrice: z.number().int(),
  imageUrl: z.string().nullable(),
  /** 200 px wide thumbnail when one exists (otherwise the same as imageUrl). */
  thumbnailUrl: z.string().nullable(),
  publishedAt: z.iso.datetime().nullable(),
  scheduled: z.boolean(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type ProductListItem = z.infer<typeof productListItemSchema>;
export const productListSchema = paginated(productListItemSchema);

export const productListSortSchema = z.enum(['updated', 'created', 'title', 'price', 'inventory']);
export type ProductListSort = z.infer<typeof productListSortSchema>;

const blankToUndefined = (v: unknown) => (v === '' ? undefined : v);

export const productListQuerySchema = z.strictObject({
  /** Matches title or vendor (contains), SKU (prefix) or tag (exact), ignoring case. */
  q: z.preprocess(blankToUndefined, z.string().trim().max(100).optional()),
  status: z.preprocess(blankToUndefined, productStatusSchema.optional()),
  vendor: z.preprocess(blankToUndefined, z.string().trim().max(100).optional()),
  productType: z.preprocess(blankToUndefined, z.string().trim().max(100).optional()),
  tag: z.preprocess(blankToUndefined, z.string().trim().toLowerCase().max(40).optional()),
  collectionId: z.preprocess(blankToUndefined, z.uuid().optional()),
  supplierId: z.preprocess(blankToUndefined, z.uuid().optional()),
  sort: productListSortSchema.default('updated'),
  /** Defaults: newest first for updated/created; A-Z or lowest first for the others. */
  direction: z.preprocess(blankToUndefined, z.enum(['asc', 'desc']).optional()),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});
export type ProductListQuery = z.infer<typeof productListQuerySchema>;

/** Distinct values for the admin product list filters (sorted, capped at 500 each). */
export const productFacetsSchema = z.object({
  vendors: z.array(z.string()),
  productTypes: z.array(z.string()),
  tags: z.array(z.string()),
});
export type ProductFacets = z.infer<typeof productFacetsSchema>;

export const updateImageInputSchema = z.strictObject({
  alt: z.string().trim().max(512).optional(),
  /** Moves the image to this 0-based index (the other images shift). */
  position: z
    .number()
    .int()
    .min(0)
    .max(MAX_IMAGES_PER_PRODUCT - 1)
    .optional(),
});

export const reorderImagesInputSchema = z.strictObject({
  /** Every image id of the product, exactly once, in the new order. */
  imageIds: z
    .array(z.uuid())
    .max(MAX_IMAGES_PER_PRODUCT)
    .refine((ids) => new Set(ids).size === ids.length, { message: 'Image ids must be unique' }),
});
export type ReorderImagesInput = z.infer<typeof reorderImagesInputSchema>;

export const importImageInputSchema = z.strictObject({
  url: z
    .string()
    .trim()
    .max(2048)
    .refine((value) => URL.canParse(value) && new URL(value).protocol === 'https:', {
      message: 'Enter an https:// image URL',
    }),
  alt: z.string().trim().max(512).default(''),
});
export type ImportImageInput = z.input<typeof importImageInputSchema>;

export const updateVariantImageInputSchema = z.strictObject({
  /** One of the product's images, or null to clear. */
  imageId: z.uuid().nullable(),
});

export const productBulkActionSchema = z.enum([
  'activate',
  'draft',
  'archive',
  'delete',
  'add_tags',
  'remove_tags',
]);
export type ProductBulkAction = z.infer<typeof productBulkActionSchema>;

export const productBulkInputSchema = z
  .strictObject({
    productIds: z
      .array(z.uuid())
      .min(1)
      .max(100)
      .transform((ids) => [...new Set(ids)]),
    action: productBulkActionSchema,
    tags: z
      .array(z.string().trim().toLowerCase().min(1).max(40))
      .max(50)
      .transform((tags) => [...new Set(tags)])
      .optional(),
  })
  .refine(
    (input) => !['add_tags', 'remove_tags'].includes(input.action) || (input.tags?.length ?? 0) > 0,
    { path: ['tags'], message: 'Choose at least one tag' },
  );
export type ProductBulkInput = z.input<typeof productBulkInputSchema>;

export const productBulkResultSchema = z.object({
  action: productBulkActionSchema,
  /** Number of products changed (or deleted). */
  count: z.number().int(),
});
export type ProductBulkResult = z.infer<typeof productBulkResultSchema>;
