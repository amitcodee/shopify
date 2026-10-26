import { z } from 'zod';

// ── Theme ───────────────────────────────────────────────────────────────────────

/** Homepage layouts (the hero and what follows it). */
export const THEME_PRESETS = [
  'minimal',
  'bold',
  'classic',
  'split',
  'fullbleed',
  'editorial',
  'catalog',
  'banner',
] as const;
/** System font stacks only: no third-party font requests from storefronts. */
export const THEME_FONTS = [
  'system',
  'serif',
  'rounded',
  'mono',
  'slab',
  'humanist',
  'geometric',
  'condensed',
] as const;
export const THEME_RADII = ['none', 'small', 'medium', 'large', 'pill'] as const;
export const THEME_BUTTON_STYLES = ['solid', 'outline', 'soft'] as const;
export const THEME_HEADER_STYLES = ['inline', 'centered', 'stacked'] as const;
export const THEME_CARD_STYLES = ['plain', 'bordered', 'shadow', 'overlay', 'framed'] as const;
export const THEME_IMAGE_RATIOS = ['square', 'portrait', 'landscape'] as const;
export const THEME_DENSITIES = ['compact', 'comfortable', 'spacious'] as const;
export const THEME_FOOTER_STYLES = ['simple', 'columns', 'dark'] as const;
export const THEME_HEADING_CASES = ['normal', 'uppercase'] as const;

/** Social profile links: https only, so nothing like `javascript:` can reach an href. */
const socialUrl = z
  .string()
  .trim()
  .max(200)
  .refine((v) => v === '' || /^https:\/\/[^\s/]+\.[^\s]+$/i.test(v), 'Use a full https:// link')
  .default('');

export const THEME_CART_STYLES = ['drawer', 'page'] as const;

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Use a hex color like #1f2937');

/** Homepage sections the merchant can reorder and hide (the hero always comes first). */
export const HOME_SECTIONS = [
  'trustBar',
  'collections',
  'featuredProducts',
  'carousels',
  'brandStory',
  'blogPosts',
  'newsletter',
] as const;
export type HomeSection = (typeof HOME_SECTIONS)[number];

/**
 * Section order: each known section exactly once. Unknown ids are dropped and missing ones are
 * appended in default order, so an order saved before a section existed still works.
 */
const sectionOrder = z
  .array(z.string())
  .max(20)
  .transform((ids): HomeSection[] => {
    const known = ids.filter(
      (id, i): id is HomeSection =>
        (HOME_SECTIONS as readonly string[]).includes(id) && ids.indexOf(id) === i,
    );
    return [...known, ...HOME_SECTIONS.filter((id) => !known.includes(id))];
  })
  .default([...HOME_SECTIONS]);

/**
 * Merchant theme customization. Deliberately data-only (validated colors, enums, short plain
 * text): merchants cannot inject HTML, CSS or script into storefronts. Every field has a
 * default so themes saved before a field existed still parse.
 */
export const themeSettingsSchema = z.strictObject({
  /** Template the design came from (informational; see THEME_TEMPLATES). */
  template: z.string().trim().max(60).default(''),
  brandColor: hexColor.default('#111827'),
  accentColor: hexColor.default('#4f46e5'),
  backgroundColor: hexColor.default('#ffffff'),
  /** Hero panels, cards and other raised areas. */
  surfaceColor: hexColor.default('#f4f4f5'),
  textColor: hexColor.default('#18181b'),
  font: z.enum(THEME_FONTS).default('system'),
  headingFont: z.enum(THEME_FONTS).default('system'),
  headingCase: z.enum(THEME_HEADING_CASES).default('normal'),
  radius: z.enum(THEME_RADII).default('medium'),
  buttonStyle: z.enum(THEME_BUTTON_STYLES).default('solid'),
  headerStyle: z.enum(THEME_HEADER_STYLES).default('inline'),
  cardStyle: z.enum(THEME_CARD_STYLES).default('plain'),
  imageRatio: z.enum(THEME_IMAGE_RATIOS).default('square'),
  /** Product columns on wide screens. */
  gridColumns: z.number().int().min(2).max(5).default(4),
  density: z.enum(THEME_DENSITIES).default('comfortable'),
  footerStyle: z.enum(THEME_FOOTER_STYLES).default('simple'),
  showCollections: z.boolean().default(true),
  heroTitle: z.string().trim().max(80).default(''),
  heroSubtitle: z.string().trim().max(200).default(''),
  heroCta: z.string().trim().max(30).default(''),
  featuredTitle: z.string().trim().max(40).default(''),
  announcement: z.string().trim().max(120).default(''),
  /** Header stays visible while scrolling. */
  stickyHeader: z.boolean().default(true),
  /** Adding to cart opens a slide-out cart (drawer) or shows a link to the cart page. */
  cartStyle: z.enum(THEME_CART_STYLES).default('drawer'),
  // Homepage sections after the hero, in `sectionOrder`.
  sectionOrder,
  /** The latest-products grid. */
  showFeatured: z.boolean().default(true),
  showTrustBar: z.boolean().default(true),
  trustItem1: z.string().trim().max(40).default('Secure checkout'),
  trustItem2: z.string().trim().max(40).default('Order tracking'),
  trustItem3: z.string().trim().max(40).default('Friendly support'),
  /** One product row per collection (up to three collections). */
  showCollectionCarousels: z.boolean().default(true),
  showBrandStory: z.boolean().default(false),
  brandStoryTitle: z.string().trim().max(80).default(''),
  brandStoryText: z.string().trim().max(600).default(''),
  showBlogPosts: z.boolean().default(true),
  showNewsletter: z.boolean().default(true),
  newsletterTitle: z.string().trim().max(80).default(''),
  newsletterText: z.string().trim().max(200).default(''),
  socialInstagram: socialUrl,
  socialFacebook: socialUrl,
  socialX: socialUrl,
  socialYoutube: socialUrl,
  socialTiktok: socialUrl,
});
export type ThemeSettings = z.output<typeof themeSettingsSchema>;
export type ThemeSettingsInput = z.input<typeof themeSettingsSchema>;

