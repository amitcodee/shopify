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

  for (const path of ['/pricing', '/switch', '/security', '/guides', '/contact']) {
    const res = await page.goto(root(path));
    expect(res?.status(), path).toBe(200);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  }
  expect((await page.goto(root('/features/not-a-feature')))?.status()).toBe(404);
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
