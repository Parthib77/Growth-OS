import { expect, test } from '@playwright/test';

async function signInToDemo(page: import('@playwright/test').Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Already have an account? Sign in.' }).click();
  await page.getByLabel('Email').fill('demo@growthos.local');
  await page.getByLabel('Password').fill('DemoWorkspace!2026');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.locator('#screen-title')).toHaveText('Who needs attention?');
  await page.evaluate(() => window.scrollTo(0, 0));
}

test('workspace tabs crossfade while the navigation stays in place', async ({ page }, testInfo) => {
  await signInToDemo(page);
  const nav = page.locator('.app-nav-shell');
  const navBefore = await nav.boundingBox();

  await page.getByRole('button', { name: 'Customers', exact: true }).click();
  await expect(page.locator('#screen-title')).toHaveText('Customers');
  const animatedElement =
    testInfo.project.name === 'phone'
      ? '.app-shell > :not(.app-nav-shell)'
      : '::view-transition-new(root)';
  await expect
    .poll(() =>
      page.evaluate(
        (selector) =>
          selector.startsWith('::')
            ? getComputedStyle(document.documentElement, selector).animationDuration
            : getComputedStyle(document.querySelector(selector)!).animationDuration,
        animatedElement,
      ),
    )
    .toBe('0.19s');

  await page.getByRole('button', { name: 'Campaigns', exact: true }).click();
  await expect(page.locator('#screen-title')).toHaveText('Permission-aware follow-up');
  await page.getByRole('button', { name: 'Results', exact: true }).click();
  await expect(page.locator('#screen-title')).toHaveText('Results');
  await expect(page.getByRole('button', { name: 'Results', exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await expect(page.locator('html')).not.toHaveAttribute('data-workspace-transition');
  const navAfter = await nav.boundingBox();
  expect(navAfter?.x).toBe(navBefore?.x);
  expect(navAfter?.y).toBe(navBefore?.y);
});

test('keyboard tab changes are immediate', async ({ page }, testInfo) => {
  test.skip(
    testInfo.project.name === 'phone',
    'The phone profile does not synthesize Enter clicks.',
  );
  await signInToDemo(page);
  const customers = page.getByRole('button', { name: 'Customers', exact: true });
  await customers.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#screen-title')).toHaveText('Customers');
  await expect(page.locator('html')).not.toHaveAttribute('data-workspace-transition');
});

test('reduced-motion tab changes are immediate', async ({ page }) => {
  await signInToDemo(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.getByRole('button', { name: 'Campaigns', exact: true }).click();
  await expect(page.locator('#screen-title')).toHaveText('Permission-aware follow-up');
  await expect(page.locator('html')).not.toHaveAttribute('data-workspace-transition');
});
