import { z } from 'zod';
import { minorToDecimalString, parseMoney } from './money.js';

/**
 * Shopify-style product CSV: one row per variant; product fields on a handle's first row. Images
 * ride along one per row (Image Src); a product with more images than variants gets extra rows
 * carrying only Handle and the image columns.
 */
export const PRODUCT_CSV_COLUMNS = [
  'Handle',
  'Title',
  'Description',
  'Vendor',
  'Type',
  'Tags',
  'Status',
  'Option1 Name',
  'Option1 Value',
  'Option2 Name',
  'Option2 Value',
  'Option3 Name',
  'Option3 Value',
  'Variant SKU',
  'Variant Barcode',
  'Variant Price',
  'Variant Compare At Price',
  'Variant Grams',
  'Variant Requires Shipping',
  'Variant Taxable',
  'Variant Track Inventory',
  'Variant Allow Backorder',
  'Variant Inventory Qty',
  'SEO Title',
  'SEO Description',
  'Cost per item',
  'Country of origin',
  'HS code',
  'Image Src',
  'Image Position',
  'Image Alt Text',
] as const;
type Column = (typeof PRODUCT_CSV_COLUMNS)[number];

export const MAX_PRODUCT_CSV_ROWS = 5000;

export interface CsvProduct {
  handle: string;
  title: string;
  description: string;
  vendor: string | null;
  productType: string | null;
  tags: string[];
  status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
  seoTitle: string | null;
  seoDescription: string | null;
  options: { name: string; values: string[] }[];
  /** Public image URLs in gallery order. */
  images?: { url: string; alt: string }[];
  variants: {
    options: string[];
    sku: string | null;
    barcode: string | null;
    price: number;
    compareAtPrice: number | null;
    weightGrams: number;
    requiresShipping: boolean;
    taxable: boolean;
    trackInventory: boolean;
    allowBackorder: boolean;
    inventoryQuantity: number;
    costPerItem?: number | null;
    countryOfOrigin?: string | null;
    hsCode?: string | null;
  }[];
}

const yesNo = (value: boolean) => (value ? 'TRUE' : 'FALSE');

export function productsToCsvRows(products: CsvProduct[], currency: string): string[][] {
  const rows: string[][] = [[...PRODUCT_CSV_COLUMNS]];
  for (const p of products) {
    const images = p.images ?? [];
    const imageCells = (i: number): string[] => {
      const image = images[i];
      return image ? [image.url, String(i + 1), image.alt] : ['', '', ''];
    };
    p.variants.forEach((v, i) => {
      const first = i === 0;
      const option = (n: number): [string, string] => [
        first ? (p.options[n]?.name ?? '') : '',
        v.options[n] ?? '',
      ];
      rows.push([
        p.handle,
        first ? p.title : '',
        first ? p.description : '',
        first ? (p.vendor ?? '') : '',
        first ? (p.productType ?? '') : '',
        first ? p.tags.join(', ') : '',
        first ? p.status.toLowerCase() : '',
        ...option(0),
        ...option(1),
        ...option(2),
        v.sku ?? '',
        v.barcode ?? '',
        minorToDecimalString(v.price, currency),
        v.compareAtPrice === null ? '' : minorToDecimalString(v.compareAtPrice, currency),
        String(v.weightGrams),
        yesNo(v.requiresShipping),
        yesNo(v.taxable),
        yesNo(v.trackInventory),
        yesNo(v.allowBackorder),
        String(v.inventoryQuantity),
        first ? (p.seoTitle ?? '') : '',
        first ? (p.seoDescription ?? '') : '',
        v.costPerItem === null || v.costPerItem === undefined
          ? ''
          : minorToDecimalString(v.costPerItem, currency),
        v.countryOfOrigin ?? '',
        v.hsCode ?? '',
        ...imageCells(i),
      ]);
    });
    for (let i = p.variants.length; i < images.length; i++) {
      const row: string[] = PRODUCT_CSV_COLUMNS.map(() => '');
      row[0] = p.handle;
      row.splice(PRODUCT_CSV_COLUMNS.indexOf('Image Src'), 3, ...imageCells(i));
      rows.push(row);
    }
  }
  return rows;
}

export const productCsvImportResultSchema = z.object({
  created: z.array(z.object({ handle: z.string(), title: z.string() })),
  skipped: z.array(z.object({ handle: z.string(), reason: z.string() })),
  errors: z.array(z.object({ row: z.number().int(), message: z.string() })),
});
export type ProductCsvImportResult = z.infer<typeof productCsvImportResultSchema>;

export interface ParsedCsvProduct {
  /** 1-based spreadsheet row of the handle's first line (header is row 1). */
  row: number;
  handle: string;
  /** Raw product input; validated with productInputSchema by the importer. */
  input: Record<string, unknown>;
  /** Image Src URLs (with alt text) in Image Position order, imported after the product. */
  images: { url: string; alt: string }[];
}

/**
 * Groups CSV rows by handle into raw product inputs. Format errors (unknown header, bad prices
 * or booleans) are reported per row; schema validation happens later on each product.
 */
