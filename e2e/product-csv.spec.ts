import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { createStore, signUp } from './helpers';

const CSV = [
  'Handle,Title,Status,Option1 Name,Option1 Value,Variant Price,Variant Inventory Qty',
  'linen-shirt,Linen Shirt,active,Size,S,45.00,3',
  'linen-shirt,,,,M,45.00,5',
  'broken,Broken,active,,,not-a-price,1',
].join('\n');

test('merchant imports products from CSV and exports the catalog', async ({ page }) => {
  await signUp(page);
  await createStore(page, 'CSV Co', { payments: false });

  await page.getByRole('link', { name: 'Products', exact: true }).first().click();
  await page.getByRole('link', { name: 'Import' }).click();
  await page.getByLabel('CSV file').setInputFiles({
    name: 'products.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(CSV),
  });
  await page.getByRole('button', { name: 'Import products' }).click();
  await expect(page.getByText('Created 1 product')).toBeVisible();
  await expect(page.getByText('Row 4: Variant Price "not-a-price" is not a price.')).toBeVisible();

  await page.getByRole('link', { name: 'Products' }).first().click();
  const row = page.getByRole('row', { name: /Linen Shirt/ });
  await expect(row).toContainText('8 in stock');

  const download = page.waitForEvent('download');
  await page.getByRole('link', { name: 'Export' }).click();
  const file = await (await download).path();
  const csv = await readFile(file, 'utf8');
  expect(csv).toContain('linen-shirt,Linen Shirt');
  expect(csv.trim().split('\r\n')).toHaveLength(3);
});
