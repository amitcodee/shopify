import { expect, test } from '@playwright/test';
import { createStore, signUp, storefrontUrl } from './helpers';

test('merchant enables a currency and shoppers browse in it', async ({ page, browser }) => {
  await signUp(page);
  const { subdomain } = await createStore(page, 'Euro Co');
  await page.getByRole('link', { name: 'Products', exact: true }).click();
  await page.getByRole('link', { name: 'Add product' }).first().click();
  await page.getByLabel('Title', { exact: true }).fill('Kettle');
  await page.getByLabel('Status', { exact: true }).selectOption('ACTIVE');
  await page.getByLabel('Price for Default', { exact: true }).fill('19.99');
  await page.getByLabel('Starting stock for Default').fill('5');
  await page.getByRole('button', { name: 'Create product' }).click();
  await expect(page.getByText('Product created.')).toBeVisible();

  await page.getByRole('link', { name: 'Settings' }).first().click();
  await page.getByRole('link', { name: 'Currencies' }).click();
  await page.getByLabel('EUR', { exact: true }).check();
  await page.getByLabel('Exchange rate for EUR').fill('0.92');
  await page.getByLabel('Rounding for EUR').selectOption('NINETY_NINE');
  await page.getByRole('button', { name: 'Save currencies' }).click();
  await expect(page.getByText('Currencies saved.')).toBeVisible();

  const shopper = await browser.newPage();
  await shopper.goto(storefrontUrl(subdomain, '/products/kettle'));
  await expect(shopper.getByText('$19.99').first()).toBeVisible();
  await shopper.getByLabel('Currency').selectOption('EUR');
  await expect(shopper).toHaveURL(/\/products\/kettle$/);
  // 19.99 × 0.92 = 18.39, rounded up to the charm price 18.99.
  await expect(shopper.getByText('€18.99').first()).toBeVisible();

  await shopper.getByRole('button', { name: 'Add to cart' }).click();
  await expect(shopper.getByText('Added to cart.')).toBeVisible();
  await shopper.goto(storefrontUrl(subdomain, '/cart'));
  await expect(shopper.getByText('€18.99').first()).toBeVisible();
});
