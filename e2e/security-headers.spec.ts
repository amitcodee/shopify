import { expect, type Page, test } from '@playwright/test';
import { ADMIN_URL, createStore, signUp, storefrontUrl } from './helpers';

function watchCsp(page: Page): string[] {
  const violations: string[] = [];
  page.on('console', (message) => {
    if (/Content Security Policy|Refused to (execute|load|apply)/i.test(message.text())) {
      violations.push(message.text());
    }
  });
  return violations;
}

test('admin and storefront send a nonce-based CSP and security headers without breaking pages', async ({
  browser,
}) => {
  const admin = await browser.newPage();
  const adminViolations = watchCsp(admin);
  const loginResponse = await admin.goto(`${ADMIN_URL}/login`);
  const adminHeaders = loginResponse?.headers() ?? {};
  expect(adminHeaders['content-security-policy']).toMatch(
    /script-src 'self' 'nonce-[^']+' 'strict-dynamic'/,
  );
  expect(adminHeaders['content-security-policy']).toContain("frame-ancestors 'none'");
  expect(adminHeaders['x-frame-options']).toBe('DENY');
  expect(adminHeaders['x-content-type-options']).toBe('nosniff');
  expect(adminHeaders['x-powered-by']).toBeUndefined();

  // Exercise interactive pages (client components, server actions) under the policy.
  await signUp(admin);
  const { subdomain } = await createStore(admin, 'CSP Co');
  await admin.getByRole('link', { name: 'Products', exact: true }).click();
  await admin.getByRole('link', { name: 'Add product' }).first().click();
  await admin.getByLabel('Title', { exact: true }).fill('Lamp');
  await admin.getByLabel('Status', { exact: true }).selectOption('ACTIVE');
  await admin.getByLabel('Price for Default', { exact: true }).fill('10');
  await admin.getByLabel('Starting stock for Default').fill('5');
  await admin.getByRole('button', { name: 'Create product' }).click();
  await expect(admin.getByText('Product created.')).toBeVisible();

  const shopper = await browser.newPage();
  const shopperViolations = watchCsp(shopper);
  const home = await shopper.goto(storefrontUrl(subdomain));
  expect(home?.headers()['content-security-policy']).toMatch(/'nonce-[^']+'/);
  await shopper.goto(storefrontUrl(subdomain, '/products/lamp'));
  await shopper.getByRole('button', { name: 'Add to cart' }).click();
  await expect(shopper.getByText('Added to cart.')).toBeVisible();

  expect(adminViolations).toEqual([]);
  expect(shopperViolations).toEqual([]);
});
