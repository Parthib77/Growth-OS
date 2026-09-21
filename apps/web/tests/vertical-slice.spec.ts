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
