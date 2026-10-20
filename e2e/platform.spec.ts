import { execFileSync } from 'node:child_process';
import { expect, test } from '@playwright/test';
import { ADMIN_URL, createStore, signUp, storefrontUrl } from './helpers';

test('merchant upgrades their plan; platform admin suspends and reactivates the store', async ({
  browser,
}) => {
  // Merchant upgrades from Starter to Growth (sandbox billing).
  const merchant = await browser.newPage();
  await signUp(merchant, 'Plan Merchant');
  const { subdomain, storeId } = await createStore(merchant, 'Plan Store');
  await merchant.goto(`${ADMIN_URL}/s/${storeId}/settings/billing`);
  await expect(merchant.getByRole('heading', { name: 'Starter plan' })).toBeVisible();
  await merchant.getByRole('button', { name: 'Switch to Growth' }).click();
  await expect(merchant.getByRole('heading', { name: 'Growth plan' })).toBeVisible();
  await expect(merchant.getByRole('cell', { name: '$29.00' })).toBeVisible();

  // A super-admin manages the platform.
  const adminPage = await browser.newPage();
  const { email } = await signUp(adminPage, 'Platform Admin');
  execFileSync(process.execPath, ['scripts/make-platform-admin.js', email], { cwd: 'packages/db' });
  await adminPage.goto(`${ADMIN_URL}/platform`);
  await expect(adminPage.getByRole('heading', { name: 'Platform overview' })).toBeVisible();
  await expect(adminPage.getByText('$29.00')).toBeVisible(); // MRR includes the Growth store

  await adminPage.getByRole('link', { name: 'Stores' }).click();
  const row = adminPage.getByRole('row', { name: /Plan Store/ });
  await expect(row).toContainText('Growth');
  await row.getByText('Suspend…').click();
  await row.getByLabel('Reason').fill('Policy review');
  await row.getByRole('button', { name: 'Suspend store' }).click();
  await expect(adminPage.getByRole('row', { name: /Plan Store/ })).toContainText('Policy review');

  const shopper = await browser.newPage();
  await shopper.goto(storefrontUrl(subdomain));
  await expect(shopper.getByRole('heading', { name: 'Store not found' })).toBeVisible();

  await merchant.goto(`${ADMIN_URL}/s/${storeId}`);
  await expect(merchant.getByText(/This store is suspended by the platform/)).toBeVisible();
  await expect(merchant.getByText(/Contact support@example.com/)).toBeVisible();

  await adminPage.reload();
  await adminPage
    .getByRole('row', { name: /Plan Store/ })
    .getByRole('button', { name: 'Reactivate' })
    .click();
  await expect(adminPage.getByRole('row', { name: /Plan Store/ })).toContainText('Active');
  await shopper.reload();
  await expect(shopper.getByRole('link', { name: 'Plan Store' })).toBeVisible();

  await adminPage.getByRole('link', { name: 'Audit log' }).click();
  await expect(adminPage.getByText('store.suspended')).toBeVisible();
  await expect(adminPage.getByText('store.reactivated')).toBeVisible();

  // Regular merchants cannot open the platform console.
  await merchant.goto(`${ADMIN_URL}/platform`);
  await expect(merchant.getByRole('heading', { name: 'Not found' })).toBeVisible();
});
