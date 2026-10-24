import { describe, expect, it } from 'vitest';
import { csvRowsToProducts, productsToCsvRows } from './product-csv.js';
import { normalizeMetafieldValue, productBulkInputSchema, productInputSchema } from './products.js';

describe('normalizeMetafieldValue', () => {
  it('canonicalizes valid values', () => {
    expect(normalizeMetafieldValue('number_integer', '-007')).toEqual({ value: '-7' });
    expect(normalizeMetafieldValue('number_decimal', '0012.500')).toEqual({ value: '12.5' });
    expect(normalizeMetafieldValue('number_decimal', '-0.0')).toEqual({ value: '0' });
    expect(normalizeMetafieldValue('boolean', true)).toEqual({ value: 'true' });
    expect(normalizeMetafieldValue('url', 'https://Example.com/a b')).toEqual({
      value: 'https://example.com/a%20b',
    });
    expect(normalizeMetafieldValue('date', '2028-02-29')).toEqual({ value: '2028-02-29' });
  });

  it('rejects values that do not fit the type', () => {
    for (const [type, value] of [
      ['number_integer', '99999999999999999'],
      ['number_integer', '1e3'],
      ['number_decimal', '1,5'],
      ['boolean', '1'],
      ['url', 'http://example.com'],
      ['url', 'https://user:pw@example.com'],
      ['date', '2027-02-29'],
      ['date', '29/02/2028'],
      ['single_line_text', 'a'.repeat(256)],
      ['multi_line_text', ''],
    ] as const) {
      expect(normalizeMetafieldValue(type, value), `${type} ${value}`).toHaveProperty('error');
    }
  });
});

describe('productInputSchema new fields', () => {
  it('normalizes customs fields and allows up to 250 variants', () => {
    const parsed = productInputSchema.parse({
      title: 'Tee',
      options: [{ name: 'N', values: Array.from({ length: 50 }, (_, i) => `v${i}`) }],
      variants: Array.from({ length: 50 }, (_, i) => ({
        options: [`v${i}`],
        price: 100,
        countryOfOrigin: i === 0 ? ' gb ' : '',
        hsCode: i === 0 ? '6109.10.00' : '',
      })),
    });
    expect(parsed.variants[0]).toMatchObject({ countryOfOrigin: 'GB', hsCode: '61091000' });
    expect(parsed.variants[1]).toMatchObject({ countryOfOrigin: null, hsCode: null });
    expect(parsed.variants[1]?.costPerItem).toBeUndefined();
  });

  it('requires tags for tag bulk actions and dedupes ids', () => {
    const id = '00000000-0000-4000-8000-000000000001';
    expect(productBulkInputSchema.safeParse({ productIds: [id], action: 'add_tags' }).success).toBe(
      false,
    );
    expect(
      productBulkInputSchema.parse({ productIds: [id, id], action: 'archive' }).productIds,
    ).toEqual([id]);
  });
});

describe('product CSV images and new columns', () => {
  it('exports images on variant rows plus extra rows, and imports them back', () => {
    const rows = productsToCsvRows(
      [
        {
          handle: 'mug',
          title: 'Mug',
          description: '',
          vendor: null,
          productType: null,
          tags: [],
          status: 'ACTIVE',
          seoTitle: null,
          seoDescription: null,
          options: [],
          images: [
            { url: 'https://cdn.example.com/1.webp', alt: 'Front' },
            { url: 'https://cdn.example.com/2.webp', alt: '' },
          ],
          variants: [
            {
              options: [],
              sku: 'MUG',
              barcode: null,
              price: 1200,
              compareAtPrice: null,
              weightGrams: 300,
              requiresShipping: true,
              taxable: true,
              trackInventory: true,
              allowBackorder: false,
              inventoryQuantity: 4,
              costPerItem: 450,
              countryOfOrigin: 'PT',
              hsCode: '691200',
            },
          ],
        },
      ],
      'USD',
    );
    expect(rows).toHaveLength(3);
    const header = rows[0] ?? [];
    const col = (name: string) => header.indexOf(name);
    expect(rows[1]?.[col('Cost per item')]).toBe('4.50');
    expect(rows[1]?.[col('Country of origin')]).toBe('PT');
    expect(rows[2]?.[col('Image Src')]).toBe('https://cdn.example.com/2.webp');
    expect(rows[2]?.[col('Variant Price')]).toBe('');

    const parsed = csvRowsToProducts(rows, 'USD');
    expect(parsed.errors).toEqual([]);
    expect(parsed.products[0]?.images).toEqual([
      { url: 'https://cdn.example.com/1.webp', alt: 'Front' },
      { url: 'https://cdn.example.com/2.webp', alt: '' },
    ]);
    const input = productInputSchema.parse(parsed.products[0]?.input);
    expect(input.variants).toHaveLength(1);
    expect(input.variants[0]).toMatchObject({
      costPerItem: 450,
      countryOfOrigin: 'PT',
      hsCode: '691200',
    });
  });
});
