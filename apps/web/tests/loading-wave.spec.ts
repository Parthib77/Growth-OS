import { expect, test } from '@playwright/test';

test('wave appears at the upper right during a slow request and clears afterward', async ({
  page,
}, testInfo) => {
  await page.route('**/api/v1/auth/csrf', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1600));
    await route.continue();
  });

  await page.goto('/');
  const indicator = page.getByRole('status', { name: 'Loading' });
  if (testInfo.project.name === 'phone') {
    await page.waitForTimeout(300);
    await expect(indicator).toBeHidden();
    return;
  }
  await expect(indicator).toBeVisible();
  const box = await indicator.boundingBox();
  const viewport = page.viewportSize();
  expect(box).not.toBeNull();
  expect(viewport).not.toBeNull();
  if (box && viewport) {
    expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
    expect(box.y).toBeLessThan(viewport.height / 3);
  }
  await expect(indicator).toBeHidden();
});

test('reduced motion leaves a static wave during loading', async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route('**/api/v1/auth/csrf', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1600));
    await route.continue();
  });

  await page.goto('/');
  const indicator = page.getByRole('status', { name: 'Loading' });
  if (testInfo.project.name === 'phone') {
    await page.waitForTimeout(300);
    await expect(indicator).toBeHidden();
    return;
  }
  await expect(indicator).toBeVisible();
  const bead = indicator.locator('.loading-wave-bead').first();
  const firstPosition = await bead.boundingBox();
  await page.waitForTimeout(120);
  const secondPosition = await bead.boundingBox();
  expect(secondPosition?.y).toBe(firstPosition?.y);
  await expect(indicator).toBeHidden();
});