export const themeInputSchema = z.strictObject({
  preset: z.enum(THEME_PRESETS),
  settings: themeSettingsSchema,
});
export type ThemeInput = z.input<typeof themeInputSchema>;
export type Theme = z.output<typeof themeInputSchema>;
export type ThemePreset = (typeof THEME_PRESETS)[number];
export type ThemeFont = (typeof THEME_FONTS)[number];

/** CSS stacks for THEME_FONTS. System fonts only: storefronts never request third-party fonts. */
export const THEME_FONT_STACKS: Record<ThemeFont, string> = {
  system: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  serif: '"Iowan Old Style", "Palatino Linotype", Palatino, Georgia, Cambria, serif',
  rounded: 'ui-rounded, "SF Pro Rounded", "Nunito", "Varela Round", system-ui, sans-serif',
  mono: 'ui-monospace, "SF Mono", "Cascadia Code", "Roboto Mono", Menlo, Consolas, monospace',
  slab: '"Rockwell", "Roboto Slab", "Courier New", Georgia, serif',
  humanist:
    'Seravek, "Gill Sans Nova", Ubuntu, Calibri, "DejaVu Sans", source-sans-pro, sans-serif',
  geometric: 'Avenir, "Avenir Next", Montserrat, Futura, "Century Gothic", system-ui, sans-serif',
  condensed:
    '"Bahnschrift SemiCondensed", "Arial Narrow", "Roboto Condensed", "Helvetica Neue", sans-serif-condensed, sans-serif',
};

/** Parses stored theme JSON, falling back to defaults for anything invalid. */
export function parseTheme(preset: string, settings: unknown): Theme {
  const parsedPreset = z.enum(THEME_PRESETS).safeParse(preset);
  const parsedSettings = themeSettingsSchema.safeParse(settings ?? {});
  return {
    preset: parsedPreset.success ? parsedPreset.data : 'minimal',
    settings: parsedSettings.success ? parsedSettings.data : themeSettingsSchema.parse({}),
  };
}

/** Black or white text, whichever reads better on `hex` (WCAG relative luminance). */
export function contrastingText(hex: string): '#000000' | '#ffffff' {
  const channel = (i: number) => {
    const c = parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const luminance = 0.2126 * channel(0) + 0.7152 * channel(1) + 0.0722 * channel(2);
  return luminance > 0.179 ? '#000000' : '#ffffff';
}

// ── Domains ─────────────────────────────────────────────────────────────────────

export const hostnameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(253)
  .regex(
    /^(?=.{1,253}$)(?!-)([a-z0-9-]{1,63}(?<!-)\.)+[a-z]{2,63}$/,
    'Enter a domain like shop.example.com',
  );

export const addDomainInputSchema = z.strictObject({ hostname: hostnameSchema });

export const domainSchema = z.object({
  id: z.uuid(),
  hostname: z.string(),
  verified: z.boolean(),
  isPrimary: z.boolean(),
  /** DNS records the merchant must publish. */
  verificationRecord: z.object({ type: z.literal('TXT'), name: z.string(), value: z.string() }),
  routingRecord: z.object({ type: z.literal('CNAME'), name: z.string(), value: z.string() }),
  createdAt: z.iso.datetime(),
});
export type Domain = z.infer<typeof domainSchema>;

// ── Shipping & taxes ───────────────────────────────────────────────────────────

const countryCode = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^([A-Z]{2}|\*)$/, 'Use 2-letter country codes, or * for rest of world');

