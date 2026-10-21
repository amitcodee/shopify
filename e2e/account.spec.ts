import { expect, test } from '@playwright/test';
import { createStore, signUp, storefrontUrl } from './helpers';

test('customer registers, buys while signed in, sees order history, signs out and back in', async ({
  browser,
}) => {
  const merchant = await browser.newPage();
  await signUp(merchant);
  const { subdomain } = await createStore(merchant, 'Account Co');
  await merchant.getByRole('link', { name: 'Products', exact: true }).click();
  await merchant.getByRole('link', { name: 'Add product' }).first().click();
  await merchant.getByLabel('Title', { exact: true }).fill('Notebook');
  await merchant.getByLabel('Status', { exact: true }).selectOption('ACTIVE');
  await merchant.getByLabel('Price for Default', { exact: true }).fill('9.50');
  await merchant.getByLabel('Starting stock for Default').fill('5');
  await merchant.getByRole('button', { name: 'Create product' }).click();
  await expect(merchant.getByText('Product created.')).toBeVisible();

  const shopper = await browser.newPage();
  await shopper.goto(storefrontUrl(subdomain, '/account/register'));
  await shopper.getByLabel('Name', { exact: true }).fill('Casey Customer');
  await shopper.getByLabel('Email', { exact: true }).fill('casey@example.com');
  await shopper.getByLabel('Password', { exact: true }).fill('casey-password-123');
  await shopper.getByRole('button', { name: 'Create account' }).click();
  await expect(shopper.getByRole('heading', { name: 'Your account' })).toBeVisible();
  await expect(shopper.getByText('You haven’t placed any orders yet.')).toBeVisible();

  // Buy while signed in: the email is prefilled and locked.
  await shopper.goto(storefrontUrl(subdomain, '/products/notebook'));
  await shopper.getByRole('button', { name: 'Add to cart' }).click();
  await expect(shopper.getByText('Added to cart.')).toBeVisible();
  await shopper.goto(storefrontUrl(subdomain, '/checkout'));
  await expect(shopper.getByLabel('Email', { exact: true })).toHaveValue('casey@example.com');
  await shopper.getByLabel('Full name').fill('Casey Customer');
  await shopper.getByLabel('Address', { exact: true }).fill('5 Paper Lane');
  await shopper.getByLabel('City').fill('Inkville');
  await shopper.getByLabel('Postal code').fill('54321');
  await shopper.getByRole('button', { name: 'Continue to payment' }).click();
  await shopper.getByRole('button', { name: 'Pay now (test card succeeds)' }).click();
  await expect(shopper.getByRole('heading', { name: 'Thank you for your order!' })).toBeVisible();

  await shopper.getByRole('link', { name: 'Account', exact: true }).click();
  await expect(shopper.getByRole('link', { name: /Order #1001/ })).toContainText('$9.50');
  await shopper.getByRole('link', { name: /Order #1001/ }).click();
  await expect(shopper.getByRole('heading', { name: 'Order #1001' })).toBeVisible();

  // Ask for a return; the store approves it and refunds on receipt.
  await shopper.getByLabel('Quantity of Notebook to return').selectOption('1');
  await shopper.getByLabel('Reason for returning Notebook').selectOption('DAMAGED');
  await shopper.getByRole('button', { name: 'Request a return' }).click();
  await expect(shopper.getByText('Requested — waiting for the store')).toBeVisible();

  await merchant.getByRole('link', { name: 'Orders', exact: true }).first().click();
  await merchant.getByRole('link', { name: 'Returns' }).click();
  await merchant.getByRole('link', { name: '#1001' }).click();
  await merchant.getByRole('button', { name: 'Approve return' }).click();
  await expect(merchant.getByRole('button', { name: 'Receive and refund' })).toBeVisible();
  await expect(merchant.getByLabel('Refund (USD)')).toHaveValue('9.50');
  await merchant.getByRole('button', { name: 'Receive and refund' }).click();
  await expect(merchant.getByText('closed', { exact: true })).toBeVisible();
  await expect(merchant.getByText('Refunded', { exact: true }).first()).toBeVisible();
  await shopper.reload();
  await expect(shopper.getByText('Received and closed')).toBeVisible();

  await shopper.getByRole('link', { name: 'Account', exact: true }).click();
  await shopper.getByRole('button', { name: 'Sign out' }).click();
  await expect(shopper.getByRole('heading', { name: 'New in' })).toBeVisible();

  await shopper.goto(storefrontUrl(subdomain, '/account'));
  await expect(shopper.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  await shopper.getByLabel('Email', { exact: true }).fill('casey@example.com');
  await shopper.getByLabel('Password', { exact: true }).fill('casey-password-123');
  await shopper.getByRole('button', { name: 'Sign in' }).click();
  await expect(shopper.getByRole('heading', { name: 'Your account' })).toBeVisible();
});
