import { expect, test } from '@playwright/test';

test('campaign preview is honest and primary buttons respond to hover', async ({
  page,
}, testInfo) => {
  await page.goto('/');
  await page.getByLabel('Business name').fill('Preview Test Studio');
  await page.getByLabel('Email').fill(`preview-${testInfo.project.name}-${Date.now()}@example.com`);
  await page.getByLabel('Password').fill('correct horse battery staple');
  await page.getByRole('button', { name: 'Create account' }).click();
  await page.getByRole('button', { name: 'Save and open Today' }).click();
  await page.getByRole('button', { name: 'Campaigns', exact: true }).click();

  const previewButton = page.getByRole('button', { name: 'Preview message' });
  await expect(previewButton).toHaveAttribute('aria-expanded', 'false');
  await previewButton.click();
  await expect(previewButton).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByText('This does not send a message.')).toBeVisible();
  await expect(page.locator('.campaign-message-preview')).toContainText('{first_name}');
  await previewButton.click();
  await expect(page.locator('.campaign-message-preview')).toBeHidden();

  const saveButton = page.getByRole('button', { name: 'Save draft' });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  const restingTransform = await saveButton.evaluate(
    (button) => getComputedStyle(button).transform,
  );
  await saveButton.hover();
  await expect
    .poll(() => saveButton.evaluate((button) => getComputedStyle(button).transform))
    .not.toBe(restingTransform);
});
