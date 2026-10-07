import { test, expect } from '@playwright/test';

test('flow highlights move quickly, pause offscreen and respect reduced motion', async ({ page }) => {
  await page.route('**/api/v1/**', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ authenticated: false, csrfToken: 'test' }) }));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const flow = page.locator('.growth-metrics-flow');
  const highlight = flow.locator('.growth-flow-highlight').first();
  await flow.scrollIntoViewIfNeeded();
  await expect(flow).toHaveAttribute('data-running', 'true');
  await expect(highlight).toHaveCSS('animation-duration', '1.8s');
  await expect(highlight).toHaveCSS('opacity', '0.9');
  const offset = await highlight.evaluate(el => getComputedStyle(el).strokeDashoffset);
  await expect.poll(() => highlight.evaluate(el => getComputedStyle(el).strokeDashoffset)).not.toBe(offset);
  await page.locator('.growth-logo').scrollIntoViewIfNeeded();
  await expect(flow).toHaveAttribute('data-running', 'false');
  await expect(highlight).toHaveCSS('animation-play-state', 'paused');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await flow.scrollIntoViewIfNeeded();
  await expect(highlight).toHaveCSS('animation-name', 'none');
  await expect(highlight).toHaveCSS('display', 'none');
});
