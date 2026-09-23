import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('main screens remain accessible and responsive from tablet through wide desktop', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'Chromium supplies the multi-viewport matrix.');

  const consoleErrors: string[] = [];
  const failedApiRequests: string[] = [];
  let monitoringAuthenticatedFlow = false;
  page.on('console', (message) => {
    if (monitoringAuthenticatedFlow && message.type() === 'error')
      consoleErrors.push(message.text());
  });
  page.on('response', (response) => {
    if (monitoringAuthenticatedFlow && response.url().includes('/api/') && response.status() >= 400)
      failedApiRequests.push(`${response.status()} ${response.url()}`);
  });

  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Already have an account? Sign in.' }).click();
  await page.getByLabel('Email').fill('demo@growthos.local');
  await page.getByLabel('Password').fill('DemoWorkspace!2026');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByText('Loading bookings and results…')).toBeHidden({ timeout: 15_000 });
  await expect(page.getByRole('button', { name: /Mina Chen/ })).toBeVisible({ timeout: 15_000 });
  monitoringAuthenticatedFlow = true;

  const destinations = [
    { button: 'Today', heading: 'Who needs attention?' },
    { button: 'Customers', heading: 'Customers' },
    { button: 'Campaigns', heading: 'Permission-aware follow-up' },
    { button: 'Reviews', heading: 'Reviews' },
    { button: 'Results', heading: 'Results' },
    { button: 'Settings', heading: 'Settings' },
  ] as const;

  for (const destination of destinations) {
    const heading = page.locator('#screen-title');
    if (destination.button === 'Today') {
      await expect(heading).toHaveText(destination.heading);
      await expect(heading).toBeVisible();
    } else {
      await page.getByRole('button', { name: destination.button, exact: true }).click();
      await expect(heading).toHaveText(destination.heading);
      await expect(heading).toBeFocused();
    }
    const accessibility = await new AxeBuilder({ page }).analyze();
    expect(
      accessibility.violations.filter((item) =>
        ['serious', 'critical'].includes(item.impact || ''),
      ),
    ).toEqual([]);
  }

  for (const viewport of [
    { width: 768, height: 1024 },
    { width: 912, height: 900 },
    { width: 1366, height: 768 },
    { width: 1920, height: 1080 },
  ]) {
    await page.setViewportSize(viewport);
    for (const destination of destinations) {
      await page.getByRole('button', { name: destination.button, exact: true }).click();
      await expect(
        page.getByRole('heading', { name: destination.heading, exact: true }),
      ).toBeVisible();
      const overflow = await page.evaluate(() => {
        const root = document.documentElement;
        return {
          clientWidth: root.clientWidth,
          offenders: Array.from(document.querySelectorAll<HTMLElement>('*'))
            .map((element) => ({
              className: element.className,
              left: Math.round(element.getBoundingClientRect().left),
              right: Math.round(element.getBoundingClientRect().right),
              tagName: element.tagName,
            }))
            .filter(({ left, right }) => left < -1 || right > root.clientWidth + 1)
            .slice(0, 8),
          scrollWidth: root.scrollWidth,
        };
      });
      expect(
        overflow.scrollWidth,
        `${destination.button} at ${viewport.width}x${viewport.height} overflowed: ${JSON.stringify(overflow.offenders)}`,
      ).toBeLessThanOrEqual(overflow.clientWidth);
    }
  }

  await page.emulateMedia({ reducedMotion: 'reduce' });
  const transitionSeconds = await page
    .getByRole('button', { name: 'Today', exact: true })
    .evaluate((element) => Number.parseFloat(getComputedStyle(element).transitionDuration));
  expect(transitionSeconds).toBeLessThanOrEqual(0.001);

  expect(consoleErrors).toEqual([]);
  expect(failedApiRequests).toEqual([]);
});
