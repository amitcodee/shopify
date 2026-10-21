import { expect, test } from '@playwright/test';
import { createStore, signUp } from './helpers';

test('merchant creates a customer segment and edits its conditions', async ({ page }) => {
  await signUp(page);
  await createStore(page, 'Segment Co', { payments: false });
  await page.getByRole('link', { name: 'Customers' }).first().click();
  await page.getByRole('link', { name: 'Segments' }).click();
  await page.getByRole('link', { name: 'Create segment' }).click();

  await page.getByLabel('Segment name').fill('Repeat buyers');
  await page.getByLabel('Condition 1 field').selectOption('ordersCount');
  await page.getByLabel('Condition 1 comparison').selectOption('gte');
  await page.getByLabel('Condition 1 value').fill('2');
  await page.getByRole('button', { name: 'Create segment' }).click();

  await expect(page.getByRole('heading', { name: 'Repeat buyers' })).toBeVisible();
  await expect(page.getByText('0 customer(s) match right now.')).toBeVisible();

  await page.getByLabel('Condition 2 field').selectOption('totalSpent');
  await page.getByLabel('Condition 2 value').fill('abc');
  await page.getByRole('button', { name: 'Save segment' }).click();
  await expect(page.getByText('Condition 2: enter a whole number or amount.')).toBeVisible();
  await expect(page.getByLabel('Condition 2 value')).toHaveValue('abc'); // kept after the error

  await page.getByRole('link', { name: 'Segments' }).click();
  await expect(page.getByRole('row', { name: /Repeat buyers/ })).toContainText(
    'Number of paid orders ≥ 2',
  );
});
