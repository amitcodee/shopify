import { expect, test } from '@playwright/test';
import { ADMIN_URL, createStore, storefrontUrl, uniqueSuffix, verifyEmail } from './helpers';

test('a template picked at sign-up starts the store; merchant applies another and shoppers preview others', async ({
  browser,
}) => {
  const merchant = await browser.newPage();
  const email = `e2e-${uniqueSuffix()}@example.com`;

  // Sign-up link from the marketing site carries the email and the chosen template.
  await merchant.goto(
    `${ADMIN_URL}/signup?email=${encodeURIComponent(email)}&template=beauty-classic`,
  );
  await expect(merchant.getByText(/start with the “Velvet” template/)).toBeVisible();
  await expect(merchant.getByLabel('Email')).toHaveValue(email);
  await merchant.getByLabel('Your name').fill('Template Merchant');
  await merchant.getByLabel('Password').fill('e2e-password-123456');
  await merchant.getByRole('button', { name: 'Create account' }).click();
  await expect(merchant).toHaveURL(/\/verify-email$/);
  await verifyEmail(merchant, email);

  await expect(merchant.getByLabel('What will you sell?')).toHaveValue('beauty');
  const { subdomain, storeId } = await createStore(merchant, 'Glow Lab', { payments: false });

  // The store starts with Velvet (Beauty · Classic).
  const shopper = await browser.newPage();
  await shopper.goto(storefrontUrl(subdomain));
  await expect(shopper.locator('body')).toHaveAttribute('data-card', 'bordered');
  await expect(shopper.locator('body')).not.toHaveAttribute('data-dark', '');

  // Template store: filter, then apply a dark template.
  await merchant.goto(`${ADMIN_URL}/s/${storeId}/settings/theme`);
  await expect(merchant.getByText('Velvet').first()).toBeVisible();
  await expect(merchant.getByText('108 templates')).toBeVisible();
  await merchant.getByRole('button', { name: 'Pet supplies' }).click();
  await merchant.getByLabel('Search templates').fill('moon');
  await expect(merchant.getByText('Showing 1 of 108 templates')).toBeVisible();
  await expect(merchant.getByRole('link', { name: 'Preview Moonpaw' })).toHaveAttribute(
    'href',
    /\?theme_preview=pets-noir$/,
  );
  await merchant.getByRole('button', { name: 'Apply Moonpaw' }).click();
  await expect(merchant.getByText(/“Moonpaw” applied/)).toBeVisible();

  await shopper.reload();
  await expect(shopper.locator('body')).toHaveAttribute('data-dark', '');
  await expect(shopper.locator('body')).toHaveAttribute('data-card', 'overlay');

  // Shoppers (or the merchant) can preview any template without saving it.
  await shopper.goto(storefrontUrl(subdomain, '/?theme_preview=fashion-bold'));
  await expect(shopper.getByText('Previewing “Runway”')).toBeVisible();
  await expect(shopper.locator('body')).toHaveAttribute('data-card', 'shadow');
  await shopper.goto(storefrontUrl(subdomain, '/collections/all'));
  await expect(shopper.getByText('Previewing “Runway”')).toBeVisible();
  await shopper.getByRole('link', { name: 'Exit preview' }).click();
  await expect(shopper.getByText(/Previewing/)).toHaveCount(0);
  await expect(shopper.locator('body')).toHaveAttribute('data-card', 'overlay');

  // Unknown templates are ignored.
  await shopper.goto(storefrontUrl(subdomain, '/?theme_preview=not-a-template'));
  await expect(shopper.getByText(/Previewing/)).toHaveCount(0);
});
