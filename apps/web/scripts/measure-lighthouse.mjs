import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '@playwright/test';
import { launch } from 'chrome-launcher';
import lighthouse from 'lighthouse';
import desktopConfig from 'lighthouse/core/config/desktop-config.js';

const baseUrl = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';
const reportDirectory = path.resolve('docs/performance');

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
const page = await context.newPage();
await page.goto(baseUrl);
await page.getByRole('button', { name: 'Already have an account? Sign in.' }).click();
await page.getByLabel('Email').fill('demo@growthos.local');
await page.getByLabel('Password').fill('DemoWorkspace!2026');
await page.getByRole('button', { name: 'Sign in', exact: true }).click();
await page.getByRole('heading', { name: 'Who needs attention?' }).waitFor();
await page.getByText('Loading bookings and results…').waitFor({ state: 'hidden' });
const cookies = await context.cookies(baseUrl);
await browser.close();

const chrome = await launch({
  chromePath: chromium.executablePath(),
  chromeFlags: ['--headless', '--no-sandbox', '--disable-gpu'],
});

try {
  const result = await lighthouse(
    baseUrl,
    {
      port: chrome.port,
      output: ['json', 'html'],
      logLevel: 'error',
      onlyCategories: ['performance', 'accessibility'],
      extraHeaders: {
        Cookie: cookies.map(({ name, value }) => `${name}=${value}`).join('; '),
      },
    },
    desktopConfig,
  );
  if (!result || !Array.isArray(result.report)) throw new Error('Lighthouse returned no reports.');

  await mkdir(reportDirectory, { recursive: true });
  await writeFile(path.join(reportDirectory, 'lighthouse-today.json'), result.report[0]);
  await writeFile(path.join(reportDirectory, 'lighthouse-today.html'), result.report[1]);

  const performance = Math.round((result.lhr.categories.performance?.score || 0) * 100);
  const accessibility = Math.round((result.lhr.categories.accessibility?.score || 0) * 100);
  const cumulativeLayoutShift = result.lhr.audits['cumulative-layout-shift']?.numericValue;
  process.stdout.write(
    `${JSON.stringify({ accessibility, cumulativeLayoutShift, performance })}\n`,
  );
  if (performance < 90 || accessibility < 95 || (cumulativeLayoutShift ?? 1) > 0.1)
    process.exitCode = 1;
} finally {
  await chrome.kill();
}
