import { describe, expect, it } from 'vitest';
import { convertAmount, convertPrice, minorUnitFactor } from './currencies.js';

describe('currency conversion', () => {
  it('converts between currencies with different minor units', () => {
    expect(minorUnitFactor('USD', 'JPY', 150)).toBe(1.5);
    expect(convertAmount(1000, 'USD', 'JPY', 150)).toBe(1500); // $10.00 -> ¥1500
    expect(convertAmount(1500, 'JPY', 'USD', 1 / 150)).toBe(1000);
    expect(convertAmount(1999, 'USD', 'EUR', 0.92)).toBe(1839); // 18.3908 -> 18.39
  });

  it('rounds product prices up by the chosen rule', () => {
    expect(convertPrice(1999, 'USD', 'EUR', 0.92, 'EXACT')).toBe(1839);
    expect(convertPrice(1999, 'USD', 'EUR', 0.92, 'WHOLE')).toBe(1900);
    expect(convertPrice(1999, 'USD', 'EUR', 0.92, 'NINETY_NINE')).toBe(1899);
    expect(convertPrice(1000, 'USD', 'EUR', 1, 'NINETY_NINE')).toBe(999); // already whole
    expect(convertPrice(1001, 'USD', 'JPY', 150, 'NINETY_NINE')).toBe(1502); // no minor units
    expect(convertPrice(0, 'USD', 'EUR', 0.92, 'WHOLE')).toBe(0);
  });
});
