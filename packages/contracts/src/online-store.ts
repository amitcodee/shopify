import { z } from 'zod';
import { handleSchema } from './products.js';

/** Plain text: paragraphs are separated by blank lines. No merchant HTML is ever rendered. */
const bodySchema = z.string().max(50_000);

export const pageInputSchema = z.strictObject({
  title: z.string().trim().min(1, 'Enter a title').max(200),
  handle: handleSchema.optional(),
  body: bodySchema.default(''),
  published: z.boolean().default(true),
});
export type PageInput = z.input<typeof pageInputSchema>;

export const pageSchema = z.object({
  id: z.uuid(),
  title: z.string(),
  handle: z.string(),
  body: z.string(),
  published: z.boolean(),
  updatedAt: z.iso.datetime(),
});
export type Page = z.infer<typeof pageSchema>;

export const POLICY_KINDS = ['refund', 'privacy', 'terms', 'shipping', 'contact'] as const;
export const policyKindSchema = z.enum(POLICY_KINDS);
export type PolicyKind = z.infer<typeof policyKindSchema>;

export const POLICY_TITLES: Record<PolicyKind, string> = {
  refund: 'Refund policy',
  privacy: 'Privacy policy',
  terms: 'Terms of service',
  shipping: 'Shipping policy',
  contact: 'Contact information',
};

/** An empty body removes the policy from the storefront. */
export const policyInputSchema = z.strictObject({ body: bodySchema.trim() });

export const policySchema = z.object({
  kind: policyKindSchema,
  title: z.string(),
  body: z.string(),
  updatedAt: z.iso.datetime().nullable(),
});
export type Policy = z.infer<typeof policySchema>;

export const MENU_HANDLES = ['main', 'footer'] as const;
export const menuHandleSchema = z.enum(MENU_HANDLES);
export type MenuHandle = z.infer<typeof menuHandleSchema>;

/** A same-site path ("/pages/about", not "//evil.example") or an absolute http(s) URL. */
const menuUrlSchema = z
  .string()
  .trim()
  .max(500)
  .refine(
    (value) =>
      /^\/(?![/\\])[^\s]*$/.test(value) || z.url({ protocol: /^https?$/ }).safeParse(value).success,
    'Use a path starting with / or an http(s) URL',
  );

export const menuLinkSchema = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('home') }),
  z.strictObject({ type: z.literal('catalog') }),
  z.strictObject({ type: z.literal('search') }),
  z.strictObject({ type: z.literal('blog') }),
  z.strictObject({ type: z.literal('collection'), handle: handleSchema }),
  z.strictObject({ type: z.literal('product'), handle: handleSchema }),
  z.strictObject({ type: z.literal('page'), handle: handleSchema }),
  z.strictObject({ type: z.literal('policy'), kind: policyKindSchema }),
  z.strictObject({ type: z.literal('url'), url: menuUrlSchema }),
]);
export type MenuLink = z.infer<typeof menuLinkSchema>;

export const menuItemSchema = z.strictObject({
  title: z.string().trim().min(1, 'Enter a label').max(60),
  link: menuLinkSchema,
});
export type MenuItem = z.infer<typeof menuItemSchema>;

export const menuInputSchema = z.strictObject({
  items: z.array(menuItemSchema).max(20),
});
export type MenuInput = z.input<typeof menuInputSchema>;

export const menuSchema = z.object({
  handle: menuHandleSchema,
  items: z.array(menuItemSchema),
  /** False until the merchant saves the menu; storefronts then use a default. */
  customized: z.boolean(),
});
export type Menu = z.infer<typeof menuSchema>;

/** A menu link resolved for the storefront; links to missing or hidden targets are dropped. */
export const resolvedLinkSchema = z.object({
  title: z.string(),
  href: z.string(),
  external: z.boolean(),
});
export type ResolvedLink = z.infer<typeof resolvedLinkSchema>;

export const storefrontPageSchema = z.object({
  title: z.string(),
  handle: z.string(),
  body: z.string(),
});
export type StorefrontPage = z.infer<typeof storefrontPageSchema>;

/** Splits a plain-text body into paragraphs (blank-line separated). */
export function paragraphs(body: string): string[] {
  return body
    .replace(/\r\n?/g, '\n')
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

/** Pre-launch password page settings. */
export const storefrontAccessSchema = z.object({
  enabled: z.boolean(),
  password: z.string().nullable(),
  message: z.string(),
});
export type StorefrontAccess = z.infer<typeof storefrontAccessSchema>;

/** Omit `password` to keep the current one. */
export const storefrontAccessInputSchema = z.strictObject({
  enabled: z.boolean(),
  password: z.string().trim().min(4, 'Use at least 4 characters').max(100).optional(),
  message: z.string().trim().max(500).default(''),
});

export const blogPostInputSchema = z.strictObject({
  title: z.string().trim().min(1, 'Enter a title').max(200),
  handle: handleSchema.optional(),
  excerpt: z.string().trim().max(500).default(''),
  body: bodySchema.default(''),
  author: z.string().trim().max(100).default(''),
  tags: z
    .array(z.string().trim().toLowerCase().min(1).max(40))
    .max(20)
    .default([])
    .transform((t) => [...new Set(t)]),
  /** Publish now, schedule (a future time), or keep as a draft (null). */
  publishedAt: z.iso.datetime().nullable().default(null),
});
export type BlogPostInput = z.input<typeof blogPostInputSchema>;

export const blogPostSchema = z.object({
  id: z.uuid(),
  title: z.string(),
  handle: z.string(),
  excerpt: z.string(),
  body: z.string(),
  author: z.string(),
  tags: z.array(z.string()),
  publishedAt: z.iso.datetime().nullable(),
  status: z.enum(['draft', 'scheduled', 'published']),
  updatedAt: z.iso.datetime(),
});
export type BlogPost = z.infer<typeof blogPostSchema>;

export const storefrontBlogPostSchema = blogPostSchema
  .omit({ id: true, updatedAt: true, status: true })
  .extend({
    publishedAt: z.iso.datetime(),
  });
export type StorefrontBlogPost = z.infer<typeof storefrontBlogPostSchema>;

export const blogListQuerySchema = z.strictObject({
  tag: z.string().trim().toLowerCase().max(40).optional(),
  page: z.coerce.number().int().min(1).max(1000).default(1),
});
