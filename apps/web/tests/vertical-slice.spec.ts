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

test('an offline registration preserves input and recovers after reconnection', async ({
  page,
  context,
}, testInfo) => {
  const email = `offline-${testInfo.project.name}-${Date.now()}@example.com`;
  await page.goto('/');
  await page.getByLabel('Business name').fill('Offline Salon');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill('correct horse battery staple');

  await context.setOffline(true);
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(
    page.getByText('Connection lost. Check your internet connection and try again.'),
  ).toBeVisible();
  await expect(page.getByLabel('Business name')).toHaveValue('Offline Salon');
  await expect(page.getByLabel('Email')).toHaveValue(email);

  await context.setOffline(false);
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByRole('heading', { name: /make the workspace useful/i })).toBeVisible();
});

test('seeded demo signs in to the real database and stays clearly labeled', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Already have an account? Sign in.' }).click();
  await page.getByLabel('Email').fill('demo@growthos.local');
  await page.getByLabel('Password').fill('DemoWorkspace!2026');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();

  await expect(page.getByText('Demo workspace', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Who needs attention?' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Mina Chen/ })).toBeVisible();
  await page.getByRole('button', { name: 'Reviews' }).click();
  await expect(page.getByText('Demo workspace', { exact: true })).toBeVisible();
  await expect(
    page.getByText('The consultation was clear, thoughtful, and never rushed.'),
  ).toBeVisible();
});

test('Today dialogs trap focus, close with Escape, and restore the trigger', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Already have an account? Sign in.' }).click();
  await page.getByLabel('Email').fill('demo@growthos.local');
  await page.getByLabel('Password').fill('DemoWorkspace!2026');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();

  const trigger = page.getByRole('button', { name: /Mina Chen/ });
  await expect(trigger).toBeVisible();
  await trigger.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog', { name: 'Mina Chen' })).toBeVisible();
  const close = page.getByRole('button', { name: 'Close customer details' });
  await expect(close).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(page.getByRole('button', { name: 'Record booking' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(close).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Mina Chen' })).toBeHidden();
  await expect(trigger).toBeFocused();
});

test('password reset uses a single-use link and returns to the authenticated workspace', async ({
  page,
}, testInfo) => {
  const email = `reset-${testInfo.project.name}-${Date.now()}@example.com`;
  const oldPassword = 'correct horse battery staple';
  const newPassword = 'a newer correct horse battery staple';
  await page.goto('/');
  await page.getByLabel('Business name').fill('Reset Browser Salon');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(oldPassword);
  await page.getByRole('button', { name: 'Create account' }).click();
  await page.getByRole('button', { name: 'Save and open Today' }).click();
  await page.getByRole('button', { name: 'Sign out' }).click();

  await page.getByRole('button', { name: 'Already have an account? Sign in.' }).click();
  await page.getByRole('button', { name: 'Forgot password?' }).click();
  await page.getByLabel('Email').fill(email);
  await page.getByRole('button', { name: 'Send reset instructions' }).click();
  await expect(page.getByRole('heading', { name: 'Choose a new password.' })).toBeVisible();
  await page.getByLabel('New password', { exact: true }).fill(newPassword);
  await page.getByLabel('Confirm new password').fill(newPassword);
  await page.getByRole('button', { name: 'Update password' }).click();

  await expect(page.getByRole('heading', { name: 'Who needs attention?' })).toBeVisible();
  await expect(page.getByText('Password updated. You are signed in.')).toBeVisible();
});

test('full workflow stores the booking and recorded value in Results', async ({
  page,
}, testInfo) => {
  const email = `browser-${testInfo.project.name}-${Date.now()}@example.com`;
  await page.goto('/');
  await page.getByLabel('Business name').fill('Browser Salon');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill('correct horse battery staple');
  await page.getByRole('button', { name: 'Create account' }).click();

  await expect(page.getByRole('heading', { name: /make the workspace useful/i })).toBeVisible();
  await page.getByLabel('Timezone').fill('America/Los_Angeles');
  await page.getByLabel('Follow-up after (days)').fill('2');
  await page.getByRole('button', { name: 'Save and open Today' }).click();

  await expect(page.getByRole('heading', { name: 'Who needs attention?' })).toBeVisible();
  await page
    .getByRole('button', { name: /add enquiry/i })
    .first()
    .click();
  await page.getByLabel('First name').fill('Asha');
  await page.getByLabel('Last name').fill('Patel');
  await page.getByRole('textbox', { name: 'Phone' }).fill('+15550001001');
  await page.getByLabel('Service').fill('Colour consultation');
  await page.getByRole('button', { name: 'Save enquiry' }).click();

  await expect(page.getByRole('button', { name: /Asha Patel/ })).toBeVisible();
  await page.getByRole('button', { name: /Asha Patel/ }).click();
  await page.getByRole('button', { name: 'Record booking' }).click();
  await page.getByLabel('Appointment').fill('2026-10-07T13:00');
  await page.getByLabel('Agreed value (cents)').fill('20000');
  await page.getByRole('button', { name: 'Record booking' }).last().click();

  await expect(page.getByText('Booking recorded. The enquiry moved out of Today.')).toBeVisible();
  await expect(page.getByText('Colour consultation')).toBeVisible();
  await expect(page.locator('.results-panel').getByText('USD 200.00')).toBeVisible();
  await page.getByRole('button', { name: 'Complete Colour consultation booking' }).click();
  await expect(page.getByText('Booking marked completed.')).toBeVisible();
  await expect(page.locator('.booking-register').getByText('Completed')).toBeVisible();
  await expect(page.locator('.results-panel').getByText('USD 200.00')).toBeVisible();
});

test('customer register supports add, search, detail history, and consent withdrawal', async ({
  page,
}, testInfo) => {
  const email = `customers-${testInfo.project.name}-${Date.now()}@example.com`;
  await page.goto('/');
  await page.getByLabel('Business name').fill('Customer Salon');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill('correct horse battery staple');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByRole('heading', { name: /make the workspace useful/i })).toBeVisible();
  await page.getByLabel('Timezone').fill('America/Los_Angeles');
  await page.getByRole('button', { name: 'Save and open Today' }).click();
  await page.getByRole('button', { name: 'Customers' }).click();
  await expect(page.getByRole('heading', { name: 'Customers' })).toBeVisible();
  await page.getByRole('button', { name: 'Add customer' }).click();
  await page.getByLabel('First name').fill('Mina');
  await page.getByLabel('Last name').fill('Lee');
  await page.getByRole('textbox', { name: 'Phone' }).fill('+15550002001');
  await page.getByRole('textbox', { name: 'Email' }).fill('mina@example.com');
  await page.getByRole('textbox', { name: 'Service', exact: true }).fill('Facial');
  await page.getByRole('button', { name: 'Save customer' }).click();
  await expect(page.getByRole('button', { name: /Mina Lee/ })).toBeVisible();
  await page.getByLabel('Search customers').fill('Mina');
  await page.getByRole('button', { name: /Mina Lee/ }).click();
  await expect(page.getByRole('heading', { name: 'Mina Lee' })).toBeVisible();
  await page.getByLabel('Add internal note').fill('Prefers mornings');
  await page.getByRole('button', { name: 'Add note' }).click();
  await expect(page.getByText('Prefers mornings')).toBeVisible();
  await page.getByRole('button', { name: 'Withdraw consent' }).click();
  await expect(page.getByText('Contact eligibility: suppressed', { exact: true })).toBeVisible();
});

test('campaign workflow reviews recipients, opens a WhatsApp link, and records sent', async ({
  page,
}, testInfo) => {
  const email = `campaign-${testInfo.project.name}-${Date.now()}@example.com`;
  await page.goto('/');
  await page.getByLabel('Business name').fill('Campaign Salon');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill('correct horse battery staple');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByRole('heading', { name: /make the workspace useful/i })).toBeVisible();
  await page.getByLabel('Timezone').fill('America/Los_Angeles');
  await page.getByRole('button', { name: 'Save and open Today' }).click();
  await page.getByRole('button', { name: 'Add enquiry' }).first().click();
  await page.getByLabel('First name').fill('Ari');
  await page.getByRole('textbox', { name: 'Phone', exact: true }).fill('+15550003001');
  await page.getByLabel('Service').fill('Massage');
  await page.getByRole('button', { name: 'Save enquiry' }).click();
  await page.getByRole('button', { name: 'Campaigns' }).click();
  await expect(page.getByRole('heading', { name: /permission-aware follow-up/i })).toBeVisible();
  await page.getByLabel('Campaign name').fill('Spring follow-up');
  await page.getByRole('button', { name: 'Save draft' }).click();
  await page.getByRole('button', { name: 'Review recipients' }).click();
  await expect(page.getByText(/eligible recipient\(s\) prepared/i)).toBeVisible();
  await page.getByRole('button', { name: 'Mark ready' }).click();
  await page.getByRole('button', { name: 'Activate' }).click();
  const popupPromise = page.waitForEvent('popup');
  await page.getByRole('button', { name: 'Prepare WhatsApp' }).click();
  const popup = await popupPromise;
  await expect.poll(() => popup.url()).toMatch(/(?:wa\.me|whatsapp\.com)/);
  await page.getByRole('button', { name: 'Mark sent' }).click();
  await expect(page.getByText(/outcome recorded: sent/i)).toBeVisible();
});

test('reviews, filtered results, settings, exports, legal drafts, and deletion work together', async ({
  page,
}, testInfo) => {
  const email = `completion-${testInfo.project.name}-${Date.now()}@example.com`;
  await page.goto('/');
  await page.getByLabel('Business name').fill('Completion Salon');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill('correct horse battery staple');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByRole('heading', { name: /make the workspace useful/i })).toBeVisible();
  await page.getByLabel('Timezone').fill('America/Los_Angeles');
  await page.getByRole('button', { name: 'Save and open Today' }).click();

  await page.getByRole('button', { name: 'Reviews' }).click();
  await expect(page.getByRole('heading', { name: 'Reviews', exact: true })).toBeFocused();
  if (testInfo.project.name === 'phone')
    await page.getByText('Add or import reviews', { exact: true }).click();
  await page.getByLabel('Reviewer name').fill('Nora');
  await page.getByLabel('Rating').selectOption('5');
  await page.getByLabel('Source').fill('manual');
  await page.getByLabel('Original review').fill('Careful service and a calm visit.');
  await page.getByRole('button', { name: 'Save review' }).click();
  await expect(page.getByText('Careful service and a calm visit.')).toBeVisible();
  await page
    .getByLabel('Response text')
    .fill('Thank you, Nora. We appreciate the thoughtful note.');
  await page.getByRole('button', { name: 'Save draft' }).click();
  await expect(page.getByText('Response draft saved.')).toBeVisible();
  await page.getByRole('button', { name: 'Mark posted manually' }).click();
  await expect(page.getByText('Response marked as posted manually.')).toBeVisible();
  await page.getByLabel('Show').selectOption('posted_manually');
  await expect(page.locator('.state-label', { hasText: 'Posted manually' })).toBeVisible();

  await page.getByRole('button', { name: 'Results' }).click();
  await expect(page.getByRole('heading', { name: 'Results' })).toBeFocused();
  await page.getByLabel('From').fill('2026-09-01');
  await page.getByLabel('Through').fill('2026-09-30');
  await page.getByRole('button', { name: 'Update results' }).click();
  await expect(page.getByText('2026-09-01 through 2026-09-30')).toBeVisible();
  const resultsDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download CSV' }).click();
  expect((await resultsDownload).suggestedFilename()).toBe('results.csv');

  await page.getByRole('button', { name: 'Settings' }).click();
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeFocused();
  const settingsAccessibility = await new AxeBuilder({ page }).analyze();
  expect(
    settingsAccessibility.violations.filter((item) =>
      ['serious', 'critical'].includes(item.impact || ''),
    ).length,
  ).toBe(0);
  await page.getByLabel('Follow-up after (days)').fill('4');
  await page
    .getByLabel('Review response template')
    .fill('Thank you, {reviewer_name}. Your feedback was recorded.');
  await page.getByRole('button', { name: 'Save settings' }).click();
  await expect(page.getByText('Workspace settings saved.')).toBeVisible();
  const dataDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download workspace data' }).click();
  expect((await dataDownload).suggestedFilename()).toBe('growthos-export.json');

  await page.getByRole('button', { name: 'Start account deletion' }).click();
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByRole('button', { name: 'Start account deletion' })).toBeVisible();

  const privacy = await page.context().newPage();
  await privacy.goto('/privacy');
  await expect(
    privacy.getByRole('heading', { name: 'How the current product handles data' }),
  ).toBeVisible();
  await expect(privacy.getByText('Draft for legal review.', { exact: true })).toBeVisible();
  const terms = await page.context().newPage();
  await terms.goto('/terms');
  await expect(terms.getByRole('heading', { name: 'Terms for the current product' })).toBeVisible();
  await expect(terms.getByText('Draft for legal review.', { exact: true })).toBeVisible();
  await privacy.close();
  await terms.close();

  await page.getByRole('button', { name: 'Start account deletion' }).click();
  await page.getByLabel('Business name confirmation').fill('Completion Salon');
  await page.getByLabel('Current password').fill('correct horse battery staple');
  await page.getByRole('button', { name: 'Delete account permanently' }).click();
  await expect(page.getByRole('heading', { name: /reliable register/i })).toBeVisible();
  await expect(page.getByText('Account and workspace deleted.')).toBeVisible();
});
