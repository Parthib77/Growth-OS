import { expect, test } from '@playwright/test';

test('mobile workspace decoration and reporting dates stay within the screen', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Already have an account? Sign in.' }).click();
  await page.getByLabel('Email').fill('demo@growthos.local');
  await page.getByLabel('Password').fill('DemoWorkspace!2026');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.locator('#screen-title')).toHaveText('Who needs attention?');

  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 720 });
    await page.getByRole('button', { name: 'Customers', exact: true }).click();
    await expect(page.locator('#screen-title')).toHaveText('Customers');
    await page.locator('#customer-import').scrollIntoViewIfNeeded();
    const decoration = await page
      .locator('.app-shell')
      .evaluate((element) => getComputedStyle(element).backgroundImage);
    expect(decoration).not.toContain('leaves.png');

    await page.getByRole('button', { name: 'Results', exact: true }).click();
    await expect(page.locator('#screen-title')).toHaveText('Results');
    const bounds = await page.locator('.results-filter').evaluate((panel) => {
      const panelBounds = panel.getBoundingClientRect();
      const dates = Array.from(panel.querySelectorAll<HTMLInputElement>('input[type="date"]'));
      return dates.map((input) => ({
        panelLeft: panelBounds.left,
        panelRight: panelBounds.right,
        left: input.getBoundingClientRect().left,
        right: input.getBoundingClientRect().right,
      }));
    });
    expect(bounds).toHaveLength(2);
    for (const date of bounds) {
      expect(date.left).toBeGreaterThanOrEqual(date.panelLeft);
      expect(date.right).toBeLessThanOrEqual(date.panelRight);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      width,
    );
  }
});
