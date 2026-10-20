import { expect, test } from '@playwright/test';
import { ADMIN_URL, createStore, signUp, storefrontUrl } from './helpers';

test('a store sells only after the merchant sets up payouts', async ({ page, browser }) => {
  await signUp(page, 'Payouts Merchant');
  const { storeId, subdomain } = await createStore(page, 'Payout Goods', { payments: false });
  await expect(page.getByText(/Your store can.t accept orders yet/)).toBeVisible();

  // A product to sell.
  await page.goto(`${ADMIN_URL}/s/${storeId}/products/new`);
  await page.getByLabel('Title', { exact: true }).fill('Desk');
  await page.getByLabel('Status', { exact: true }).selectOption('ACTIVE');
  await page.getByLabel('Price for Default', { exact: true }).fill('120');
  await page.getByLabel('Starting stock for Default').fill('5');
  await page.getByRole('button', { name: 'Create product' }).click();
  await expect(page.getByText('Product created.')).toBeVisible();

  // Shoppers see that the store cannot take payments yet.
  const shopper = await browser.newPage();
  await shopper.goto(storefrontUrl(subdomain, '/products/desk'));
  await shopper.getByRole('button', { name: 'Add to cart' }).click();
  await expect(shopper.getByText('Added to cart.')).toBeVisible();
  await shopper.goto(storefrontUrl(subdomain, '/checkout'));
  await expect(shopper.getByText('This store isn’t accepting payments yet.')).toBeVisible();

  // Onboarding left incomplete shows what is missing.
  await page.goto(`${ADMIN_URL}/s/${storeId}/settings/payments`);
  await page.getByLabel('Country of your business').selectOption('GB');
  await page.getByRole('button', { name: 'Set up payments' }).click();
  await page.getByRole('button', { name: 'Finish with missing bank details' }).click();
  await expect(page.getByText('Action required')).toBeVisible();
  await expect(page.getByText('external account')).toBeVisible();

  // "Continue setup" mints a fresh onboarding link; completing it activates payments.
  await page.getByRole('link', { name: 'Continue setup' }).click();
  await page.getByRole('button', { name: 'Complete onboarding' }).click();
  await expect(page.getByText('Payments are set up.')).toBeVisible();
  await expect(page.getByText('United Kingdom')).toBeVisible();

  await shopper.reload();
  await expect(shopper.getByRole('button', { name: 'Continue to payment' })).toBeVisible();
});
