import { expect, test } from '@playwright/test';
import { createStore, signUp, storefrontUrl } from './helpers';

test('shopper checks out and pays in the sandbox; merchant fulfils and refunds', async ({
  browser,
}) => {
  const merchant = await browser.newPage();
  await signUp(merchant);
  const { subdomain, storeId } = await createStore(merchant, 'Checkout Co');
  await merchant.getByRole('link', { name: 'Products', exact: true }).click();
  await merchant.getByRole('link', { name: 'Add product' }).first().click();
  await merchant.getByLabel('Title', { exact: true }).fill('Ceramic Mug');
  await merchant.getByLabel('Status', { exact: true }).selectOption('ACTIVE');
  await merchant.getByLabel('Price for Default', { exact: true }).fill('18');
  await merchant.getByLabel('Starting stock for Default').fill('10');
  await merchant.getByRole('button', { name: 'Create product' }).click();
  await expect(merchant.getByText('Product created.')).toBeVisible();

  // Shopper buys two mugs.
  const shopper = await browser.newPage();
  await shopper.goto(storefrontUrl(subdomain, '/products/ceramic-mug'));
  await shopper.getByLabel('Quantity').fill('2');
  await shopper.getByRole('button', { name: 'Add to cart' }).click();
  await expect(shopper.getByText('Added to cart.')).toBeVisible();
  await shopper.goto(storefrontUrl(subdomain, '/cart'));
  await shopper.getByRole('link', { name: 'Check out' }).click();

  await expect(shopper.getByRole('heading', { name: 'Checkout' })).toBeVisible();
  await shopper.getByLabel('Email').fill('buyer@example.com');
  await shopper.getByLabel('Full name').fill('Buyer One');
  await shopper.getByLabel('Address', { exact: true }).fill('10 Market St');
  await shopper.getByLabel('City').fill('Springfield');
  await shopper.getByLabel('Postal code').fill('12345');
  await expect(shopper.getByText('$36.00').last()).toBeVisible();
  await shopper.getByRole('button', { name: 'Continue to payment' }).click();

  await expect(shopper).toHaveURL(/\/checkout\/pay\/mockpay_/);
  // Sandbox payment page, then the order status page.
  await expect(shopper.getByText('Sandbox payment · no real money')).toBeVisible();
  await expect(shopper.getByText('Order #1001')).toBeVisible();
  await shopper.getByRole('button', { name: 'Pay now (test card succeeds)' }).click();
  await expect(shopper.getByRole('heading', { name: 'Thank you for your order!' })).toBeVisible();
  await expect(shopper.getByText('Confirmed — preparing your order')).toBeVisible();
  await expect(shopper.getByRole('link', { name: 'Cart (0)' })).toBeVisible();

  // Merchant sees the paid order, fulfils it, and refunds part of it.
  await merchant.goto(`http://localhost:3110/s/${storeId}/orders`);
  await expect(merchant.getByRole('row', { name: /#1001/ })).toContainText('Paid');
  await merchant.getByRole('link', { name: '#1001' }).click();
  await merchant.getByLabel('Carrier').fill('UPS');
  await merchant.getByLabel('Tracking number').fill('1Z42');
  await merchant.getByRole('button', { name: 'Mark as fulfilled' }).click();
  await expect(merchant.getByText('Order fulfilled.')).toBeVisible();

  await merchant.getByLabel('Amount (USD)').fill('18.00');
  await merchant.getByLabel('Reason (optional)').fill('One mug arrived chipped');
  await merchant.getByRole('button', { name: 'Refund' }).click();
  await expect(merchant.getByText('Refund issued.')).toBeVisible();
  await expect(merchant.getByText('Partially refunded').first()).toBeVisible();

  // The customer's bank disputes the charge (sandbox).
  await merchant.getByRole('button', { name: 'Simulate chargeback' }).click();
  await expect(merchant.getByText(/opened a chargeback on this order/)).toBeVisible();
  await expect(merchant.getByText('Needs response')).toBeVisible();

  // The dashboard reflects the sale.
  await merchant.getByRole('link', { name: 'Overview' }).click();
  await expect(merchant.getByText('Net sales (30d)')).toBeVisible();
  await expect(merchant.getByText('A customer disputed a payment.')).toBeVisible();
  await expect(merchant.getByText('$18.00').first()).toBeVisible();

  // Shopper's status page now shows the shipment.
  await shopper.reload();
  await expect(shopper.getByText(/Shipped with UPS · tracking 1Z42/)).toBeVisible();
});
