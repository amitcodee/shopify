import { expect, test } from '@playwright/test';
import { createStore, signUp, storefrontUrl } from './helpers';

test('merchant publishes a page and a policy and links them from the storefront menus', async ({
  page,
  browser,
}) => {
  await signUp(page);
  const { subdomain } = await createStore(page, 'Content Co', { payments: false });

  await page.getByRole('link', { name: 'Online store' }).first().click();
  await page.getByRole('link', { name: 'Add page' }).click();
  await page.getByLabel('Title', { exact: true }).fill('About us');
  await page.getByLabel('Content').fill('We roast coffee.\n\nFounded in 2021.');
  await page.getByRole('button', { name: 'Create page' }).click();
  await expect(page).toHaveURL(/\/online-store\/pages\/[0-9a-f-]{36}$/);
  await expect(page.getByLabel('URL handle')).toHaveValue('about-us');

  await page.getByRole('link', { name: 'Policies' }).click();
  await page.getByLabel('Refund policy').fill('Returns within 30 days.');
  await page
    .locator('form')
    .filter({ has: page.getByLabel('Refund policy') })
    .getByRole('button', { name: 'Save' })
    .click();
  await expect(page.getByText('Policy saved.')).toBeVisible();

  await page.getByRole('link', { name: 'Navigation' }).click();
  const main = page
    .locator('form')
    .filter({ has: page.getByRole('group', { name: 'Main menu links' }) });
  await main.getByLabel('Label of link 1').fill('Our story');
  await main.getByLabel('Destination of link 1').selectOption('page:about-us');
  await main.getByLabel('Label of link 2').fill('Everything');
  await main.getByLabel('Destination of link 2').selectOption('catalog');
  await main.getByRole('button', { name: 'Save main menu' }).click();
  await expect(page.getByText('Menu saved.')).toBeVisible();

  const shopper = await browser.newPage();
  await shopper.goto(storefrontUrl(subdomain));
  const header = shopper.getByRole('navigation', { name: 'Main' });
  await expect(header.getByRole('link')).toHaveText(['Our story', 'Everything']);
  await header.getByRole('link', { name: 'Our story' }).click();
  await expect(shopper.getByRole('heading', { name: 'About us' })).toBeVisible();
  await expect(shopper.getByText('Founded in 2021.')).toBeVisible();

  await shopper
    .getByRole('navigation', { name: 'Footer' })
    .getByRole('link', { name: 'Refund policy' })
    .click();
  await expect(shopper).toHaveURL(/\/policies\/refund$/);
  await expect(shopper.getByText('Returns within 30 days.')).toBeVisible();
});

test('a password-protected store shows a password page until the visitor enters it', async ({
  page,
  browser,
}) => {
  await signUp(page);
  const { subdomain } = await createStore(page, 'Soon Co', { payments: false });
  await page.getByRole('link', { name: 'Online store' }).first().click();
  await page.getByRole('link', { name: 'Password' }).click();
  await page.getByLabel('Require a password to visit the storefront').check();
  await page.getByLabel('Password', { exact: true }).fill('let-me-in');
  await page.getByLabel('Message for visitors').fill('Launching next week.');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Saved.')).toBeVisible();

  const visitor = await browser.newPage();
  await visitor.goto(storefrontUrl(subdomain, '/collections/all'));
  await expect(visitor.getByText('Launching next week.')).toBeVisible();
  await expect(visitor.getByRole('navigation', { name: 'Main' })).toHaveCount(0);
  await visitor.getByLabel('Password').fill('nope');
  await visitor.getByRole('button', { name: 'Enter store' }).click();
  await expect(visitor.getByText('That password is not right.')).toBeVisible();
  await visitor.getByLabel('Password').fill('let-me-in');
  await visitor.getByRole('button', { name: 'Enter store' }).click();
  await expect(visitor.getByRole('navigation', { name: 'Main' })).toBeVisible();
  await visitor.goto(storefrontUrl(subdomain, '/collections/all'));
  await expect(visitor.getByRole('heading', { name: 'All products' })).toBeVisible();
});

test('merchant publishes a blog post that shoppers can read', async ({ page, browser }) => {
  await signUp(page);
  const { subdomain } = await createStore(page, 'Journal Co', { payments: false });
  await page.getByRole('link', { name: 'Online store' }).first().click();
  await page.getByRole('link', { name: 'Blog' }).click();
  await page.getByRole('link', { name: 'Write post' }).click();
  await page.getByLabel('Title', { exact: true }).fill('How we roast');
  await page.getByLabel('Excerpt').fill('Behind the scenes.');
  await page.getByLabel('Content').fill('Slowly.\n\nWith care.');
  await page.getByLabel('Tags').fill('coffee, process');
  await page.getByLabel('Visibility').selectOption('published');
  await page.getByRole('button', { name: 'Create post' }).click();
  await expect(page.getByLabel('URL handle')).toHaveValue('how-we-roast');

  const shopper = await browser.newPage();
  await shopper.goto(storefrontUrl(subdomain, '/blog'));
  await expect(shopper.getByText('Behind the scenes.')).toBeVisible();
  await shopper.getByRole('link', { name: 'How we roast' }).click();
  await expect(shopper.getByRole('heading', { name: 'How we roast' })).toBeVisible();
  await expect(shopper.getByText('With care.')).toBeVisible();
  await shopper.getByRole('link', { name: 'coffee' }).click();
  await expect(shopper.getByRole('heading', { name: 'Blog · coffee' })).toBeVisible();
});
