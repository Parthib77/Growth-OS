import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './apps/web/tests',
  use: { baseURL: 'http://127.0.0.1:3000', trace: 'retain-on-failure' },
  webServer: [
    ...(process.env.GROWTHOS_E2E_MONGODB_URI
      ? [
          {
            command: 'npm run dev --workspace @growthos/api',
            url: 'http://127.0.0.1:4000/api/v1/health/live',
            reuseExistingServer: !process.env.CI,
            timeout: 120_000,
            env: {
              ...process.env,
              NODE_ENV: 'test',
              MONGODB_URI: process.env.GROWTHOS_E2E_MONGODB_URI,
              SESSION_SECRET: process.env.GROWTHOS_E2E_SESSION_SECRET || 'a'.repeat(32),
              WEB_ORIGIN: 'http://127.0.0.1:3000',
              COOKIE_SECURE: 'false',
            },
          },
        ]
      : []),
    {
      command: 'npm run dev --workspace @growthos/web',
      url: 'http://127.0.0.1:3000',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'phone', use: { ...devices['iPhone 13'] } },
  ],
});
