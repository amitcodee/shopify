import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { expect, type Page } from '@playwright/test';
import { E2E_ENCRYPTION_KEY } from '../playwright.config';

export const ADMIN_URL = 'http://localhost:3110';
export const STOREFRONT_PORT = 3210;

export function storefrontUrl(subdomain: string, path = '/'): string {
  return `http://${subdomain}.localhost:${STOREFRONT_PORT}${path}`;
}

export function uniqueSuffix(): string {
  return randomUUID().slice(0, 8);
}

export async function signUp(page: Page, name = 'E2E Merchant') {
  const email = `e2e-${uniqueSuffix()}@example.com`;
  const password = 'e2e-password-123456';
  await page.goto(`${ADMIN_URL}/signup`);
  await page.getByLabel('Your name').fill(name);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page).toHaveURL(/\/verify-email$/);
  await verifyEmail(page, email);
  return { email, password };
}

/** The API keeps sent email in memory during E2E, so build the emailed link out of band. */
export function emailVerificationToken(email: string): string {
  return execFileSync(process.execPath, ['scripts/email-verification-token.js', email], {
    cwd: 'packages/db',
    env: { ...process.env, APP_ENCRYPTION_KEY: E2E_ENCRYPTION_KEY },
    encoding: 'utf8',
  });
}

/** Opens the verification link and confirms; lands on store onboarding. */
export async function verifyEmail(page: Page, email: string) {
  await page.goto(`${ADMIN_URL}/verify-email/${emailVerificationToken(email)}`);
  await page.getByRole('button', { name: 'Confirm email' }).click();
  await expect(page).toHaveURL(/\/onboarding$/);
}

/** Creates a store and (unless `payments: false`) sets up sandbox payments through the UI. */
export async function createStore(page: Page, name: string, { payments = true } = {}) {
  const subdomain = `shop-${uniqueSuffix()}`;
  await page.getByLabel('Store name').fill(name);
  await page.getByLabel('Store address').fill(subdomain);
  await page.getByRole('button', { name: 'Create store' }).click();
  await expect(page.getByRole('heading', { name: `Welcome to ${name}` })).toBeVisible();
  const storeId = /\/s\/([0-9a-f-]{36})/.exec(page.url())?.[1];
  if (!storeId) throw new Error(`Unexpected URL after store creation: ${page.url()}`);
  if (payments) {
    await enablePayments(page, storeId);
    await page.goto(`${ADMIN_URL}/s/${storeId}`);
  }
  return { subdomain, storeId };
}

/** Settings → Payments → sandbox onboarding, ending with an active payouts account. */
export async function enablePayments(page: Page, storeId: string) {
  await page.goto(`${ADMIN_URL}/s/${storeId}/settings/payments`);
  await page.getByRole('button', { name: 'Set up payments' }).click();
  await expect(page.getByRole('heading', { name: 'Sandbox onboarding' })).toBeVisible();
  await page.getByRole('button', { name: 'Complete onboarding' }).click();
  await expect(page.getByText('Payments are set up.')).toBeVisible();
}
