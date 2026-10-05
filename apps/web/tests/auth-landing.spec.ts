import { expect, test } from '@playwright/test';

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
