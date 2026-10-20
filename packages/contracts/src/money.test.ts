import { describe, expect, it } from 'vitest';
import { formatMoney, minorToDecimalString, parseMoney } from './money.js';

describe('money', () => {
  it('parses decimal strings into minor units without float errors', () => {
    expect(parseMoney('19.99', 'USD')).toBe(1999);
    expect(parseMoney('0.1', 'USD')).toBe(10);
    expect(parseMoney('1000', 'JPY')).toBe(1000);
  });

  it('rejects invalid amounts', () => {
    expect(parseMoney('-1', 'USD')).toBeNull();
    expect(parseMoney('1.999', 'USD')).toBeNull();
    expect(parseMoney('1.5', 'JPY')).toBeNull();
    expect(parseMoney('abc', 'USD')).toBeNull();
  });

  it('formats and round-trips', () => {
    expect(formatMoney(1999, 'USD')).toBe('$19.99');
    expect(minorToDecimalString(1905, 'USD')).toBe('19.05');
    expect(minorToDecimalString(500, 'JPY')).toBe('500');
  });
});
