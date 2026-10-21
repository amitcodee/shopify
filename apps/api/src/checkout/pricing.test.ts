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
      total: 4498,
    });
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
});
