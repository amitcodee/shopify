import { z } from 'zod';

/**
 * First-party store apps: small storefront features a merchant installs and configures. Each app
 * is data only (enabled flag + validated settings); the storefront renders it, so no merchant
 * code ever runs on a store.
 */

const plain = (max: number, fallback: string) => z.string().trim().max(max).default(fallback);

export const storeAppsSchema = z.strictObject({
  whatsapp: z
    .strictObject({
      enabled: z.boolean().default(false),
      /** International number, digits only (wa.me format), e.g. 919876543210. */
      phone: z
        .string()
        .trim()
        .regex(/^$|^\d{8,15}$/, 'Use the full number with country code, digits only')
        .default(''),
      message: plain(160, 'Hi! I have a question about your store.'),
    })
    .default({ enabled: false, phone: '', message: 'Hi! I have a question about your store.' }),
  freeShippingBar: z
    .strictObject({
      enabled: z.boolean().default(false),
      /** Cart subtotal (minor units, store currency) that unlocks free shipping. */
      threshold: z.number().int().min(1).max(100_000_000).default(5000),
      message: plain(80, 'You’re {amount} away from free shipping'),
      successMessage: plain(80, 'You’ve unlocked free shipping!'),
    })
    .default({
      enabled: false,
      threshold: 5000,
      message: 'You’re {amount} away from free shipping',
      successMessage: 'You’ve unlocked free shipping!',
    }),
  productBadges: z
    .strictObject({
      enabled: z.boolean().default(false),
      /** "New" for products published within this many days. */
      newDays: z.number().int().min(1).max(90).default(14),
    })
    .default({ enabled: false, newDays: 14 }),
  shareButtons: z.strictObject({ enabled: z.boolean().default(false) }).default({ enabled: false }),
  cookieNotice: z
    .strictObject({
      enabled: z.boolean().default(false),
      message: plain(
        200,
        'We use essential cookies to run this store, like remembering your cart.',
      ),
    })
    .default({
      enabled: false,
      message: 'We use essential cookies to run this store, like remembering your cart.',
    }),
});
export type StoreApps = z.output<typeof storeAppsSchema>;
export type StoreAppId = keyof StoreApps;

/** Parses stored apps JSON; anything invalid falls back to defaults (all off). */
export function parseStoreApps(value: unknown): StoreApps {
  const parsed = storeAppsSchema.safeParse(value ?? {});
  return parsed.success ? parsed.data : storeAppsSchema.parse({});
}

export const STORE_APP_CATALOG: {
  id: StoreAppId;
  name: string;
  tagline: string;
  description: string;
  category: 'Conversion' | 'Customer support' | 'Social' | 'Compliance';
}[] = [
  {
    id: 'freeShippingBar',
    name: 'Free shipping bar',
    tagline: 'Show shoppers how close they are to free shipping',
    description:
      'A progress bar in the cart that counts down to your free-shipping amount and celebrates when it is reached.',
    category: 'Conversion',
  },
  {
    id: 'productBadges',
    name: 'New arrival badges',
    tagline: 'A “New” label on recently added products',
    description:
      'Adds a “New” badge to product cards for products published in the last few days (Sale badges are always shown).',
    category: 'Conversion',
  },
  {
    id: 'whatsapp',
    name: 'WhatsApp chat',
    tagline: 'A chat button that opens WhatsApp',
    description:
      'A floating button on every page that opens a WhatsApp chat with your number and a ready-written first message.',
    category: 'Customer support',
  },
  {
    id: 'shareButtons',
    name: 'Share buttons',
    tagline: 'Let shoppers share products',
    description:
      'Share links for WhatsApp, X, Facebook and Pinterest on product pages, plus copy-link.',
    category: 'Social',
  },
  {
    id: 'cookieNotice',
    name: 'Cookie notice',
    tagline: 'A short notice about the cookies your store uses',
    description:
      'A small dismissible notice for shoppers. Your store only sets essential cookies, so it informs rather than asks for consent.',
    category: 'Compliance',
  },
];
