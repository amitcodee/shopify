import { z } from 'zod';
import { emailSchema, paginated } from './common.js';

/** Code alphabet without look-alikes (0/O, 1/I/L). */
export const GIFT_CARD_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

/** "abcd efgh-jkmn" -> "ABCDEFGHJKMN": what shoppers type is compared without spaces or dashes. */
export function normalizeGiftCardCode(input: string): string {
  return input.toUpperCase().replace(/[\s-]/g, '');
}

/** "ABCDEFGHJKMNPQRS" -> "ABCD-EFGH-JKMN-PQRS". */
export function formatGiftCardCode(code: string): string {
  return normalizeGiftCardCode(code).replace(/(.{4})(?=.)/g, '$1-');
}

const amountSchema = z.number().int().min(1).max(100_000_000);

export const giftCardIssueInputSchema = z.strictObject({
  initialValue: amountSchema,
  /** Custom code (8–20 letters/digits); a random 16-character code is generated otherwise. */
  code: z
    .string()
    .transform(normalizeGiftCardCode)
    .pipe(z.string().regex(/^[A-Z0-9]{8,20}$/, 'Use 8–20 letters and digits'))
    .optional(),
  expiresOn: z.iso.date().optional(),
  customerEmail: emailSchema.optional(),
  /** Email the code to customerEmail. */
  notifyCustomer: z.boolean().default(false),
  note: z.string().trim().max(500).optional(),
});
export type GiftCardIssueInput = z.input<typeof giftCardIssueInputSchema>;

export const giftCardUpdateInputSchema = z.strictObject({
  note: z.string().trim().max(500).nullable().optional(),
  expiresOn: z.iso.date().nullable().optional(),
  disabled: z.boolean().optional(),
});

export const giftCardAdjustInputSchema = z.strictObject({
  /** Signed change in minor units. */
  amount: z
    .number()
    .int()
    .min(-100_000_000)
    .max(100_000_000)
    .refine((v) => v !== 0, {
      message: 'Enter a non-zero amount',
    }),
  note: z.string().trim().min(1, 'Say why the balance changes').max(500),
});

export const giftCardStatusSchema = z.enum(['active', 'spent', 'expired', 'disabled']);
export type GiftCardStatus = z.infer<typeof giftCardStatusSchema>;

export const giftCardSchema = z.object({
  id: z.uuid(),
  lastCharacters: z.string(),
  initialValue: z.number().int(),
  balance: z.number().int(),
  currency: z.string(),
  status: giftCardStatusSchema,
  customerEmail: z.string().nullable(),
  note: z.string().nullable(),
  expiresOn: z.iso.date().nullable(),
  createdAt: z.iso.datetime(),
});
export type GiftCard = z.infer<typeof giftCardSchema>;
export const giftCardListSchema = paginated(giftCardSchema);

/** Returned once, when the card is issued: the only time the full code is shown. */
export const issuedGiftCardSchema = giftCardSchema.extend({ code: z.string() });
export type IssuedGiftCard = z.infer<typeof issuedGiftCardSchema>;

export const giftCardTransactionSchema = z.object({
  id: z.uuid(),
  kind: z.enum(['ISSUED', 'REDEEMED', 'RESTORED', 'REFUNDED', 'ADJUSTED']),
  amount: z.number().int(),
  balanceAfter: z.number().int(),
  order: z.object({ id: z.uuid(), number: z.number().int() }).nullable(),
  note: z.string().nullable(),
  createdAt: z.iso.datetime(),
});
export type GiftCardTransaction = z.infer<typeof giftCardTransactionSchema>;

export const giftCardDetailSchema = giftCardSchema.extend({
  transactions: z.array(giftCardTransactionSchema),
});
export type GiftCardDetail = z.infer<typeof giftCardDetailSchema>;

export const giftCardListQuerySchema = z.strictObject({
  /** Last characters of the code, or the customer email. */
  q: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});
export type GiftCardListQuery = z.infer<typeof giftCardListQuerySchema>;

/** A shopper-entered code at checkout (normalized; length-limited before any lookup). */
export const giftCardCodeInputSchema = z
  .string()
  .max(40)
  .transform(normalizeGiftCardCode)
  .pipe(z.string().max(20));
