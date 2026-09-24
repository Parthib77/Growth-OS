import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem('growthos-theme')) localStorage.setItem('growthos-theme', 'light');
  });
});

test('theme switch changes the whole public site and persists across routes', async ({ page }) => {
  await page.goto('/');
  const toggle = page.getByRole('button', { name: 'Switch to dark mode' });
  await expect(toggle).toBeVisible();
  await toggle.click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.getByRole('button', { name: 'Switch to light mode' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.locator('.auth-card')).toHaveCSS('background-color', 'rgb(25, 40, 49)');
  const authAccessibility = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa'])
    .analyze();
  expect(authAccessibility.violations).toEqual([]);

  await page.goto('/privacy');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('.legal-document')).toHaveCSS('background-color', 'rgb(23, 37, 46)');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.getByRole('button', { name: 'Switch to light mode' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
});

test('dark mode covers every signed-in destination without page overflow', async ({
  page,
}, testInfo) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Already have an account? Sign in.' }).click();
  await page.getByLabel('Email').fill('demo@growthos.local');
  await page.getByLabel('Password').fill('DemoWorkspace!2026');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Who needs attention?' })).toBeVisible();

  await page.getByRole('button', { name: 'Switch to dark mode' }).click();
  await expect(page.locator('.app-nav-shell')).toHaveCSS('background-color', 'rgb(23, 37, 46)');
  const workspaceAccessibility = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa'])
    .analyze();
  expect(workspaceAccessibility.violations).toEqual([]);
  await page.screenshot({
    path: testInfo.outputPath('dark-workspace.png'),
    animations: 'disabled',
  });
  for (const destination of ['Customers', 'Campaigns', 'Reviews', 'Results', 'Settings']) {
    await page.getByRole('button', { name: destination, exact: true }).click();
    await expect(page.locator('#screen-title')).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      `${destination} overflows horizontally in dark mode`,
    ).toBe(true);
  }
});

test('reduced-motion preference keeps theme switching usable', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.getByRole('button', { name: 'Switch to dark mode' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});
