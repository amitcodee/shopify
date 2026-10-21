import { expect, test } from '@playwright/test';
import { createStore, signUp, storefrontUrl } from './helpers';

test('merchant issues a gift card and a shopper pays a whole order with it', async ({
  browser,
}) => {
  const merchant = await browser.newPage();
  await signUp(merchant);
  const { subdomain } = await createStore(merchant, 'Gift Co', { payments: false });
  await merchant.getByRole('link', { name: 'Products', exact: true }).click();
  await merchant.getByRole('link', { name: 'Add product' }).first().click();
  await merchant.getByLabel('Title', { exact: true }).fill('Candle');
  await merchant.getByLabel('Status', { exact: true }).selectOption('ACTIVE');
  await merchant.getByLabel('Price for Default', { exact: true }).fill('12');
  await merchant.getByLabel('Starting stock for Default').fill('10');
  await merchant.getByRole('button', { name: 'Create product' }).click();
  await expect(merchant.getByText('Product created.')).toBeVisible();

  await merchant.getByRole('link', { name: 'Gift cards' }).click();
  await merchant.getByLabel('Value (USD)').fill('50');
  await merchant.getByRole('button', { name: 'Issue gift card' }).click();
  const issued = merchant.getByText(/Gift card issued\. Code: /);
  await expect(issued).toBeVisible();
  const code = /Code: ([A-Z0-9-]+)/.exec((await issued.textContent()) ?? '')?.[1] ?? '';
  expect(code).toMatch(/^[A-Z0-9]{4}(-[A-Z0-9]{4}){3}$/);
  await expect(merchant.getByRole('link', { name: `•••• ${code.slice(-4)}` })).toBeVisible();

  // The store has no payment provider, yet a fully covered order can still be placed.
  const shopper = await browser.newPage();
  await shopper.goto(storefrontUrl(subdomain, '/products/candle'));
  await shopper.getByRole('button', { name: 'Add to cart' }).click();
  await expect(shopper.getByText('Added to cart.')).toBeVisible();
  await shopper.goto(storefrontUrl(subdomain, '/checkout'));
  await shopper.getByLabel('Email').fill('buyer@example.com');
  await shopper.getByLabel('Full name').fill('Buyer One');
  await shopper.getByLabel('Address', { exact: true }).fill('10 Market St');
  await shopper.getByLabel('City').fill('Springfield');
  await shopper.getByLabel('Postal code').fill('12345');
  await shopper.getByLabel('Gift card', { exact: true }).fill(code.toLowerCase());
  await shopper.getByRole('button', { name: 'Apply gift card' }).click();
  await expect(shopper.getByText(/\$38\.00 left on the card/)).toBeVisible();
  await shopper.getByRole('button', { name: 'Place order' }).click();

  await expect(shopper.getByText('Order #1001')).toBeVisible();
  await expect(shopper.getByText('Paid with gift card')).toBeVisible();

  await merchant.reload();
  await expect(merchant.getByRole('row', { name: new RegExp(code.slice(-4)) })).toContainText(
    '$38.00',
  );
});
