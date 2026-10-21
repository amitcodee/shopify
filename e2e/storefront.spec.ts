import { expect, test } from '@playwright/test';
import { createStore, signUp, storefrontUrl } from './helpers';

test('shopper browses a store by subdomain, searches, and manages the cart', async ({
  browser,
}) => {
  // Merchant sets up a store with one active product.
  const merchant = await browser.newPage();
  await signUp(merchant);
  const { subdomain } = await createStore(merchant, 'Sunny Shop');
  await merchant.getByRole('link', { name: 'Products', exact: true }).click();
  await merchant.getByRole('link', { name: 'Add product' }).first().click();
  await merchant.getByLabel('Title', { exact: true }).fill('Straw Hat');
  await merchant
    .getByLabel('Description', { exact: true })
    .fill('Keeps the sun off.\n\nHand woven.');
  await merchant.getByLabel('Status', { exact: true }).selectOption('ACTIVE');
  await merchant.getByRole('button', { name: 'Add option' }).click();
  await merchant.getByLabel('Option name').fill('Size');
  await merchant.getByLabel('Values (comma separated)').fill('S, L');
  await merchant.getByLabel('Price for S', { exact: true }).fill('25');
  await merchant.getByLabel('Starting stock for S').fill('3');
  await merchant.getByLabel('Price for L', { exact: true }).fill('27.50');
  await merchant.getByLabel('Starting stock for L').fill('0');
  await merchant.getByRole('button', { name: 'Create product' }).click();
  await expect(merchant.getByText('Product created.')).toBeVisible();

  // Shopper visits the store's own subdomain.
  const shopper = await browser.newPage();
  await shopper.goto(storefrontUrl(subdomain));
  await expect(shopper.getByRole('link', { name: 'Sunny Shop' })).toBeVisible();
  await expect(shopper.getByRole('link', { name: /Straw Hat/ })).toBeVisible();

  // Search finds it by prefix.
  await shopper.getByRole('searchbox', { name: 'Search products' }).first().fill('stra');
  await shopper.keyboard.press('Enter');
  await expect(shopper.getByText('1 result for “stra”')).toBeVisible();
  await shopper.getByRole('link', { name: /Straw Hat/ }).click();

  // Product page: L is sold out, S can be added.
  await expect(shopper.getByRole('heading', { name: 'Straw Hat' })).toBeVisible();
  await expect(shopper.getByText('Hand woven.')).toBeVisible();
  await shopper.getByText('L', { exact: true }).click();
  await expect(shopper.getByRole('button', { name: 'Sold out' })).toBeDisabled();
  await shopper.getByText('S', { exact: true }).click();
  await expect(shopper.getByText('$25.00')).toBeVisible();
  await shopper.getByLabel('Quantity').fill('2');
  await shopper.getByRole('button', { name: 'Add to cart' }).click();
  await expect(shopper.getByText('Added to cart.')).toBeVisible();
  await expect(shopper.getByRole('link', { name: 'Cart (2)' })).toBeVisible();

  // Asking for more than stock is refused with a clear message.
  await shopper.getByLabel('Quantity').fill('2');
  await shopper.getByRole('button', { name: 'Add to cart' }).click();
  await expect(shopper.getByText('Only 3 left in stock.')).toBeVisible();

  // Cart page: update quantity, see subtotal.
  await shopper.getByRole('link', { name: 'Cart (2)' }).click();
  await expect(shopper.getByRole('heading', { name: 'Your cart' })).toBeVisible();
  await shopper.getByLabel('Qty').fill('3');
  await shopper.getByRole('button', { name: 'Update' }).click();
  await expect(shopper.getByText('$75.00').first()).toBeVisible();
  await shopper.getByRole('button', { name: 'Remove' }).click();
  await expect(shopper.getByRole('heading', { name: 'Your cart is empty' })).toBeVisible();

  // An expired or forged abandoned-checkout link lands on the cart with an explanation.
  await shopper.goto(
    storefrontUrl(subdomain, '/cart/recover/00000000-0000-7000-8000-000000000000.forged-token'),
  );
  await expect(shopper).toHaveURL(/\/cart\?recovery=expired$/);
  await expect(shopper.getByText('That link has expired')).toBeVisible();

  // Crawlers get absolute URLs for the store's own host.
  const sitemap = await shopper.goto(storefrontUrl(subdomain, '/sitemap.xml'));
  expect(sitemap?.ok()).toBe(true);
  expect(await sitemap?.text()).toContain(storefrontUrl(subdomain, '/collections/all'));
  const robots = await (await shopper.goto(storefrontUrl(subdomain, '/robots.txt')))?.text();
  expect(robots).toContain('Disallow: /checkout');
  expect(robots).toContain(`Sitemap: ${storefrontUrl(subdomain, '/sitemap.xml')}`);

  // Unknown subdomains show a not-found page; the bare domain shows the platform landing.
  await shopper.goto(storefrontUrl('no-such-store'));
  await expect(shopper.getByRole('heading', { name: 'Store not found' })).toBeVisible();
  await shopper.goto('http://localhost:3210/');
  await expect(shopper.getByRole('heading', { name: 'Start your online store' })).toBeVisible();
});
