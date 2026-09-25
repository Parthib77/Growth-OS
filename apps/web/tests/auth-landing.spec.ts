import { expect, test } from '@playwright/test';

test('registration layout fits the supplied desktop reference size', async ({ page }) => {
  await page.setViewportSize({ width: 1672, height: 941 });
  await page.goto('/');

  await expect(
    page.getByRole('heading', { name: 'Turn enquiries into booked appointments.' }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Start with one reliable register.' }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Create account' })).toBeVisible();

  const headline = await page.locator('.auth-context h1').boundingBox();
  const card = await page.locator('.auth-card').boundingBox();
  expect(headline).not.toBeNull();
  expect(card).not.toBeNull();
  if (!headline || !card) return;
  expect(headline.x).toBeGreaterThan(140);
  expect(headline.x + headline.width).toBeLessThan(card.x);
  expect(card.x).toBeGreaterThan(990);
  expect(card.y).toBeGreaterThan(145);
  expect(card.y + card.height).toBeLessThan(825);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1672);
});

test('registration remains readable and usable on a narrow phone', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');

  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  const headline = await page.locator('.auth-context h1').boundingBox();
  const card = await page.locator('.auth-card').boundingBox();
  const benefits = await page.locator('.auth-benefits').boundingBox();
  const submit = await page.getByRole('button', { name: 'Create account' }).boundingBox();
  expect(headline).not.toBeNull();
  expect(card).not.toBeNull();
  expect(benefits).not.toBeNull();
  expect(submit).not.toBeNull();
  if (!headline || !card || !benefits || !submit) return;
  expect(headline.x + headline.width).toBeLessThanOrEqual(390);
  expect(card.x + card.width).toBeLessThanOrEqual(390);
  expect(card.y).toBeLessThan(450);
  expect(submit.y).toBeLessThan(900);
  expect(card.y + card.height).toBeLessThan(benefits.y);
  await expect(page.getByLabel('Business name')).toBeVisible();
  await expect(page.getByLabel('Email')).toBeVisible();
  await expect(page.getByLabel('Password', { exact: true })).toBeVisible();
});

test('password visibility and account mode switches work', async ({ page }) => {
  await page.goto('/');

  const password = page.getByLabel('Password', { exact: true });
  await password.fill('correct horse battery staple');
  await page.getByRole('button', { name: 'Show entered value' }).click();
  await expect(password).toHaveAttribute('type', 'text');
  await page.getByRole('button', { name: 'Hide entered value' }).click();
  await expect(password).toHaveAttribute('type', 'password');

  await page.getByRole('button', { name: 'Already have an account? Sign in.' }).click();
  await expect(page.getByRole('heading', { name: 'Sign in to Today.' })).toBeVisible();
  await expect(page.getByLabel('Password', { exact: true })).not.toHaveAttribute('minlength');
  await page.getByRole('button', { name: 'Forgot password?' }).click();
  await expect(page.getByRole('heading', { name: 'Reset your password.' })).toBeVisible();
  await page.getByRole('button', { name: 'Back to sign in' }).click();
  await expect(page.getByRole('heading', { name: 'Sign in to Today.' })).toBeVisible();
});

test('sign-in matches the compact desktop split in light and dark modes', async ({ page }) => {
  await page.setViewportSize({ width: 1815, height: 870 });
  await page.addInitScript(() => localStorage.setItem('growthos-theme', 'light'));
  await page.goto('/');
  await page.getByRole('button', { name: 'Already have an account? Sign in.' }).click();

  const headline = await page.locator('.auth-context h1').boundingBox();
  const card = await page.locator('.auth-card').boundingBox();
  expect(headline).not.toBeNull();
  expect(card).not.toBeNull();
  if (!headline || !card) return;
  expect(headline.x).toBeGreaterThan(320);
  expect(headline.x).toBeLessThan(360);
  expect(card.x).toBeGreaterThan(1060);
  expect(card.x).toBeLessThan(1120);
  expect(card.width).toBeGreaterThanOrEqual(390);
  expect(card.width).toBeLessThanOrEqual(400);
  expect(headline.x + headline.width).toBeLessThan(card.x);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(1815);

  const lightCard = await page
    .locator('.auth-card')
    .evaluate((element) => getComputedStyle(element).backgroundColor);
  await page.getByRole('button', { name: 'Switch to dark mode' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.getByRole('heading', { name: 'Sign in to Today.' })).toBeVisible();
  await expect(page.locator('.auth-card')).not.toHaveCSS('background-color', lightCard);
});

test('sign-in stacks cleanly on a phone in both themes', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => localStorage.setItem('growthos-theme', 'light'));
  await page.goto('/');
  await page.getByRole('button', { name: 'Already have an account? Sign in.' }).click();

  for (const theme of ['light', 'dark']) {
    const headline = await page.locator('.auth-context h1').boundingBox();
    const card = await page.locator('.auth-card').boundingBox();
    const email = await page.getByLabel('Email').boundingBox();
    expect(headline).not.toBeNull();
    expect(card).not.toBeNull();
    expect(email).not.toBeNull();
    if (!headline || !card || !email) return;
    expect(headline.y + headline.height).toBeLessThan(card.y);
    expect(card.x).toBeGreaterThanOrEqual(16);
    expect(card.x + card.width).toBeLessThanOrEqual(374);
    expect(email.height).toBeGreaterThanOrEqual(44);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
    if (theme === 'light') await page.getByRole('button', { name: 'Switch to dark mode' }).click();
  }
});
