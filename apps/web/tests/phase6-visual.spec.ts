import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { expect, test } from '@playwright/test';

test.skip(
  process.env.GROWTHOS_CAPTURE_VISUALS !== '1',
  'Run only when refreshing visual evidence.',
);

test('capture the completed review workspace', async ({ page }, testInfo) => {
  const email = `visual-${testInfo.project.name}-${Date.now()}@example.com`;
  await page.goto('/');
  await page.getByLabel('Business name').fill('Northline Studio');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill('correct horse battery staple');
  await page.getByRole('button', { name: 'Create account' }).click();
  await page.getByLabel('Timezone').fill('America/Los_Angeles');
  await page.getByRole('button', { name: 'Save and open Today' }).click();
  await page.getByRole('button', { name: 'Reviews' }).click();
  await expect(page.getByRole('heading', { name: 'Reviews', exact: true })).toBeFocused();
  if (testInfo.project.name === 'phone')
    await page.getByText('Add or import reviews', { exact: true }).click();
  await page.getByLabel('Reviewer name').fill('Mina Chen');
  await page.getByLabel('Rating').selectOption('5');
  await page.getByLabel('Source').fill('Google Business Profile');
  await page
    .getByLabel('Original review')
    .fill('The consultation was thoughtful, clear, and never rushed.');
  await page.getByRole('button', { name: 'Save review' }).click();
  await page
    .getByLabel('Response text')
    .fill('Thank you, Mina. We appreciate you taking the time to share this.');
  await page.getByRole('button', { name: 'Save draft' }).click();
  await expect(page.getByText('Response draft saved.')).toBeVisible();
  if (testInfo.project.name === 'phone')
    await page.getByText('Add or import reviews', { exact: true }).click();

  const reviewDir = path.resolve('.impeccable/review');
  await mkdir(reviewDir, { recursive: true });
  const filename = testInfo.project.name === 'phone' ? 'mobile.png' : 'desktop.png';
  await page.screenshot({ path: path.join(reviewDir, filename), fullPage: true });
});

test('capture the daily workspace with stored bookings', async ({ page }, testInfo) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Already have an account? Sign in.' }).click();
  await page.getByLabel('Email').fill('demo@growthos.local');
  await page.getByLabel('Password').fill('DemoWorkspace!2026');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Who needs attention?' })).toBeVisible();
  await expect(page.getByText('Cut and finish')).toBeVisible();

  const reviewDir = path.resolve('.impeccable/review');
  await mkdir(reviewDir, { recursive: true });
  const filename = testInfo.project.name === 'phone' ? 'today-mobile.png' : 'today-desktop.png';
  await page.screenshot({ path: path.join(reviewDir, filename), fullPage: true });
});
