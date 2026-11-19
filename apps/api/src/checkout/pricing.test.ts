import { describe, expect, it } from 'vitest';
import { allocate, priceCart, type PricingLine } from './pricing.js';

const line = (unitPrice: number, quantity = 1, extra: Partial<PricingLine> = {}): PricingLine => ({
  unitPrice,
  quantity,
  taxable: true,
  requiresShipping: true,
  ...extra,
});

describe('allocate', () => {
  it('splits exactly, giving remainders to the largest fractions', () => {
    expect(allocate(100, [1, 1, 1])).toEqual([34, 33, 33]);
    expect(allocate(10, [3000, 1000])).toEqual([8, 2]);
    expect(allocate(0, [5, 5])).toEqual([0, 0]);
    expect(allocate(7, [0, 0])).toEqual([0, 0]);
  });
});

describe('priceCart', () => {
  it('sums lines with no adjustments', () => {
    expect(
      priceCart({
        lines: [line(1999, 2), line(500)],
        shippingPrice: 0,
        taxRateBps: 0,
        taxShipping: false,
      }),
    ).toEqual({
      subtotal: 4498,
      discountTotal: 0,
      lineDiscounts: [0, 0],
      shippingTotal: 0,
      taxTotal: 0,
      lineTaxRates: [0, 0],
      lineTaxes: [0, 0],
      shippingTax: 0,
      taxesIncluded: false,
      total: 4498,
    });
  });

  it('taxes each line at its own rate where the destination is taxed, rounding once per rate', () => {
    const lines = [
      { ...line(999, 3), taxRateBps: 500 },
      line(1001),
      { ...line(333), taxRateBps: 500 },
    ];
    const taxed = priceCart({ lines, shippingPrice: 1000, taxRateBps: 1800, taxShipping: true });
    // 5% of 33.30 = 1.665 -> 1.67, split by value; 18% of 10.01 + 10.00 = 3.6018 -> 3.60.
    expect(taxed.lineTaxRates).toEqual([500, 1800, 500]);
    expect(taxed.lineTaxes).toEqual([150, 180, 17]);
    expect(taxed.shippingTax).toBe(180);
    expect(taxed.taxTotal).toBe(167 + 360);
    expect(taxed.total).toBe(3330 + 1001 + 1000 + 527);

    // Untaxed destination: product rates do not apply.
    const untaxed = priceCart({ lines, shippingPrice: 0, taxRateBps: 0, taxShipping: false });
    expect(untaxed.taxTotal).toBe(0);
    expect(untaxed.lineTaxRates).toEqual([0, 0, 0]);
  });

  it('applies a percentage discount (half-up) allocated across lines, then tax on the discounted base', () => {
    const result = priceCart({
      lines: [line(1000), line(333)],
      discount: { type: 'PERCENTAGE', value: 15 },
      shippingPrice: 500,
      taxRateBps: 825,
      taxShipping: false,
    });
    // 15% of 1333 = 199.95 -> 200
    expect(result.discountTotal).toBe(200);
    expect(result.lineDiscounts.reduce((a, b) => a + b, 0)).toBe(200);
    // tax on 1133 at 8.25% = 93.47 -> 93
    expect(result.taxTotal).toBe(93);
    expect(result.total).toBe(1333 - 200 + 500 + 93);
  });

  it('caps fixed discounts at the subtotal', () => {
    const result = priceCart({
      lines: [line(300)],
      discount: { type: 'FIXED_AMOUNT', value: 1000 },
      shippingPrice: 200,
      taxRateBps: 0,
      taxShipping: false,
    });
    expect(result).toMatchObject({ discountTotal: 300, total: 200 });
  });

  it('free-shipping discounts and digital-only carts have zero shipping', () => {
    expect(
      priceCart({
        lines: [line(1000)],
        discount: { type: 'FREE_SHIPPING', value: 0 },
        shippingPrice: 700,
        taxRateBps: 0,
        taxShipping: false,
      }).shippingTotal,
    ).toBe(0);
    expect(
      priceCart({
        lines: [line(1000, 1, { requiresShipping: false })],
        shippingPrice: 700,
        taxRateBps: 0,
        taxShipping: false,
      }).shippingTotal,
    ).toBe(0);
  });

  it('taxes only taxable lines, and shipping when configured', () => {
    const result = priceCart({
      lines: [line(1000), line(1000, 1, { taxable: false })],
      shippingPrice: 1000,
      taxRateBps: 1000,
      taxShipping: true,
    });
    expect(result.taxTotal).toBe(200);
    expect(result.total).toBe(3200);
  });

  it('never discounts gift card lines', () => {
    const result = priceCart({
      lines: [
        {
          unitPrice: 5000,
          quantity: 1,
          taxable: false,
          requiresShipping: false,
          discountable: false,
        },
        { unitPrice: 2000, quantity: 1, taxable: true, requiresShipping: true },
      ],
      discount: { type: 'PERCENTAGE', value: 50 },
      shippingPrice: 0,
      taxRateBps: 0,
      taxShipping: false,
    });
    expect(result).toMatchObject({ discountTotal: 1000, lineDiscounts: [0, 1000], total: 6000 });
    const fixed = priceCart({
      lines: [
        {
          unitPrice: 5000,
          quantity: 1,
          taxable: false,
          requiresShipping: false,
          discountable: false,
        },
      ],
      discount: { type: 'FIXED_AMOUNT', value: 1000 },
      shippingPrice: 0,
      taxRateBps: 0,
      taxShipping: false,
    });
    expect(fixed.discountTotal).toBe(0);
  });

  it('takes tax out of tax-inclusive prices instead of adding it', () => {
    // ₹1,180 MRP at 18% GST holds ₹180 tax on a ₹1,000 taxable value.
    const result = priceCart({
      lines: [line(118_000), line(10_500, 1, { taxRateBps: 500 })],
      shippingPrice: 5_900,
      taxRateBps: 1800,
      taxShipping: true,
      taxesIncluded: true,
    });
    expect(result).toMatchObject({
      subtotal: 128_500,
      taxTotal: 18_000 + 500 + 900,
      lineTaxes: [18_000, 500],
      lineTaxRates: [1800, 500],
      shippingTax: 900,
      taxesIncluded: true,
      total: 128_500 + 5_900,
    });
  });

  it('keeps inclusive prices unchanged where the destination is untaxed', () => {
    const result = priceCart({
      lines: [line(118_000, 2, { taxRateBps: 1800 })],
      shippingPrice: 0,
      taxRateBps: 0,
      taxShipping: false,
      taxesIncluded: true,
    });
    expect(result).toMatchObject({ taxTotal: 0, total: 236_000 });
  });

  it('applies discounts before taking out inclusive tax', () => {
    const result = priceCart({
      lines: [line(236_000)],
      discount: { type: 'PERCENTAGE', value: 50 },
      shippingPrice: 0,
      taxRateBps: 1800,
      taxShipping: false,
      taxesIncluded: true,
    });
    expect(result).toMatchObject({ discountTotal: 118_000, taxTotal: 18_000, total: 118_000 });
  });
});
