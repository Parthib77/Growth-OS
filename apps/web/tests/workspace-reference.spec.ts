import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { expect, test } from '@playwright/test';

test.skip(
  process.env.GROWTHOS_CAPTURE_WORKSPACE !== '1',
  'Run when checking the referenced workspace design.',
);

test('capture and check every signed-in workspace screen', async ({ page }, testInfo) => {
  const phone = testInfo.project.name === 'phone';
  await page.setViewportSize(phone ? { width: 390, height: 844 } : { width: 1586, height: 992 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Already have an account? Sign in.' }).click();
  await page.getByLabel('Email').fill('demo@growthos.local');
  await page.getByLabel('Password').fill('DemoWorkspace!2026');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Who needs attention?' })).toBeVisible();

  const reviewDir = path.resolve('.impeccable/review');
  await mkdir(reviewDir, { recursive: true });
  const screens = [
    { nav: 'Today', heading: 'Who needs attention?', filename: 'today' },
    { nav: 'Customers', heading: 'Customers', filename: 'customers' },
    { nav: 'Campaigns', heading: 'Permission-aware follow-up', filename: 'campaigns' },
    { nav: 'Reviews', heading: 'Reviews', filename: 'reviews' },
    { nav: 'Results', heading: 'Results', filename: 'results' },
    { nav: 'Settings', heading: 'Settings', filename: 'settings' },
  ] as const;

  for (const screen of screens) {
    if (screen.nav !== 'Today')
      await page.getByRole('button', { name: screen.nav, exact: true }).click();
    await expect(page.locator('#screen-title')).toHaveText(screen.heading);
    await expect(page.locator('#screen-title')).toBeVisible();
    await page
      .locator('.status.pending')
      .waitFor({ state: 'hidden', timeout: 15_000 })
      .catch(() => undefined);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(overflow, `${screen.nav} has horizontal page overflow`).toBe(false);
    await page.screenshot({
      path: path.join(reviewDir, `${screen.filename}-${phone ? 'mobile' : 'desktop'}.png`),
      fullPage: false,
      animations: 'disabled',
    });
  }
});
