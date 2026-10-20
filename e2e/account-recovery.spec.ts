import { expect, test } from '@playwright/test';
import { ADMIN_URL, emailLinkToken, signUp } from './helpers';

test('merchant resets a forgotten password from the emailed link', async ({ page }) => {
  const { email } = await signUp(page, 'Forgetful Merchant');
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/\/login/);

  await page.getByRole('link', { name: 'Forgot your password?' }).click();
  await expect(page).toHaveURL(/\/forgot-password$/);
  await page.getByLabel('Email').fill(email);
  await page.getByRole('button', { name: 'Send reset link' }).click();
  await expect(page.getByText('we sent a link to reset the password')).toBeVisible();

  await page.goto(`${ADMIN_URL}/reset-password/${emailLinkToken('reset-password', email)}`);
  await page.getByLabel('New password').fill('brand-new-password-42');
  await page.getByRole('button', { name: 'Save new password' }).click();
  await expect(page.getByText('Password changed.')).toBeVisible();

  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill('brand-new-password-42');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/onboarding$/);
});

test('an invalid unlock link shows an error', async ({ page }) => {
  await page.goto(`${ADMIN_URL}/unlock/not-a-real-token`);
  await page.getByRole('button', { name: 'Unlock account' }).click();
  await expect(page.getByText('This unlock link is invalid or has expired.')).toBeVisible();
});
