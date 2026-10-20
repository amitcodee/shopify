import { z } from 'zod';

// ── Theme ───────────────────────────────────────────────────────────────────────

export const THEME_PRESETS = ['minimal', 'bold', 'classic'] as const;
export const THEME_FONTS = ['system', 'serif', 'rounded'] as const;

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Use a hex color like #1f2937');

/**
 * Merchant theme customization. Deliberately data-only (validated colors, enums, short plain
 * text): merchants cannot inject HTML, CSS or script into storefronts.
 */
export const themeSettingsSchema = z.strictObject({
  brandColor: hexColor.default('#111827'),
  accentColor: hexColor.default('#4f46e5'),
  font: z.enum(THEME_FONTS).default('system'),
  heroTitle: z.string().trim().max(80).default(''),
  heroSubtitle: z.string().trim().max(200).default(''),
  announcement: z.string().trim().max(120).default(''),
});
export type ThemeSettings = z.output<typeof themeSettingsSchema>;

export const themeInputSchema = z.strictObject({
  preset: z.enum(THEME_PRESETS),
  settings: themeSettingsSchema,
});
export type ThemeInput = z.input<typeof themeInputSchema>;
export type Theme = z.output<typeof themeInputSchema>;

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
