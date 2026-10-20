import { expect, test } from '@playwright/test';
import { createStore, signUp } from './helpers';

// 1x1 transparent PNG.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);

test('merchant builds a catalog: product with variants, image, stock, collection, staff invite', async ({
  page,
}) => {
  await signUp(page);
  await createStore(page, 'Catalog Co');

  // Create a product with two options -> 4 variants.
  await page.getByRole('link', { name: 'Products', exact: true }).click();
  await page.getByRole('link', { name: 'Add product' }).first().click();
  await page.getByLabel('Title', { exact: true }).fill('Rain Jacket');
  await page.getByLabel('Description', { exact: true }).fill('Waterproof and breathable.');
  await page.getByLabel('Status', { exact: true }).selectOption('ACTIVE');
  await page.getByLabel('Tags', { exact: true }).fill('outdoor, rain');
  await page.getByRole('button', { name: 'Add option' }).click();
  await page.getByLabel('Option name').fill('Size');
  await page.getByLabel('Values (comma separated)').fill('M, L');
  await page.getByRole('button', { name: 'Add option' }).click();
  await page.getByLabel('Option name').nth(1).fill('Color');
  await page.getByLabel('Values (comma separated)').nth(1).fill('Green, Navy');

  for (const variant of ['M / Green', 'M / Navy', 'L / Green', 'L / Navy']) {
    await page.getByLabel(`Price for ${variant}`, { exact: true }).fill('89.50');
    await page.getByLabel(`Starting stock for ${variant}`).fill('7');
  }
  await page.getByLabel('SKU for M / Green').fill('RJ-M-GRN');
  await page.getByRole('button', { name: 'Create product' }).click();

  await expect(page.getByText('Product created.')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Rain Jacket' })).toBeVisible();

  // Upload an image.
  await page.getByLabel('Upload image').setInputFiles({
    name: 'jacket.png',
    mimeType: 'image/png',
    buffer: PNG,
  });
  await page.getByLabel('Alt text').fill('Green rain jacket');
  await page.getByRole('button', { name: 'Upload', exact: true }).click();
  await expect(page.getByRole('img', { name: 'Green rain jacket' })).toBeVisible();

  // Product list shows totals.
  await page.getByRole('link', { name: 'Products', exact: true }).first().click();
  const row = page.getByRole('row', { name: /Rain Jacket/ });
  await expect(row).toContainText('28 in stock');
  await expect(row).toContainText('$89.50');

  // Restock one variant.
  await page.getByRole('link', { name: 'Inventory' }).click();
  await page.getByLabel('Change for Rain Jacket M / Green').fill('5');
  await page
    .getByRole('row', { name: /RJ-M-GRN/ })
    .getByRole('button', { name: 'Apply' })
    .click();
  await expect(page.getByRole('row', { name: /RJ-M-GRN/ })).toContainText('12');

  // Tag-based collection picks the product up automatically.
  await page.getByRole('link', { name: 'Collections' }).click();
  await page.getByRole('link', { name: 'Create collection' }).click();
  await page.getByLabel('Title', { exact: true }).fill('Rainy Days');
  await page.getByLabel('Automated: include products tagged').fill('rain');
  await page.getByRole('button', { name: 'Create collection' }).click();
  await expect(page.getByText(/tagged “rain” \(1\)/)).toBeVisible();

  // Invite a staff member.
  await page.getByRole('link', { name: 'Settings' }).click();
  await page.getByRole('link', { name: 'Staff' }).click();
  await page.getByLabel('Email', { exact: true }).fill('helper@example.com');
  await page.getByRole('button', { name: 'Send invitation' }).click();
  await expect(page.getByText(/Invitation sent to helper@example.com/)).toBeVisible();
  await expect(page.getByRole('cell', { name: 'helper@example.com' })).toBeVisible();
});
