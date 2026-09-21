import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('real app exposes an accessible registration surface', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /reliable register/i })).toBeVisible();
  const results = await new AxeBuilder({ page }).analyze();
  expect(
    results.violations.filter((item) => ['serious', 'critical'].includes(item.impact || '')).length,
  ).toBe(0);
});

test('full workflow stores the booking and recorded value in Results', async ({ page }) => {
  test.skip(
    !process.env.GROWTHOS_E2E_MONGODB_URI,
    'Set GROWTHOS_E2E_MONGODB_URI to run the browser workflow against MongoDB.',
  );
  const email = `browser-${Date.now()}@example.com`;
  await page.goto('/');
  await page.getByLabel('Business name').fill('Browser Salon');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill('correct horse battery staple');
  await page.getByRole('button', { name: 'Create account' }).click();

  await expect(page.getByRole('heading', { name: /make the workspace useful/i })).toBeVisible();
  await page.getByLabel('Timezone').fill('America/Los_Angeles');
  await page.getByLabel('Follow-up after (days)').fill('2');
  await page.getByRole('button', { name: 'Save and open Today' }).click();

  await expect(page.getByRole('heading', { name: 'Who needs attention?' })).toBeVisible();
  await page
    .getByRole('button', { name: /add enquiry/i })
    .first()
    .click();
  await page.getByLabel('First name').fill('Asha');
  await page.getByLabel('Last name').fill('Patel');
  await page.getByLabel('Phone').fill('+15550001001');
  await page.getByLabel('Service').fill('Colour consultation');
  await page.getByRole('button', { name: 'Save enquiry' }).click();

  await expect(page.getByRole('button', { name: /Asha Patel/ })).toBeVisible();
  await page.getByRole('button', { name: /Asha Patel/ }).click();
  await page.getByRole('button', { name: 'Record booking' }).click();
  await page.getByLabel('Appointment').fill('2026-10-07T13:00');
  await page.getByLabel('Agreed value (cents)').fill('20000');
  await page.getByRole('button', { name: 'Record booking' }).last().click();

  await expect(page.getByText('Booking recorded. The enquiry moved out of Today.')).toBeVisible();
  await expect(page.getByText('Colour consultation')).toBeVisible();
  await expect(page.getByText('USD 200.00')).toBeVisible();
});
