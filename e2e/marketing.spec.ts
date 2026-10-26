import { expect, test } from '@playwright/test';
import { createStore, signUp, STOREFRONT_PORT, storefrontUrl } from './helpers';

const root = (path: string) => `http://localhost:${STOREFRONT_PORT}${path}`;

test('marketing site pages render on the root host and 404 on store hosts', async ({ page }) => {
  await page.goto(root('/features'));
  await page
    .getByRole('link', { name: /Checkout/ })
    .first()
    .click();
  await expect(page).toHaveURL(/\/features\/checkout$/);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

  await page.goto(root('/templates/beauty-classic'));
  await expect(page.getByRole('heading', { level: 1, name: /Velvet/ })).toBeVisible();
  await expect(
    page.getByRole('link', { name: /Start with this template/ }).first(),
  ).toHaveAttribute('href', /signup\?template=beauty-classic/);

  for (const path of ['/pricing', '/switch', '/security', '/guides', '/contact', '/about']) {
    const res = await page.goto(root(path));
    expect(res?.status(), path).toBe(200);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  }
  expect((await page.goto(root('/features/not-a-feature')))?.status()).toBe(404);
});

test('legal pages, the cookie notice and the platform sitemap', async ({ page }) => {
  await page.goto(root('/legal'));
  await expect(
    page.getByRole('heading', { level: 1, name: 'Policies, in plain language' }),
  ).toBeVisible();
  for (const slug of [
    'terms',
    'privacy',
    'cookies',
    'acceptable-use',
    'billing',
    'data-processing',
  ]) {
    const res = await page.goto(root(`/legal/${slug}`));
    expect(res?.status(), slug).toBe(200);
    await expect(page.getByRole('navigation', { name: 'On this page' })).toBeVisible();
  }
  // The cookie policy lists the real cookie names.
  await page.goto(root('/legal/cookies'));
  await expect(page.getByRole('cell', { name: 'cart_token' })).toBeVisible();
  expect((await page.goto(root('/legal/not-a-policy')))?.status()).toBe(404);

  // Only essential cookies, so the notice just informs; dismissing it sticks across pages.
  await page.goto(root('/'));
  const notice = page.getByRole('region', { name: 'Cookie notice' });
  await expect(notice).toBeVisible();
  await notice.getByRole('button', { name: 'OK' }).click();
  await expect(notice).toBeHidden();
  await page.goto(root('/pricing'));
  await expect(page.getByRole('region', { name: 'Cookie notice' })).toBeHidden();

  const sitemap = await (await page.goto(root('/sitemap.xml')))?.text();
  expect(sitemap).toContain('/legal/privacy');
  expect(sitemap).toContain('/features/checkout');
});

test('shoppers join a store newsletter from the homepage', async ({ browser }) => {
  const merchant = await browser.newPage();
  await signUp(merchant);
  const { subdomain } = await createStore(merchant, 'Letters Co', { payments: false });

  const shopper = await browser.newPage();
  expect((await shopper.goto(storefrontUrl(subdomain, '/features')))?.status()).toBe(404);
  await shopper.goto(storefrontUrl(subdomain));
  await shopper.getByLabel('Email address').fill('reader@example.com');
  await shopper.getByRole('button', { name: 'Subscribe' }).click();
  await expect(shopper.getByText('Thanks for subscribing!')).toBeVisible();
});
