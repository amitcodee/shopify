import { expect, test } from '@playwright/test';
import { ADMIN_URL, createStore, signUp, storefrontUrl } from './helpers';

test('merchant turns on cash on delivery; shopper orders with it; merchant records the cash', async ({
  browser,
}) => {
  const merchant = await browser.newPage();
  await signUp(merchant);
  const { subdomain, storeId } = await createStore(merchant, 'Cash Co');
  await merchant.getByRole('link', { name: 'Products', exact: true }).click();
  await merchant.getByRole('link', { name: 'Add product' }).first().click();
  await merchant.getByLabel('Title', { exact: true }).fill('Ceramic Mug');
  await merchant.getByLabel('Status', { exact: true }).selectOption('ACTIVE');
  await merchant.getByLabel('Price for Default', { exact: true }).fill('18');
  await merchant.getByLabel('Starting stock for Default').fill('10');
  await merchant.getByRole('button', { name: 'Create product' }).click();
  await expect(merchant.getByText('Product created.')).toBeVisible();

  await merchant.goto(`${ADMIN_URL}/s/${storeId}/settings/payments`);
  await merchant.getByLabel('Offer cash on delivery').check();
  await merchant.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(merchant.getByText('Cash on delivery settings saved.')).toBeVisible();

  const shopper = await browser.newPage();
  await shopper.goto(storefrontUrl(subdomain, '/products/ceramic-mug'));
  await shopper.getByRole('button', { name: 'Add to cart' }).click();
  await expect(shopper.getByText('Added to cart.')).toBeVisible();
  await shopper.goto(storefrontUrl(subdomain, '/cart'));
  await shopper.getByRole('link', { name: 'Check out' }).click();

  await shopper.getByLabel('Email').fill('buyer@example.com');
  await shopper.getByLabel('Full name').fill('Buyer One');
  await shopper.getByLabel('Address', { exact: true }).fill('10 Market St');
  await shopper.getByLabel('City').fill('Springfield');
  await shopper.getByLabel('Postal code').fill('12345');
  await shopper.getByRole('radio', { name: /Cash on delivery/ }).check();
  await shopper.getByLabel('Phone').fill('5551234567');
  await shopper.getByRole('button', { name: 'Place order' }).click();

  await expect(shopper.getByRole('heading', { name: 'Thank you for your order!' })).toBeVisible();
  await expect(shopper.getByText('Confirmed — pay in cash on delivery')).toBeVisible();

  await merchant.goto(`${ADMIN_URL}/s/${storeId}/orders`);
  await merchant.getByRole('link', { name: '#1001' }).click();
  await expect(merchant.getByText('Cash on delivery').first()).toBeVisible();
  await merchant.getByRole('button', { name: 'Cash received' }).click();
  await expect(merchant.getByRole('button', { name: 'Cash received' })).toHaveCount(0);
  await expect(merchant.getByText('Cash collected on delivery.')).toBeVisible();
  await expect(merchant.getByText('Paid', { exact: true }).first()).toBeVisible();
});

test('Connect opens the gateway keys page and the keys form in one click', async ({ browser }) => {
  const context = await browser.newContext();
  const merchant = await context.newPage();
  await signUp(merchant);
  const { storeId } = await createStore(merchant, 'Connect Co', { payments: false });
  await merchant.goto(`${ADMIN_URL}/s/${storeId}/settings/payments`);
  // No real gateway is contacted: the new tab's request is answered here.
  await context.route('https://dashboard.razorpay.com/**', (route) =>
    route.fulfill({ contentType: 'text/html', body: '<title>Razorpay keys</title>' }),
  );

  const opened = context.waitForEvent('page');
  await merchant.getByRole('button', { name: 'Connect Razorpay' }).click();
  const tab = await opened;
  await expect.poll(() => tab.url()).toContain('dashboard.razorpay.com/app/keys');
  const keyId = merchant.getByLabel('Key ID');
  await expect(keyId).toBeVisible();
  // The browser must not fill the admin login into gateway fields.
  await expect(keyId).toHaveAttribute('autocomplete', 'one-time-code');
  await expect(merchant.getByLabel('Key secret')).toHaveAttribute('autocomplete', 'new-password');
  await expect(merchant.getByRole('button', { name: 'Verify and connect' })).toBeVisible();
});
