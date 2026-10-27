import { expect, test } from '@playwright/test';
import { createStore, signUp, storefrontUrl } from './helpers';

test('merchant orders low stock from a supplier and receives it', async ({ page }) => {
  await signUp(page);
  await createStore(page, 'Supply Co', { payments: false });

  await page.getByRole('link', { name: 'Purchase orders' }).first().click();
  await page.getByRole('link', { name: 'Suppliers' }).click();
  await page.getByRole('link', { name: 'Add supplier' }).first().click();
  await page.getByLabel('Company name').fill('Clay Works');
  await page.getByLabel('Email').fill('orders@clay.example');
  await page.getByLabel('Lead time (days)').fill('7');
  await page.getByRole('button', { name: 'Add supplier' }).click();
  await expect(page.getByText('Supplier added.')).toBeVisible();

  await page.getByRole('link', { name: 'Products', exact: true }).first().click();
  await page.getByRole('link', { name: 'Add product' }).first().click();
  await page.getByLabel('Title', { exact: true }).fill('Mug');
  await page.getByLabel('Price for Default', { exact: true }).fill('12');
  await page.getByLabel('Starting stock for Default').fill('2');
  await page.getByLabel('Supplier').selectOption({ label: 'Clay Works' });
  await page.getByRole('button', { name: 'Create product' }).click();
  await expect(page.getByText('Product created.')).toBeVisible();

  await page.getByRole('link', { name: 'Purchase orders' }).first().click();
  await page.getByRole('link', { name: 'Create purchase order' }).first().click();
  await page.getByRole('button', { name: 'Add low-stock items' }).click();
  await expect(page.getByText('Added 1 low-stock item')).toBeVisible();
  await expect(page.getByLabel('Quantity of Mug')).toHaveValue('18');
  await page.getByLabel('Unit cost of Mug').fill('4.50');
  await expect(page.getByLabel('Expected arrival')).not.toHaveValue('');
  await page.getByRole('button', { name: 'Create draft' }).click();
  await expect(page.getByText('Purchase order saved.')).toBeVisible();
  await expect(page.getByRole('heading', { name: '#PO1' })).toBeVisible();

  await page.getByRole('button', { name: 'Mark as ordered' }).click();
  await expect(page.getByText('Marked as ordered.')).toBeVisible();
  await page.getByLabel('Units of Mug that arrived').fill('18');
  await page.getByLabel(/Update each product's cost per item/).check();
  await page.getByRole('button', { name: 'Receive stock' }).click();
  await expect(page.getByText('18 units added to stock at Main location.')).toBeVisible();
  await expect(page.getByText('Received', { exact: true }).first()).toBeVisible();

  await page.getByRole('link', { name: 'Inventory' }).first().click();
  await expect(page.getByRole('row', { name: /Mug/ })).toContainText('20');
});

test('merchant sells a personalised bundle and the shopper sees what is inside', async ({
  page,
  browser,
}) => {
  await signUp(page);
  const { subdomain } = await createStore(page, 'Tea Co', { payments: false });

  for (const [title, stock] of [
    ['Cup', '10'],
    ['Saucer', '3'],
  ] as const) {
    await page.getByRole('link', { name: 'Products', exact: true }).first().click();
    await page.getByRole('link', { name: 'Add product' }).first().click();
    await page.getByLabel('Title', { exact: true }).fill(title);
    await page.getByLabel('Price for Default', { exact: true }).fill('8');
    await page.getByLabel('Starting stock for Default').fill(stock);
    await page.getByRole('button', { name: 'Create product' }).click();
    await expect(page.getByText('Product created.')).toBeVisible();
  }

  await page.getByRole('link', { name: 'Products', exact: true }).first().click();
  await page.getByRole('link', { name: 'Add product' }).first().click();
  await page.getByLabel('Title', { exact: true }).fill('Tea set');
  await page.getByLabel('Status').selectOption('ACTIVE');
  await page.getByLabel('Sell as a bundle').check();
  await page.getByLabel('Price for Default', { exact: true }).fill('14');
  for (const item of ['Cup', 'Saucer']) {
    await page.getByRole('button', { name: 'Add item' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Search products').fill(item);
    await dialog.getByRole('button', { name: new RegExp(`^${item}`) }).click();
  }
  await expect(page.getByText('shoppers save $2.00')).toBeVisible();
  await expect(page.getByText('3 can be sold')).toBeVisible();

  await page.getByRole('button', { name: 'Add personalisation' }).click();
  await page.getByRole('button', { name: /^Text/ }).click();
  await page.getByLabel('Label', { exact: true }).fill('Gift note');
  await page.getByLabel('Extra price').fill('2');
  await page.getByRole('button', { name: 'Create product' }).click();
  await expect(page.getByText('Product created.')).toBeVisible();

  const shopper = await (await browser.newContext()).newPage();
  await shopper.goto(storefrontUrl(subdomain, '/products/tea-set'));
  await expect(shopper.getByRole('heading', { name: "What's inside" })).toBeVisible();
  await expect(shopper.getByText('Save $2.00 vs. buying separately')).toBeVisible();
  await shopper.getByLabel(/Gift note/).fill('Happy birthday');
  await expect(shopper.getByText('Includes $2.00 for personalisation.')).toBeVisible();
  await shopper.getByRole('button', { name: 'Add to cart' }).first().click();
  await expect(shopper.getByText('Added to cart.')).toBeVisible();
  await shopper.goto(storefrontUrl(subdomain, '/cart'));
  await expect(shopper.getByText('Happy birthday')).toBeVisible();
  await expect(shopper.getByText('$16.00 each')).toBeVisible();
});
