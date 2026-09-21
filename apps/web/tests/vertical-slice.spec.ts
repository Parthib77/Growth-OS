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
  await page.getByRole('textbox', { name: 'Phone' }).fill('+15550001001');
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
  await expect(page.locator('.results-panel').getByText('USD 200.00')).toBeVisible();
});

test('customer register supports add, search, detail history, and consent withdrawal', async ({
  page,
}) => {
  const email = `customers-${Date.now()}@example.com`;
  await page.goto('/');
  await page.getByLabel('Business name').fill('Customer Salon');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill('correct horse battery staple');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByRole('heading', { name: /make the workspace useful/i })).toBeVisible();
  await page.getByLabel('Timezone').fill('America/Los_Angeles');
  await page.getByRole('button', { name: 'Save and open Today' }).click();
  await page.getByRole('button', { name: 'Customers' }).click();
  await expect(page.getByRole('heading', { name: 'Customers' })).toBeVisible();
  await page.getByRole('button', { name: 'Add customer' }).click();
  await page.getByLabel('First name').fill('Mina');
  await page.getByLabel('Last name').fill('Lee');
  await page.getByRole('textbox', { name: 'Phone' }).fill('+15550002001');
  await page.getByRole('textbox', { name: 'Email' }).fill('mina@example.com');
  await page.getByRole('textbox', { name: 'Service', exact: true }).fill('Facial');
  await page.getByRole('button', { name: 'Save customer' }).click();
  await expect(page.getByRole('button', { name: /Mina Lee/ })).toBeVisible();
  await page.getByLabel('Search customers').fill('Mina');
  await page.getByRole('button', { name: /Mina Lee/ }).click();
  await expect(page.getByRole('heading', { name: 'Mina Lee' })).toBeVisible();
  await page.getByLabel('Add internal note').fill('Prefers mornings');
  await page.getByRole('button', { name: 'Add note' }).click();
  await expect(page.getByText('Prefers mornings')).toBeVisible();
  await page.getByRole('button', { name: 'Withdraw consent' }).click();
  await expect(page.getByText('Contact eligibility: suppressed', { exact: true })).toBeVisible();
});
