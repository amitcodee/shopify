import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { ADMIN_URL, createStore, signUp, storefrontUrl } from './helpers';

test('merchant duplicates a product, exports orders and prints a packing slip; shopper search finds partial words', async ({
  browser,
}) => {
  const merchant = await browser.newPage();
  await signUp(merchant);
  const { subdomain, storeId } = await createStore(merchant, 'Tools Co');
  await merchant.goto(`${ADMIN_URL}/s/${storeId}/products/new`);
  await merchant.getByLabel('Title', { exact: true }).fill('Wool Overcoat');
  await merchant.getByLabel('Status', { exact: true }).selectOption('ACTIVE');
  await merchant.getByLabel('Tags').fill('outerwear');
  await merchant.getByLabel('Price for Default', { exact: true }).fill('120');
  await merchant.getByLabel('Starting stock for Default').fill('5');
  await merchant.getByRole('button', { name: 'Create product' }).click();
  await expect(merchant.getByText('Product created.')).toBeVisible();

  // Duplicate: a draft copy with the same price.
  await merchant.getByRole('button', { name: 'Duplicate product' }).click();
  await expect(merchant.getByText(/Draft copy created/)).toBeVisible();
  await expect(merchant.getByRole('heading', { name: 'Copy of Wool Overcoat' })).toBeVisible();
  await expect(merchant.getByLabel('Price for Default', { exact: true })).toHaveValue('120.00');

  // Shopper: "coat" finds "Overcoat"; plurals find the singular.
  const shopper = await browser.newPage();
  await shopper.goto(storefrontUrl(subdomain, '/search?q=coats'));
  await expect(shopper.getByText('1 result for “coats”')).toBeVisible();
  await shopper.getByRole('link', { name: /Wool Overcoat/ }).first().click();
  await shopper.getByRole('button', { name: 'Add to cart' }).click();
  await expect(shopper.getByText('Added to cart.')).toBeVisible();
  await shopper.goto(storefrontUrl(subdomain, '/cart'));
  await shopper.getByRole('link', { name: 'Check out' }).click();
  await shopper.getByLabel('Email').fill('coat-buyer@example.com');
  await shopper.getByLabel('Full name').fill('Coat Buyer');
  await shopper.getByLabel('Address', { exact: true }).fill('5 Hill Rd');
  await shopper.getByLabel('City').fill('Leeds');
  await shopper.getByLabel('Postal code').fill('LS1 1AA');
  await shopper.getByLabel('Country').selectOption('GB');
  await shopper.getByRole('button', { name: 'Continue to payment' }).click();
  await shopper.getByRole('button', { name: 'Pay now (test card succeeds)' }).click();
  await expect(shopper.getByRole('heading', { name: 'Thank you for your order!' })).toBeVisible();
  await expect(shopper.getByText('United Kingdom')).toBeVisible();

  // Export the order list as CSV.
  await merchant.goto(`${ADMIN_URL}/s/${storeId}/orders`);
  const downloading = merchant.waitForEvent('download');
  await merchant.getByRole('link', { name: 'Export' }).click();
  const download = await downloading;
  expect(download.suggestedFilename()).toMatch(/^orders-.*\.csv$/);
  const csv = readFileSync((await download.path()) ?? '', 'utf8');
  expect(csv).toContain('#1001');
  expect(csv).toContain('1 × Wool Overcoat');

  // Packing slip: items and address, no prices.
  await merchant.getByRole('link', { name: '#1001' }).click();
  await merchant.getByRole('link', { name: 'Print packing slip' }).click();
  await expect(merchant).toHaveURL(/\/packing-slip\//);
  await expect(merchant.getByRole('banner').getByText('Packing slip')).toBeVisible();
  await expect(merchant.getByText('Coat Buyer')).toBeVisible();
  await expect(merchant.getByText('United Kingdom')).toBeVisible();
  await expect(merchant.getByRole('cell', { name: 'Wool Overcoat' })).toBeVisible();
  await expect(merchant.getByText('$120.00')).toHaveCount(0);
  await expect(merchant.getByRole('button', { name: 'Print' })).toBeVisible();

  // Phones get a collapsed menu instead of the full sidebar.
  await merchant.setViewportSize({ width: 390, height: 844 });
  await merchant.goto(`${ADMIN_URL}/s/${storeId}/orders`);
  const menu = merchant.getByText('Menu ·');
  await expect(menu).toBeVisible();
  await expect(merchant.getByRole('link', { name: 'Products', exact: true })).toBeHidden();
  await menu.click();
  await merchant.getByRole('link', { name: 'Products', exact: true }).click();
  await expect(merchant).toHaveURL(/\/products$/);
  await expect(merchant.getByRole('link', { name: 'Customers', exact: true })).toBeHidden();
});
