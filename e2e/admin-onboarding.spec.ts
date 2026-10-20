import { expect, test } from '@playwright/test';
import { ADMIN_URL, createStore, signUp, uniqueSuffix, verifyEmail } from './helpers';

test('merchant signs up, creates a store, edits settings, and sees the audit log', async ({
  page,
}) => {
  const { email, password } = await signUp(page);
  const { storeId } = await createStore(page, 'Playwright Goods');

  await page.getByRole('link', { name: 'Settings' }).click();
  await page.getByLabel('Store name').fill('Playwright Goods Co');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByText('Settings saved.')).toBeVisible();

  await page.getByRole('link', { name: 'Audit log' }).click();
  await expect(page.getByText('store.updated')).toBeVisible();
  await expect(page.getByText('store.created')).toBeVisible();

  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/\/login/);

  await page.goto(`${ADMIN_URL}/s/${storeId}`);
  await expect(page).toHaveURL(/\/login\?next=/);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('heading', { name: 'Welcome to Playwright Goods Co' })).toBeVisible();
});

test("a merchant cannot open another merchant's store", async ({ browser }) => {
  const owner = await browser.newPage();
  await signUp(owner, 'Owner');
  const { storeId } = await createStore(owner, 'Private Store');

  const intruder = await browser.newPage();
  await signUp(intruder, 'Intruder');
  await intruder.goto(`${ADMIN_URL}/s/${storeId}`);
  await expect(intruder.getByRole('heading', { name: 'Not found' })).toBeVisible();
});

test('shows a generic error for wrong credentials', async ({ page }) => {
  await page.goto(`${ADMIN_URL}/login`);
  await page.getByLabel('Email').fill('nobody@example.com');
  await page.getByLabel('Password').fill('wrong-password-1');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByText('Invalid email or password.')).toBeVisible();
});

test('a new merchant must confirm their email before creating a store', async ({ page }) => {
  const email = `e2e-${uniqueSuffix()}@example.com`;
  await page.goto(`${ADMIN_URL}/signup`);
  await page.getByLabel('Your name').fill('Unverified');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill('e2e-password-123456');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByRole('heading', { name: 'Check your inbox' })).toBeVisible();
  await expect(page.getByRole('main').getByText(email)).toBeVisible();

  await page.goto(`${ADMIN_URL}/onboarding`);
  await expect(page).toHaveURL(/\/verify-email$/);
  await page.getByRole('button', { name: 'Send a new link' }).click();
  await expect(page.getByText('We sent a new link.')).toBeVisible();

  await page.goto(`${ADMIN_URL}/verify-email/not-a-real-token`);
  await page.getByRole('button', { name: 'Confirm email' }).click();
  await expect(page.getByText('This verification link is invalid or has expired.')).toBeVisible();

  await verifyEmail(page, email);
  await createStore(page, 'Verified Goods');
});
