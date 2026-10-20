/** Number of minor-unit digits for a currency (2 for USD, 0 for JPY), per Intl data. */
export function currencyDigits(currency: string): number {
  return (
    new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions()
      .maximumFractionDigits ?? 2
  );
}

/** Formats an integer amount in minor units, e.g. 1999 USD -> "$19.99". */
export function formatMoney(amountMinor: number, currency: string, locale = 'en-US'): string {
  const digits = currencyDigits(currency);
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(
    amountMinor / 10 ** digits,
  );
}

/**
 * Parses a user-entered decimal string ("19.99") into integer minor units without floating-point
 * rounding errors. Returns null when the value is not a valid non-negative amount.
 */
export function parseMoney(input: string, currency: string): number | null {
  const digits = currencyDigits(currency);
  const value = input.trim();
  const pattern = digits === 0 ? /^\d+$/ : new RegExp(`^\\d+(\\.\\d{1,${digits}})?$`);
  if (!pattern.test(value)) return null;
  const [whole = '0', fraction = ''] = value.split('.');
  const minor = Number(whole) * 10 ** digits + Number(fraction.padEnd(digits, '0') || '0');
  return Number.isSafeInteger(minor) ? minor : null;
}

/** Inverse of parseMoney for form defaults: 1999 USD -> "19.99". */
export function minorToDecimalString(amountMinor: number, currency: string): string {
  const digits = currencyDigits(currency);
  if (digits === 0) return String(amountMinor);
  const sign = amountMinor < 0 ? '-' : '';
  const abs = Math.abs(amountMinor);
  const whole = Math.floor(abs / 10 ** digits);
  const fraction = String(abs % 10 ** digits).padStart(digits, '0');
  return `${sign}${whole}.${fraction}`;
}
