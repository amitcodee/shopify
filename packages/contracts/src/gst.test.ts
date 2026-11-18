import { describe, expect, it } from 'vitest';
import {
  amountInWords,
  financialYearOf,
  gstinSchema,
  gstStateFor,
  invoiceNumber,
  numberInWords,
} from './gst.js';

describe('gst', () => {
  it('accepts a GSTIN with a valid check digit and normalises it', () => {
    expect(gstinSchema.parse(' 27aapfu0939f1zv ')).toBe('27AAPFU0939F1ZV');
    expect(gstinSchema.safeParse('27AAPFU0939F1ZA').success).toBe(false);
    expect(gstinSchema.safeParse('99AAPFU0939F1ZV').success).toBe(false);
    expect(gstinSchema.safeParse('27AAPFU0939F1Z').success).toBe(false);
  });

  it('finds the state from codes and names shoppers type', () => {
    expect(gstStateFor('MH')?.code).toBe('27');
    expect(gstStateFor('IN-KA')?.code).toBe('29');
    expect(gstStateFor('tamil nadu')?.code).toBe('33');
    expect(gstStateFor('Jammu & Kashmir')?.code).toBe('01');
    expect(gstStateFor('TS')?.code).toBe('36');
    expect(gstStateFor('27')?.name).toBe('Maharashtra');
    expect(gstStateFor('California')).toBeNull();
    expect(gstStateFor('')).toBeNull();
  });

  it('numbers invoices per April-March financial year', () => {
    expect(financialYearOf(2026, 3)).toBe('2025-26');
    expect(financialYearOf(2026, 4)).toBe('2026-27');
    expect(financialYearOf(2099, 12)).toBe('2099-00');
    expect(invoiceNumber('INV', '2026-27', 7)).toBe('INV/26-27/0007');
    expect(invoiceNumber('ABCDE', '2026-27', 1234).length).toBeLessThanOrEqual(16);
  });

  it('writes amounts in words the Indian way', () => {
    expect(numberInWords(0)).toBe('Zero');
    expect(numberInWords(115)).toBe('One Hundred Fifteen');
    expect(numberInWords(125_000)).toBe('One Lakh Twenty Five Thousand');
    expect(numberInWords(12_34_56_789)).toBe(
      'Twelve Crore Thirty Four Lakh Fifty Six Thousand Seven Hundred Eighty Nine',
    );
    expect(amountInWords(123_450, 'INR')).toBe(
      'Rupees One Thousand Two Hundred Thirty Four and Fifty Paise Only',
    );
    expect(amountInWords(79_900, 'INR')).toBe('Rupees Seven Hundred Ninety Nine Only');
  });
});
