/**
 * Pure order pricing. All amounts are integers in minor units; no floating-point money.
 * Order of operations: subtotal → discount (allocated to lines) → shipping → tax.
 */

export interface PricingLine {
  unitPrice: number;
  quantity: number;
  taxable: boolean;
  requiresShipping: boolean;
  /** False for gift cards: order discounts never reduce their price. Default true. */
  discountable?: boolean;
}

export interface PricingDiscount {
  type: 'PERCENTAGE' | 'FIXED_AMOUNT' | 'FREE_SHIPPING';
  /** Percent (1–100) for PERCENTAGE, minor units for FIXED_AMOUNT, ignored for FREE_SHIPPING. */
  value: number;
}

export interface PricingInput {
  lines: PricingLine[];
  discount?: PricingDiscount | null;
  shippingPrice: number;
  /** Tax rate in basis points (825 = 8.25%). */
  taxRateBps: number;
  taxShipping: boolean;
}

export interface PricingResult {
  subtotal: number;
  discountTotal: number;
  /** Discount allocated to each input line, same order. */
  lineDiscounts: number[];
  shippingTotal: number;
  taxTotal: number;
  total: number;
}

/** Rounds a non-negative rational a/b half-up using integer math. */
function divRoundHalfUp(a: number, b: number): number {
  return Math.floor((2 * a + b) / (2 * b));
}

/**
 * Splits `amount` across `weights` proportionally (largest remainder), so the parts always sum
 * exactly to `amount`.
 */
export function allocate(amount: number, weights: number[]): number[] {
  const totalWeight = weights.reduce((s, w) => s + w, 0);
  if (amount === 0 || totalWeight === 0) return weights.map(() => 0);
  const raw = weights.map((w) => (amount * w) / totalWeight);
  const parts = raw.map(Math.floor);
  let remainder = amount - parts.reduce((s, p) => s + p, 0);
  const order = raw
    .map((r, i) => ({ i, frac: r - Math.floor(r) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (const { i } of order) {
    if (remainder <= 0) break;
    parts[i] = (parts[i] ?? 0) + 1;
    remainder--;
  }
  return parts;
}

export function priceCart(input: PricingInput): PricingResult {
  const lineTotals = input.lines.map((l) => l.unitPrice * l.quantity);
  const subtotal = lineTotals.reduce((s, t) => s + t, 0);

  const discountWeights = input.lines.map((l, i) =>
    l.discountable === false ? 0 : (lineTotals[i] ?? 0),
  );
  const discountBase = discountWeights.reduce((s, t) => s + t, 0);

  let discountTotal = 0;
  if (input.discount?.type === 'PERCENTAGE') {
    const pct = Math.min(100, Math.max(0, input.discount.value));
    discountTotal = divRoundHalfUp(discountBase * pct, 100);
  } else if (input.discount?.type === 'FIXED_AMOUNT') {
    discountTotal = Math.min(discountBase, Math.max(0, input.discount.value));
  }
  const lineDiscounts = allocate(discountTotal, discountWeights);

  const needsShipping = input.lines.some((l) => l.requiresShipping);
  const shippingTotal =
    !needsShipping || input.discount?.type === 'FREE_SHIPPING'
      ? 0
      : Math.max(0, input.shippingPrice);

  const taxableLines = input.lines.reduce(
    (sum, line, i) => (line.taxable ? sum + (lineTotals[i] ?? 0) - (lineDiscounts[i] ?? 0) : sum),
    0,
  );
  const taxableBase = taxableLines + (input.taxShipping ? shippingTotal : 0);
  const taxTotal = divRoundHalfUp(taxableBase * Math.max(0, input.taxRateBps), 10_000);

  return {
    subtotal,
    discountTotal,
    lineDiscounts,
    shippingTotal,
    taxTotal,
    total: subtotal - discountTotal + shippingTotal + taxTotal,
  };
}
