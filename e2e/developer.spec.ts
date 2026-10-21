import { expect, test } from '@playwright/test';
import { createStore, signUp } from './helpers';

test('merchant creates an API token and a webhook, each secret shown once', async ({ page }) => {
  await signUp(page);
  await createStore(page, 'Dev Co', { payments: false });

  await page.getByRole('link', { name: 'Settings' }).first().click();
  await page.getByRole('link', { name: 'Developer' }).click();

  await page.getByLabel('Token name').fill('ERP sync');
  await page.getByLabel('products:read').check();
  await page.getByRole('button', { name: 'Create token' }).click();
  const created = page.getByText(/Token created: cpat_/);
  await expect(created).toBeVisible();
  const token = /(cpat_[A-Za-z0-9_-]+)/.exec((await created.textContent()) ?? '')?.[1] ?? '';
  await expect(page.getByRole('row', { name: /ERP sync/ })).toContainText(token.slice(0, 12));

  await page.getByLabel('Event').selectOption('orders/paid');
  await page.getByLabel('URL').fill('https://hooks.example.com/orders');
  await page.getByRole('button', { name: 'Add webhook' }).click();
  await expect(page.getByText(/Webhook added\. Signing secret: /)).toBeVisible();
  await expect(page.getByText('https://hooks.example.com/orders')).toBeVisible();

  await page.reload();
  await expect(page.getByText(token)).toHaveCount(0); // never shown again
});
