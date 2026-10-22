import { z } from 'zod';
import { currencyCodeSchema } from './common.js';
import { currencyDigits } from './money.js';

/** How converted product prices are rounded (up): exact, whole units, or charm prices (x.99). */
export const CURRENCY_ROUNDINGS = ['EXACT', 'WHOLE', 'NINETY_NINE'] as const;
export const currencyRoundingSchema = z.enum(CURRENCY_ROUNDINGS);
export type CurrencyRounding = z.infer<typeof currencyRoundingSchema>;

/** A presentment currency: shoppers can browse and pay in it at the merchant's rate. */
export const presentmentCurrencySchema = z.strictObject({
  currency: currencyCodeSchema,
  /** Units of this currency per 1 unit of the store currency (e.g. 0.92 EUR per USD). */
  rate: z.number().positive().max(1_000_000),
  rounding: currencyRoundingSchema.default('EXACT'),
});
export type PresentmentCurrency = z.infer<typeof presentmentCurrencySchema>;

export const presentmentCurrenciesInputSchema = z.strictObject({
  currencies: z
    .array(presentmentCurrencySchema)
    .max(20)
    .refine((list) => new Set(list.map((c) => c.currency)).size === list.length, {
      message: 'Each currency once',
    }),
});

/** Presentment minor units per store minor unit (what an order records as its exchange rate). */
export function minorUnitFactor(base: string, target: string, rate: number): number {
  return (rate * 10 ** currencyDigits(target)) / 10 ** currencyDigits(base);
}

/** Converts an amount exactly (half up), e.g. shipping rates and fixed discounts. */
export function convertAmount(
  amountMinor: number,
  base: string,
  target: string,
  rate: number,
): number {
  return Math.round(amountMinor * minorUnitFactor(base, target, rate));
}

/** Converts a product price and applies the currency's rounding rule (always rounding up). */
export function convertPrice(
  amountMinor: number,
  base: string,
  target: string,
  rate: number,
  rounding: CurrencyRounding,
): number {
  const exact = convertAmount(amountMinor, base, target, rate);
  if (rounding === 'EXACT' || exact === 0) return exact;
  const unit = 10 ** currencyDigits(target);
  const whole = Math.ceil(exact / unit) * unit;
  // x.99 needs minor units; for currencies without them (JPY) it is the whole price.
  return rounding === 'NINETY_NINE' && unit > 1 ? whole - 1 : whole;
}