export function csvRowsToProducts(
  rows: string[][],
  currency: string,
): { products: ParsedCsvProduct[]; errors: { row: number; message: string }[] } {
  const errors: { row: number; message: string }[] = [];
  const [header, ...body] = rows;
  if (!header) return { products: [], errors: [{ row: 1, message: 'The file is empty.' }] };
  const index = new Map(header.map((h, i) => [h.trim().toLowerCase(), i]));
  for (const required of ['Handle', 'Title', 'Variant Price'] as const) {
    if (!index.has(required.toLowerCase())) {
      errors.push({ row: 1, message: `Missing column "${required}".` });
    }
  }
  if (errors.length > 0) return { products: [], errors };
  if (body.length > MAX_PRODUCT_CSV_ROWS) {
    return {
      products: [],
      errors: [{ row: 1, message: `Import at most ${MAX_PRODUCT_CSV_ROWS} rows at a time.` }],
    };
  }

  const groups = new Map<
    string,
    {
      row: number;
      product: Record<string, unknown>;
      options: { name: string; values: string[] }[];
      variants: Record<string, unknown>[];
      images: { url: string; alt: string; position: number }[];
    }
  >();
  body.forEach((cells, i) => {
    const rowNumber = i + 2;
    const get = (column: Column) => (cells[index.get(column.toLowerCase()) ?? -1] ?? '').trim();
    const handle = get('Handle').toLowerCase();
    if (!handle) {
      errors.push({ row: rowNumber, message: 'Handle is required.' });
      return;
    }
    const bool = (column: Column, fallback: boolean): boolean => {
      const value = get(column).toLowerCase();
      if (value === '') return fallback;
      if (['true', 'yes', '1'].includes(value)) return true;
      if (['false', 'no', '0'].includes(value)) return false;
      errors.push({ row: rowNumber, message: `${column} must be TRUE or FALSE.` });
      return fallback;
    };
    const money = (column: Column, required: boolean): number | null => {
      const value = get(column);
      if (value === '') {
        if (required) errors.push({ row: rowNumber, message: `${column} is required.` });
        return null;
      }
      const parsed = parseMoney(value, currency);
      if (parsed === null)
        errors.push({ row: rowNumber, message: `${column} "${value}" is not a price.` });
      return parsed;
    };
    const int = (column: Column): number | undefined => {
      const value = get(column);
      if (value === '') return undefined;
      const parsed = Number(value);
      if (!Number.isInteger(parsed) || parsed < 0) {
        errors.push({ row: rowNumber, message: `${column} must be a whole number.` });
        return undefined;
      }
      return parsed;
    };

    const imageSrc = get('Image Src');
    const addImage = (target: { images: { url: string; alt: string; position: number }[] }) => {
      if (!imageSrc) return;
      const position = Number(get('Image Position'));
      target.images.push({
        url: imageSrc,
        alt: get('Image Alt Text'),
        position: Number.isInteger(position) && position > 0 ? position : 1_000_000 + rowNumber,
      });
    };
    const existingGroup = groups.get(handle);
    const imageOnly =
      existingGroup &&
      imageSrc !== '' &&
      get('Variant Price') === '' &&
      get('Variant SKU') === '' &&
      (['Option1', 'Option2', 'Option3'] as const).every((o) => get(`${o} Value` as Column) === '');
    if (existingGroup && imageOnly) {
      addImage(existingGroup);
      return;
    }
    let group = groups.get(handle);
    if (!group) {
      const status = get('Status').toUpperCase() || 'DRAFT';
      group = {
        row: rowNumber,
        product: {
          title: get('Title'),
          handle,
          description: get('Description'),
          status,
          vendor: get('Vendor'),
          productType: get('Type'),
          tags: get('Tags')
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean),
          seoTitle: get('SEO Title'),
          seoDescription: get('SEO Description'),
        },
        options: (['Option1', 'Option2', 'Option3'] as const)
          .map((o) => get(`${o} Name` as Column))
          .filter(Boolean)
          .map((name) => ({ name, values: [] })),
        variants: [],
        images: [],
      };
      groups.set(handle, group);
    }
    const values = (['Option1', 'Option2', 'Option3'] as const)
      .slice(0, group.options.length)
      .map((o) => get(`${o} Value` as Column));
    values.forEach((value, n) => {
      const option = group.options[n];
      if (value && option && !option.values.includes(value)) option.values.push(value);
    });
    group.variants.push({
      options: values,
      sku: get('Variant SKU'),
      barcode: get('Variant Barcode'),
      price: money('Variant Price', true) ?? 0,
      compareAtPrice: money('Variant Compare At Price', false),
      weightGrams: int('Variant Grams') ?? 0,
      requiresShipping: bool('Variant Requires Shipping', true),
      taxable: bool('Variant Taxable', true),
      trackInventory: bool('Variant Track Inventory', true),
      allowBackorder: bool('Variant Allow Backorder', false),
      inventoryQuantity: int('Variant Inventory Qty') ?? 0,
      costPerItem: money('Cost per item', false),
      countryOfOrigin: get('Country of origin'),
      hsCode: get('HS code'),
    });
    addImage(group);
  });

  return {
    products: [...groups].map(([handle, g]) => ({
      row: g.row,
      handle,
      input: { ...g.product, options: g.options, variants: g.variants },
      images: g.images
        .sort((a, b) => a.position - b.position)
        .map(({ url, alt }) => ({ url, alt })),
    })),
    errors,
  };
}
