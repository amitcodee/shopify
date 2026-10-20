import { expect, test } from '@playwright/test';
import { ADMIN_URL, createStore, signUp, storefrontUrl } from './helpers';

test('merchant configures theme, shipping, tax and a discount; checkout totals reflect them', async ({
  browser,
}) => {
  const merchant = await browser.newPage();
  await signUp(merchant);
  const { subdomain, storeId } = await createStore(merchant, 'Configured Co');
  const settings = `${ADMIN_URL}/s/${storeId}/settings`;

  // Product: $40.00.
  await merchant.goto(`${ADMIN_URL}/s/${storeId}/products/new`);
  await merchant.getByLabel('Title', { exact: true }).fill('Desk Lamp');
  await merchant.getByLabel('Status', { exact: true }).selectOption('ACTIVE');
  await merchant.getByLabel('Price for Default', { exact: true }).fill('40');
  await merchant.getByLabel('Starting stock for Default').fill('10');
  await merchant.getByRole('button', { name: 'Create product' }).click();
  await expect(merchant.getByText('Product created.')).toBeVisible();

  // Theme.
  await merchant.goto(`${settings}/theme`);
  await merchant.getByLabel('Layout').selectOption('bold');
  await merchant.getByLabel('Homepage headline').fill('Light up your desk');
  await merchant.getByLabel('Announcement bar').fill('Use code WELCOME10 for 10% off');
  await merchant.getByRole('button', { name: 'Save theme' }).click();
  await expect(merchant.getByText(/Theme saved/)).toBeVisible();

  // Shipping: US zone with a $5 rate.
  await merchant.goto(`${settings}/shipping`);
  await merchant.getByLabel('Zone name').fill('United States');
  await merchant.getByLabel('Countries').fill('US');
  await merchant.getByRole('button', { name: 'Create zone' }).click();
  await expect(merchant.getByText('Zone created.')).toBeVisible();
  await merchant.locator('summary', { hasText: 'Add rate' }).click();
  await merchant.getByLabel('Name', { exact: true }).fill('Ground');
  await merchant.getByLabel('Price (USD)').fill('5');
  await merchant.getByRole('button', { name: 'Add rate' }).click();
  await expect(merchant.getByText('Ground · $5.00')).toBeVisible();

  // Tax: 10% in the US.
  await merchant.goto(`${settings}/taxes`);
  await merchant.getByLabel('Country').fill('US');
  await merchant.getByLabel('Name').fill('Sales tax');
  await merchant.getByLabel('Rate %').fill('10');
  await merchant.getByRole('button', { name: 'Save rate' }).click();
  await expect(merchant.getByRole('cell', { name: '10.00%' })).toBeVisible();

  // Discount: 10% off.
  await merchant.goto(`${ADMIN_URL}/s/${storeId}/discounts`);
  await merchant.getByLabel('Code').fill('welcome10');
  await merchant.getByLabel('Value').fill('10');
  await merchant.getByRole('button', { name: 'Create discount' }).click();
  await expect(merchant.getByRole('cell', { name: 'WELCOME10' })).toBeVisible();

  // Storefront shows the theme; checkout shows shipping, discount and tax.
  const shopper = await browser.newPage();
  await shopper.goto(storefrontUrl(subdomain));
  await expect(shopper.getByRole('heading', { name: 'Light up your desk' })).toBeVisible();
  await expect(shopper.getByText('Use code WELCOME10 for 10% off')).toBeVisible();

  await shopper.goto(storefrontUrl(subdomain, '/products/desk-lamp'));
  await shopper.getByRole('button', { name: 'Add to cart' }).click();
  await expect(shopper.getByText('Added to cart.')).toBeVisible();
  await shopper.goto(storefrontUrl(subdomain, '/checkout'));
  await expect(shopper.getByText('Ground')).toBeVisible();

  await shopper.getByLabel('Discount code').fill('welcome10');
  await shopper.getByRole('button', { name: 'Apply' }).click();
  await expect(shopper.getByText('Code WELCOME10 applied.')).toBeVisible();
  // $40 - $4 discount + $5 shipping + 10% tax on $36 ($3.60) = $44.60
  await expect(shopper.getByText('−$4.00')).toBeVisible();
  await expect(shopper.getByText('$3.60')).toBeVisible();
  await expect(shopper.getByText('$44.60')).toBeVisible();

  await shopper.getByLabel('Email', { exact: true }).fill('taxed@example.com');
  await shopper.getByLabel('Full name').fill('Pat Buyer');
  await shopper.getByLabel('Address', { exact: true }).fill('9 Lamp Rd');
  await shopper.getByLabel('City').fill('Lumen');
  await shopper.getByLabel('Postal code').fill('11111');
  await shopper.getByRole('button', { name: 'Continue to payment' }).click();
  await expect(shopper.getByText('$44.60')).toBeVisible();
  await shopper.getByRole('button', { name: 'Pay now (test card succeeds)' }).click();
  await expect(shopper.getByRole('heading', { name: 'Thank you for your order!' })).toBeVisible();
});