const optionalInt = z.number().int().min(0).max(100_000_000).nullable().optional();

export const shippingZoneInputSchema = z.strictObject({
  name: z.string().trim().min(1).max(100),
  countries: z
    .array(countryCode)
    .min(1)
    .max(250)
    .transform((c) => [...new Set(c)]),
});

export const shippingRateInputSchema = z
  .strictObject({
    name: z.string().trim().min(1).max(100),
    price: z.number().int().min(0).max(100_000_000),
    minSubtotal: optionalInt,
    maxSubtotal: optionalInt,
    minWeightGrams: optionalInt,
    maxWeightGrams: optionalInt,
  })
  .refine((r) => r.minSubtotal == null || r.maxSubtotal == null || r.minSubtotal <= r.maxSubtotal, {
    message: 'Minimum subtotal must not exceed maximum',
    path: ['maxSubtotal'],
  })
  .refine(
    (r) =>
      r.minWeightGrams == null || r.maxWeightGrams == null || r.minWeightGrams <= r.maxWeightGrams,
    { message: 'Minimum weight must not exceed maximum', path: ['maxWeightGrams'] },
  );

export const shippingRateSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  price: z.number().int(),
  minSubtotal: z.number().int().nullable(),
  maxSubtotal: z.number().int().nullable(),
  minWeightGrams: z.number().int().nullable(),
  maxWeightGrams: z.number().int().nullable(),
});

export const shippingZoneSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  countries: z.array(z.string()),
  rates: z.array(shippingRateSchema),
});
export type ShippingZone = z.infer<typeof shippingZoneSchema>;

export const taxRateInputSchema = z.strictObject({
  country: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2}$/, 'Use a 2-letter country code'),
  region: z.string().trim().toUpperCase().max(100).default(''),
  name: z.string().trim().min(1).max(100),
  rateBps: z.number().int().min(0).max(10_000),
  appliesToShipping: z.boolean().default(false),
});

export const taxRateSchema = z.object({
  id: z.uuid(),
  country: z.string(),
  region: z.string(),
  name: z.string(),
  rateBps: z.number().int(),
  appliesToShipping: z.boolean(),
});
export type TaxRate = z.infer<typeof taxRateSchema>;

// ── Discounts ──────────────────────────────────────────────────────────────────

export const discountTypeSchema = z.enum(['PERCENTAGE', 'FIXED_AMOUNT', 'FREE_SHIPPING']);

export const discountInputSchema = z
  .strictObject({
    code: z
      .string()
      .trim()
      .toUpperCase()
      .min(3)
      .max(40)
      .regex(/^[A-Z0-9_-]+$/, 'Use letters, numbers, - and _'),
    type: discountTypeSchema,
    value: z.number().int().min(0).max(100_000_000),
    minSubtotal: optionalInt,
    usageLimit: z.number().int().min(1).max(1_000_000).nullable().optional(),
    startsAt: z.iso.datetime().nullable().optional(),
    endsAt: z.iso.datetime().nullable().optional(),
    active: z.boolean().default(true),
  })
  .refine((d) => d.type !== 'PERCENTAGE' || (d.value >= 1 && d.value <= 100), {
    message: 'Percentage must be between 1 and 100',
    path: ['value'],
  })
  .refine((d) => d.type !== 'FIXED_AMOUNT' || d.value >= 1, {
    message: 'Enter an amount',
    path: ['value'],
  })
  .refine((d) => !d.startsAt || !d.endsAt || d.startsAt < d.endsAt, {
    message: 'End date must be after the start date',
    path: ['endsAt'],
  });
export type DiscountInput = z.input<typeof discountInputSchema>;

export const discountSchema = z.object({
  id: z.uuid(),
  code: z.string(),
  type: discountTypeSchema,
  value: z.number().int(),
  minSubtotal: z.number().int().nullable(),
  usageLimit: z.number().int().nullable(),
  usedCount: z.number().int(),
  startsAt: z.iso.datetime().nullable(),
  endsAt: z.iso.datetime().nullable(),
  active: z.boolean(),
  createdAt: z.iso.datetime(),
});
export type Discount = z.infer<typeof discountSchema>;
