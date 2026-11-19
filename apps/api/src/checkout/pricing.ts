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
  /**
   * The product's own tax rate (basis points), e.g. a GST slab. Used instead of the
   * destination's rate, but only where the destination is taxed at all.
   */
  taxRateBps?: number | null;
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
  /**
   * Prices (lines and shipping) already include tax, as with GST-inclusive (MRP) pricing: tax is
   * taken out of them instead of added. Where the destination has no tax, prices stay as they are.
   */
  taxesIncluded?: boolean;
}

export interface PricingResult {
  subtotal: number;
  discountTotal: number;
  /** Discount allocated to each input line, same order. */
  lineDiscounts: number[];
  shippingTotal: number;
  taxTotal: number;
  /** Tax rate (basis points) and tax charged on each input line, same order. */
  lineTaxRates: number[];
  lineTaxes: number[];
  /** Part of taxTotal charged on shipping. */
  shippingTax: number;
  /** True when taxTotal is already inside the prices (not added on top). */
  taxesIncluded: boolean;
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

  // Tax is rounded once per rate (as a tax invoice shows it), then split across the lines (and
  // shipping) at that rate in proportion to their value. Inclusive prices hold the tax already:
  // the tax part of an amount at rate r is amount * r / (1 + r).
  const included = input.taxesIncluded === true;
  const destinationRate = Math.max(0, input.taxRateBps);
  const lineTaxRates = input.lines.map((line) =>
    line.taxable && destinationRate > 0 ? Math.max(0, line.taxRateBps ?? destinationRate) : 0,
  );
  const bases = input.lines.map((_, i) => (lineTotals[i] ?? 0) - (lineDiscounts[i] ?? 0));
  const shippingRate = input.taxShipping ? destinationRate : 0;
  const members = [
    ...bases.map((base, i) => ({ base, rate: lineTaxRates[i] ?? 0 })),
    { base: shippingTotal, rate: shippingRate },
  ];
  const taxes = members.map(() => 0);
  for (const rate of new Set(members.map((m) => m.rate))) {
    if (rate === 0) continue;
    const indexes = members.flatMap((m, i) => (m.rate === rate ? [i] : []));
    const weights = indexes.map((i) => members[i]?.base ?? 0);
    const groupBase = weights.reduce((s, w) => s + w, 0);
    const groupTax = included
      ? divRoundHalfUp(groupBase * rate, 10_000 + rate)
      : divRoundHalfUp(groupBase * rate, 10_000);
    const parts = allocate(groupTax, weights);
    indexes.forEach((memberIndex, k) => (taxes[memberIndex] = parts[k] ?? 0));
  }
  const lineTaxes = taxes.slice(0, input.lines.length);
  const shippingTax = taxes[input.lines.length] ?? 0;
  const taxTotal = taxes.reduce((s, t) => s + t, 0);

  return {
    subtotal,
    discountTotal,
    lineDiscounts,
    shippingTotal,
    taxTotal,
    lineTaxRates,
    lineTaxes,
    shippingTax,
    taxesIncluded: included,
    total: subtotal - discountTotal + shippingTotal + (included ? 0 : taxTotal),
  };
}
