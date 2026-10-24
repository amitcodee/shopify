import { expect, test } from '@playwright/test';
import { ADMIN_URL, createStore, signUp, storefrontUrl } from './helpers';

test('merchant edits the theme with a live preview, publishes it, and turns on an app', async ({
  browser,
}) => {
  const merchant = await browser.newPage();
  await signUp(merchant);
  const { subdomain, storeId } = await createStore(merchant, 'Editor Co', { payments: false });

  await merchant.goto(`${ADMIN_URL}/s/${storeId}/settings/theme/editor`);
  const preview = merchant.frameLocator('iframe[title="Preview of Editor Co"]');
  await expect(preview.locator('[data-section="hero"]')).toBeVisible();

  // Clicking a section in the preview opens its settings.
  await preview.locator('[data-section="hero"]').click();
  const hero = merchant.getByRole('complementary', { name: 'Hero settings' });
  await hero.getByLabel('Heading').fill('Hello from the editor');
  await expect(merchant.getByText('Draft saved')).toBeVisible();
  await expect(preview.getByRole('heading', { name: 'Hello from the editor' })).toBeVisible();

  // Hide a section from the list; the preview follows.
  await merchant.getByRole('button', { name: 'Hide Newsletter sign-up' }).click();
  await expect(preview.locator('[data-section="newsletter"]')).toHaveCount(0);

  // Shoppers still see the live theme until the merchant publishes.
  const shopper = await browser.newPage();
  await shopper.goto(storefrontUrl(subdomain));
  await expect(shopper.getByRole('heading', { name: 'Hello from the editor' })).toHaveCount(0);
  await expect(shopper.locator('[data-section="newsletter"]')).toHaveCount(1);

  await merchant.getByRole('button', { name: 'Publish' }).click();
  await expect(merchant.getByText(/Published\. Your storefront updates/)).toBeVisible();
  await expect(merchant.getByText('Live', { exact: true })).toBeVisible();
  await expect
    .poll(
      async () => {
        await shopper.reload();
        return shopper.getByRole('heading', { name: 'Hello from the editor' }).count();
      },
      { timeout: 45_000, intervals: [2_000] },
    )
    .toBe(1);

  // Apps: turn on the WhatsApp chat button with a number.
  await merchant.goto(`${ADMIN_URL}/s/${storeId}/apps`);
  const whatsapp = merchant.getByRole('listitem').filter({ hasText: 'WhatsApp chat' });
  await whatsapp.getByRole('button', { name: 'Settings' }).click();
  await whatsapp.getByLabel('WhatsApp number').fill('919876543210');
  await whatsapp.getByRole('button', { name: 'Save' }).click();
  await expect(merchant.getByText('WhatsApp chat settings saved.')).toBeVisible();
  await whatsapp.getByRole('button', { name: 'Turn on' }).click();
  await expect(merchant.getByText('WhatsApp chat is on.')).toBeVisible();
  await expect
    .poll(
      async () => {
        await shopper.reload();
        return shopper.getByRole('link', { name: /Chat with us on WhatsApp/ }).getAttribute('href');
      },
      { timeout: 45_000, intervals: [2_000] },
    )
    .toMatch(/^https:\/\/wa\.me\/919876543210\?text=/);
});
