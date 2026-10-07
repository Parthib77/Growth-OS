import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('the main demo action opens the example consultancy and all views fit their boxes', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.getByRole('button', { name: 'Try the demo', exact: true }).click();
  await expect(page.locator('#screen-title')).toHaveText('Enquiries to follow up');
  await expect(page.getByText('Northline Consulting', { exact: true })).toBeVisible();
  await expect(page.getByText('Demo workspace', { exact: true })).toBeVisible();
  await expect(page.getByText('Loading bookings and results…')).toBeHidden();
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await page.getByRole('button', { name: /Mina Chen/ }).click();
    const dialog = page.getByRole('dialog', { name: 'Mina Chen' });
    await expect(dialog).toBeVisible();
    const bounds = await dialog.boundingBox();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
    await page.getByRole('button', { name: 'Close customer details' }).click();
  }
  for (const screen of ['Today', 'Customers', 'Campaigns', 'Reviews', 'Results', 'Settings']) {
    await page
      .getByRole('navigation', { name: 'Workspace' })
      .getByRole('button', { name: screen, exact: true })
      .click();
    await expect(page.locator('#screen-title')).toBeVisible();
    for (const width of [1440, 1024, 768, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      const outside = await page.evaluate(() => {
        return [
          ...document.querySelectorAll(
            '.app-nav-link, .app-nav-signout, input, select, textarea, .button, .workspace-icon-well',
          ),
        ]
          .filter((element) => {
            const a = element.getBoundingClientRect();
            if (!a.width) return false;
            const panel = element.closest(
              '.app-nav-shell, .panel, .settings-section, .review-record',
            );
            if (!panel) return false;
            const b = panel.getBoundingClientRect();
            return a.left < b.left - 1 || a.right > b.right + 1;
          })
          .map((element) => element.textContent?.trim());
      });
      expect(outside, `${screen} at ${width}px`).toEqual([]);
      if (screen === 'Results' && width < 700) {
        const overlapping = await page.locator('.results-chart-label').evaluateAll((labels) => {
          const boxes = labels.map((label) => label.getBoundingClientRect());
          return boxes.some((box, index) =>
            boxes
              .slice(index + 1)
              .some(
                (other) =>
                  box.left < other.right &&
                  box.right > other.left &&
                  box.top < other.bottom &&
                  box.bottom > other.top,
              ),
          );
        });
        expect(overlapping, `Chart labels overlap at ${width}px`).toBe(false);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        width,
      );
    }
    await page.setViewportSize({ width: 1440, height: 900 });
    const result = await new AxeBuilder({ page }).analyze();
    expect(
      result.violations.filter((v) => ['critical', 'serious'].includes(v.impact || '')),
    ).toEqual([]);
  }
  await expect(page.getByText('Account deletion is unavailable in the shared demo.')).toBeVisible();
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Try the demo', exact: true })).toBeVisible();
});
