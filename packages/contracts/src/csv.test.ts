import { describe, expect, it } from 'vitest';
import { parseCsv, toCsv } from './csv.js';
import { csvRowsToProducts, productInputSchema, productsToCsvRows } from './index.js';

describe('csv', () => {
  it('parses quotes, escaped quotes, newlines in fields, CRLF and a BOM', () => {
    const text = '﻿a,b,c\r\n"x, y","say ""hi""","line1\nline2"\n\n1,,3\n';
    expect(parseCsv(text)).toEqual([
      ['a', 'b', 'c'],
      ['x, y', 'say "hi"', 'line1\nline2'],
      ['1', '', '3'],
    ]);
    expect(() => parseCsv('"open')).toThrow();
  });

  it('round-trips and neutralizes formula cells', () => {
    const csv = toCsv([
      ['Title', 'Note'],
      ['=HYPERLINK("x")', 'a,b'],
      ['-5', 7],
    ]);
    expect(csv).toBe('Title,Note\r\n"\'=HYPERLINK(""x"")","a,b"\r\n\'-5,7\r\n');
    expect(parseCsv(csv)[1]).toEqual(['\'=HYPERLINK("x")', 'a,b']);
  });
});

describe('product csv', () => {
  const product = {
    handle: 'rain-jacket',
    title: 'Rain Jacket',
    description: 'Dry, always.',
    vendor: 'Acme',
    productType: null,
    tags: ['outdoor', 'rain'],
    status: 'ACTIVE' as const,
    seoTitle: null,
    seoDescription: null,
    options: [
      { name: 'Size', values: ['M', 'L'] },
      { name: 'Color', values: ['Green'] },
    ],
    variants: ['M', 'L'].map((size, i) => ({
      options: [size, 'Green'],
      sku: `RJ-${size}`,
      barcode: null,
      price: 8950,
      compareAtPrice: i === 0 ? 9900 : null,
      weightGrams: 400,
      requiresShipping: true,
      taxable: true,
      trackInventory: true,
      allowBackorder: false,
      inventoryQuantity: 3 + i,
    })),
  };

  it('exports one row per variant and imports it back to a valid product', () => {
    const rows = productsToCsvRows([product], 'USD');
    expect(rows).toHaveLength(3);
    expect(rows[1]?.slice(0, 2)).toEqual(['rain-jacket', 'Rain Jacket']);
    expect(rows[2]?.[1]).toBe(''); // product fields only on the first row

    const parsed = csvRowsToProducts(parseCsv(toCsv(rows)), 'USD');
    expect(parsed.errors).toEqual([]);
    expect(parsed.products).toHaveLength(1);
    const input = productInputSchema.parse(parsed.products[0]?.input);
    expect(input).toMatchObject({
      title: 'Rain Jacket',
      status: 'ACTIVE',
      tags: ['outdoor', 'rain'],
      options: product.options,
    });
    expect(
      input.variants.map((v) => [v.sku, v.price, v.compareAtPrice, v.inventoryQuantity]),
    ).toEqual([
      ['RJ-M', 8950, 9900, 3],
      ['RJ-L', 8950, null, 4],
    ]);
  });

  it('reports format errors with spreadsheet row numbers', () => {
    const parsed = csvRowsToProducts(
      [
        ['Handle', 'Title', 'Variant Price', 'Variant Taxable'],
        ['mug', 'Mug', '12.5x', 'maybe'],
        ['', 'No handle', '1'],
      ],
      'USD',
    );
    expect(parsed.errors).toEqual([
      { row: 2, message: 'Variant Price "12.5x" is not a price.' },
      { row: 2, message: 'Variant Taxable must be TRUE or FALSE.' },
      { row: 3, message: 'Handle is required.' },
    ]);
    expect(csvRowsToProducts([['Title']], 'USD').errors.map((e) => e.message)).toEqual([
      'Missing column "Handle".',
      'Missing column "Variant Price".',
    ]);
  });
});
