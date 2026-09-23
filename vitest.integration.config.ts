import { defineConfig } from 'vitest/config';

process.env.MONGOMS_VERSION ??= '8.0.6';

export default defineConfig({
  test: {
    include: ['apps/**/*.integration.test.ts'],
    environment: 'node',
    testTimeout: 120_000,
    hookTimeout: 120_000,
  },
});
