import { createHmac } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { ADMIN_URL, signUp } from './helpers';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function totp(secret: string, offsetSteps = 0): string {
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const char of secret.replace(/\s/g, '')) {
    value = (value << 5) | ALPHABET.indexOf(char);
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30_000) + offsetSteps));
  const hmac = createHmac('sha1', Buffer.from(bytes)).update(counter).digest();
  const offset = (hmac[hmac.length - 1] ?? 0) & 0x0f;
  return ((hmac.readUInt32BE(offset) & 0x7fffffff) % 1_000_000).toString().padStart(6, '0');
}

test('merchant enables two-factor authentication and must use it to sign in', async ({ page }) => {
  const { email, password } = await signUp(page, 'Secure Merchant');
  await page.goto(`${ADMIN_URL}/account/security`);
  await page.getByRole('button', { name: 'Set up two-factor authentication' }).click();
  const secret = (await page.locator('code').first().textContent())?.trim() ?? '';
  expect(secret).toMatch(/^[A-Z2-7]{32}$/);

  await page.getByLabel('6-digit code').fill(totp(secret));
  await page.getByRole('button', { name: 'Turn on' }).click();
  await expect(page.getByText('On', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Sign out' }).click();
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();

  await expect(page.getByText('Enter the 6-digit code from your authenticator app.')).toBeVisible();
  await page.getByLabel('Authentication code').fill('000000');
  await page.getByRole('button', { name: 'Verify' }).click();
  await expect(page.getByText(/That code is not valid/)).toBeVisible();

  // The enrolment code was already used; take the next time step's code.
  await page.getByLabel('Authentication code').fill(totp(secret, 1));
  await page.getByRole('button', { name: 'Verify' }).click();
  await expect(page).toHaveURL(/\/onboarding|\/stores/);
});
