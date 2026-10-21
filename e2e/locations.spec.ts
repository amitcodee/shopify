import { expect, test } from '@playwright/test';
import { createStore, signUp } from './helpers';

test('merchant adds a location, stocks it and moves stock between locations', async ({ page }) => {
  await signUp(page);
  await createStore(page, 'Two Sites Co', { payments: false });
  await page.getByRole('link', { name: 'Products', exact: true }).click();
  await page.getByRole('link', { name: 'Add product' }).first().click();
  await page.getByLabel('Title', { exact: true }).fill('Crate');
  await page.getByLabel('Price for Default', { exact: true }).fill('20');
  await page.getByLabel('Starting stock for Default').fill('6');
  await page.getByRole('button', { name: 'Create product' }).click();
  await expect(page.getByText('Product created.')).toBeVisible();

  await page.getByRole('link', { name: 'Settings' }).first().click();
  await page.getByRole('link', { name: 'Locations' }).click();
  await expect(page.getByText('6 unit(s) on hand')).toBeVisible();
  const add = page
    .locator('form')
    .filter({ has: page.getByRole('button', { name: 'Add location' }) });
  await add.getByLabel('Name').fill('Warehouse');
  await add.getByLabel('Address').fill('9 Dock Road');
  await add.getByRole('button', { name: 'Add location' }).click();
  await expect(page.getByRole('heading', { name: 'Warehouse' })).toBeVisible();

  await page.getByRole('link', { name: 'Inventory' }).first().click();
  const row = page.getByRole('row', { name: /Crate/ });
  await expect(row).toContainText('Main location: 6');
  await row.getByText('Move stock').click();
  await row
    .getByLabel('Move from location for Crate Default')
    .selectOption({ label: 'from Main location' });
  await row
    .getByLabel('Move to location for Crate Default')
    .selectOption({ label: 'to Warehouse' });
  await row.getByLabel('Units to move for Crate Default').fill('2');
  await row.getByRole('button', { name: 'Move' }).click();
  await expect(page.getByRole('row', { name: /Crate/ })).toContainText('Warehouse: 2');
  await expect(page.getByRole('row', { name: /Crate/ })).toContainText('Main location: 4');
});
