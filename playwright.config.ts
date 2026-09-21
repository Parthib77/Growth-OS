import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './apps/web/tests',
  use: { baseURL: 'http://127.0.0.1:3000', trace: 'retain-on-failure' },
  webServer: [
    {
      command: 'npm run e2e:api',
      url: 'http://127.0.0.1:4000/api/v1/health/live',
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        ...process.env,
        MONGOMS_VERSION: process.env.MONGOMS_VERSION || '8.0.6',
        MONGOMS_RUNTIME_DOWNLOAD: process.env.GROWTHOS_ALLOW_MONGODB_DOWNLOAD === '1' ? '1' : '0',
      },
    },
    {
      command: 'npm run dev --workspace @growthos/web',
      url: 'http://127.0.0.1:3000',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'phone', use: { ...devices['iPhone 13'], browserName: 'chromium' } },
  ],
});
