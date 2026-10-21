import { expect, test } from '@playwright/test';
import { createStore, signUp } from './helpers';

test('merchant creates a draft order with a custom item and marks it as paid', async ({ page }) => {
  await signUp(page);
  await createStore(page, 'Phone Orders Co', { payments: false });

  await page.getByRole('link', { name: 'Orders', exact: true }).first().click();
  await page.getByRole('link', { name: 'Draft orders' }).click();
  await page.getByRole('link', { name: 'Create order' }).click();

  await page.getByLabel('Item 1', { exact: true }).selectOption('custom');
  await page.getByLabel('Custom item name 1').fill('Gift basket');
  await page.getByLabel('Quantity 1').fill('2');
  await page.getByLabel('Price 1').fill('30');
  await page.getByLabel('Email').fill('buyer@example.com');
  await page.getByLabel('Name', { exact: true }).fill('Pat Buyer');
  await page.getByLabel('Address', { exact: true }).fill('5 Main St');
  await page.getByLabel('City').fill('Springfield');
  await page.getByLabel('Postal code').fill('12345');
  await page.getByLabel('Country (2 letters)').fill('US');
  await page.getByLabel('Shipping method').fill('Courier');
  await page.getByLabel('Shipping price (USD)').fill('5');
  await page.getByRole('button', { name: 'Create draft' }).click();

  await expect(page.getByRole('heading', { name: 'Draft #D1' })).toBeVisible();
  await expect(page.getByText('$65.00').first()).toBeVisible();

  await page.getByRole('button', { name: 'Mark as paid' }).click();
  await expect(page.getByRole('heading', { name: /Order #1001/ })).toBeVisible();
  await expect(page.getByText('Marked as paid (payment collected manually).')).toBeVisible();
});
