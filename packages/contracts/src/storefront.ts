import { z } from 'zod';
import { themeInputSchema } from './settings.js';
import { policyKindSchema, resolvedLinkSchema } from './online-store.js';

/** Headers the storefront server uses to tell the API which host (store) a request is for. */
export const STOREFRONT_HEADERS = {
  host: 'x-storefront-host',
  timestamp: 'x-storefront-ts',
  signature: 'x-storefront-signature',
  cart: 'x-cart-token',
  customer: 'x-customer-token',
  /** Proof the visitor entered a password-protected store's password. */
  access: 'x-storefront-access',
  /** Presentment currency the shopper chose (ignored unless the store enabled it). */
  currency: 'x-storefront-currency',
} as const;

/** Canonical string signed with HMAC-SHA256: `${host}\n${timestamp}`. */
export function storefrontSignaturePayload(host: string, timestamp: string): string {
  return `${host.toLowerCase()}\n${timestamp}`;
}

export const shopSchema = z.object({
  name: z.string(),
  subdomain: z.string(),
  currency: z.string(),
  contactEmail: z.string(),
  collections: z.array(z.object({ title: z.string(), handle: z.string() })),
  theme: themeInputSchema,
  /** Header and footer navigation, already resolved to hrefs. */
  menus: z.object({ main: z.array(resolvedLinkSchema), footer: z.array(resolvedLinkSchema) }),
  /** Policies the store has published (linked from the footer and checkout). */
  policies: z.array(z.object({ kind: policyKindSchema, title: z.string() })),
  /** True when the store is password protected and this visitor has not entered it. */
  locked: z.boolean(),
  passwordMessage: z.string(),
  /** The store's own currency (`currency` is what this shopper sees and pays in). */
  baseCurrency: z.string(),
  /** Currencies the shopper can switch between (store currency first). */
  currencies: z.array(z.string()),
});
export type Shop = z.infer<typeof shopSchema>;

export const productCardSchema = z.object({
  id: z.uuid(),
  title: z.string(),
  handle: z.string(),
  minPrice: z.number().int(),
  maxPrice: z.number().int(),
  compareAtPrice: z.number().int().nullable(),
  available: z.boolean(),
  imageUrl: z.string().nullable(),
  imageAlt: z.string(),
});
export type ProductCard = z.infer<typeof productCardSchema>;

export const productSortSchema = z.enum(['newest', 'price-asc', 'price-desc', 'title']);
export type ProductSort = z.infer<typeof productSortSchema>;

export const storefrontProductQuerySchema = z.strictObject({
  q: z.string().trim().max(100).optional(),
  collection: z.string().max(120).optional(),
  sort: productSortSchema.default('newest'),
  page: z.coerce.number().int().min(1).max(1000).default(1),
  pageSize: z.coerce.number().int().min(1).max(48).default(24),
});
export type StorefrontProductQuery = z.infer<typeof storefrontProductQuerySchema>;

export const productCardPageSchema = z.object({
  items: z.array(productCardSchema),
  page: z.number().int(),
  pageSize: z.number().int(),
  total: z.number().int(),
});
export type ProductCardPage = z.infer<typeof productCardPageSchema>;

export const storefrontVariantSchema = z.object({
  id: z.uuid(),
  title: z.string(),
  options: z.array(z.string()),
  price: z.number().int(),
  compareAtPrice: z.number().int().nullable(),
  available: z.boolean(),
  sku: z.string().nullable(),
});
export type StorefrontVariant = z.infer<typeof storefrontVariantSchema>;

export const storefrontProductSchema = z.object({
  id: z.uuid(),
  title: z.string(),
  handle: z.string(),
  description: z.string(),
  vendor: z.string().nullable(),
  productType: z.string().nullable(),
  tags: z.array(z.string()),
  seoTitle: z.string().nullable(),
  seoDescription: z.string().nullable(),
  isGiftCard: z.boolean(),
  options: z.array(z.object({ name: z.string(), values: z.array(z.string()) })),
  variants: z.array(storefrontVariantSchema),
  images: z.array(
    z.object({ url: z.string(), alt: z.string(), width: z.number(), height: z.number() }),
  ),
});
export type StorefrontProduct = z.infer<typeof storefrontProductSchema>;

export const storefrontCollectionSchema = z.object({
  title: z.string(),
  handle: z.string(),
  description: z.string(),
});
export type StorefrontCollection = z.infer<typeof storefrontCollectionSchema>;

export const addToCartInputSchema = z.strictObject({
  variantId: z.uuid(),
  quantity: z.number().int().min(1).max(99).default(1),
});

export const updateCartLineInputSchema = z.strictObject({
  quantity: z.number().int().min(0).max(99),
});

export const cartLineSchema = z.object({
  id: z.uuid(),
  variantId: z.uuid(),
  productTitle: z.string(),
  productHandle: z.string(),
  variantTitle: z.string(),
  imageUrl: z.string().nullable(),
  unitPrice: z.number().int(),
  quantity: z.number().int(),
  lineTotal: z.number().int(),
  available: z.boolean(),
  /** Largest quantity that can be ordered right now (null = unlimited). */
  maxQuantity: z.number().int().nullable(),
});
export type CartLine = z.infer<typeof cartLineSchema>;

export const cartSchema = z.object({
  id: z.uuid(),
  currency: z.string(),
  lines: z.array(cartLineSchema),
  itemCount: z.number().int(),
  subtotal: z.number().int(),
  /** Human-readable notices, e.g. items that went out of stock. */
  warnings: z.array(z.string()),
});
export type Cart = z.infer<typeof cartSchema>;

export const createdCartSchema = z.object({ token: z.string(), cart: cartSchema });
export type CreatedCart = z.infer<typeof createdCartSchema>;

const sitemapEntrySchema = z.object({ handle: z.string(), updatedAt: z.iso.datetime() });
/** Published, linkable content for sitemap.xml. */
export const storefrontSitemapSchema = z.object({
  products: z.array(sitemapEntrySchema),
  collections: z.array(sitemapEntrySchema),
  pages: z.array(sitemapEntrySchema),
  posts: z.array(sitemapEntrySchema),
  policies: z.array(z.string()),
});
export type StorefrontSitemap = z.infer<typeof storefrontSitemapSchema>;

export const storefrontPasswordInputSchema = z.strictObject({
  password: z.string().min(1).max(100),
});
