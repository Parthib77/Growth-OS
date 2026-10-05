import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
const sizes = [
  [1920, 1080],
  [1728, 1117],
  [1600, 900],
  [1440, 900],
  [1366, 768],
  [1280, 800],
  [1200, 900],
  [1100, 900],
  [1024, 768],
  [900, 900],
  [834, 1194],
  [768, 1024],
  [640, 900],
  [480, 900],
  [430, 932],
  [390, 844],
  [375, 812],
  [360, 800],
  [320, 800],
];
for (const theme of ['light', 'dark']) {
  test(`${theme}: layout, accessibility and responsive safety`, async ({ page }) => {
    await page.addInitScript(
      (value) =>
        localStorage.getItem('growthos-theme') || localStorage.setItem('growthos-theme', value),
      theme,
    );
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.route('**/api/v1/**', (route) => {
      const url = route.request().url();
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(
          url.includes('session') ? { authenticated: false } : { csrfToken: 'test-token' },
        ),
      });
    });
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Create your account' })).toBeVisible();
    for (const [width, height] of sizes) {
      await page.setViewportSize({ width, height });
      await page.evaluate(() => window.scrollTo(0, 0));
      const headerBefore = await page.locator('.growth-nav').boundingBox();
      await page.evaluate(() => window.scrollTo(0, 500));
      const headerAfter = await page.locator('.growth-nav').boundingBox();
      const scrollOffset = await page.evaluate(() => window.scrollY);
      expect(headerAfter!.y + scrollOffset).toBeCloseTo(headerBefore!.y, 1);
      expect(headerAfter!.width).toBe(headerBefore!.width);
      await page.evaluate(() => window.scrollTo(0, 0));
      const safety = await page.evaluate(() => {
        const selectors = [
          '.growth-nav',
          '.auth-context',
          '.growth-hero-actions',
          '.growth-bookings',
          '.growth-pipeline',
          '.auth-card',
          '.auth-benefit',
          '.auth-metrics',
          '.growth-nav button',
          '.growth-nav a',
          '.auth-card input',
          '.growth-hero-actions button',
          '.growth-hero-actions a',
          '.theme-toggle',
        ];
        const offenders = selectors.flatMap((selector) =>
          Array.from(document.querySelectorAll(selector))
            .filter((el) => {
              const r = el.getBoundingClientRect();
              return r.width > 0 && (r.left < -0.5 || r.right > innerWidth + 0.5);
            })
            .map(() => selector),
        );
        return { width: document.documentElement.scrollWidth, viewport: innerWidth, offenders };
      });
      expect(safety, `${width}px ${theme}`).toEqual({ width, viewport: width, offenders: [] });
    }
    await page.setViewportSize({ width: 1440, height: 900 });
    const result = await new AxeBuilder({ page })
      .include('.growth-landing')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    expect(
      result.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })),
    ).toEqual([]);
    await page.screenshot({ path: `test-results/growth-${theme}.png`, fullPage: true });
    const password = page.getByLabel('Password', { exact: true });
    await password.fill('correct horse battery staple');
    await page.getByRole('button', { name: 'Show entered value' }).click();
    await expect(password).toHaveAttribute('type', 'text');
    await page.getByRole('button', { name: 'Hide entered value' }).click();
    const before = await page.locator('.auth-card').evaluate((el) => ({
      x: el.getBoundingClientRect().x,
      y: el.getBoundingClientRect().y + scrollY,
      width: el.getBoundingClientRect().width,
      height: el.getBoundingClientRect().height,
    }));
    await page
      .getByRole('button', {
        name: theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode',
      })
      .click();
    await expect(page.locator('html')).toHaveAttribute(
      'data-theme',
      theme === 'light' ? 'dark' : 'light',
    );
    expect(
      await page.locator('.auth-card').evaluate((el) => ({
        x: el.getBoundingClientRect().x,
        y: el.getBoundingClientRect().y + scrollY,
        width: el.getBoundingClientRect().width,
        height: el.getBoundingClientRect().height,
      })),
    ).toEqual(before);
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute(
      'data-theme',
      theme === 'light' ? 'dark' : 'light',
    );
    await page.getByRole('button', { name: 'Already have an account? Sign in.' }).click();
    await expect(page.getByRole('heading', { name: 'Sign in to Today.' })).toBeVisible();
  });
}
