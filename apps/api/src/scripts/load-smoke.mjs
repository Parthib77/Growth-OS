import { mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { request } from '@playwright/test';

const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';
const concurrency = 12;
const requestCount = 240;
const paths = [
  '/api/v1/today',
  '/api/v1/results',
  '/api/v1/customers?limit=20',
  '/api/v1/campaigns',
  '/api/v1/reviews',
  '/api/v1/bookings',
];

const context = await request.newContext({ baseURL });
try {
  const csrfResponse = await context.get('/api/v1/auth/csrf');
  const { csrfToken } = await csrfResponse.json();
  const signIn = await context.post('/api/v1/auth/sign-in', {
    data: { email: 'demo@growthos.local', password: 'DemoWorkspace!2026' },
    headers: {
      origin: baseURL,
      'sec-fetch-site': 'same-origin',
      'x-csrf-token': csrfToken,
    },
  });
  if (!signIn.ok()) throw new Error(`Demo sign-in failed with HTTP ${signIn.status()}.`);

  await Promise.all(paths.map((requestPath) => context.get(requestPath)));
  const latencies = [];
  const failures = [];
  const startedAt = performance.now();

  for (let offset = 0; offset < requestCount; offset += concurrency) {
    const batch = Array.from(
      { length: Math.min(concurrency, requestCount - offset) },
      (_, index) => {
        const requestPath = paths[(offset + index) % paths.length];
        return (async () => {
          const requestStartedAt = performance.now();
          const response = await context.get(requestPath);
          latencies.push(performance.now() - requestStartedAt);
          if (!response.ok()) failures.push({ path: requestPath, status: response.status() });
        })();
      },
    );
    await Promise.all(batch);
  }

  const durationSeconds = (performance.now() - startedAt) / 1000;
  latencies.sort((left, right) => left - right);
  const percentile = (value) =>
    Math.round(latencies[Math.min(latencies.length - 1, Math.ceil(latencies.length * value) - 1)]);
  const report = {
    measuredAt: new Date().toISOString(),
    target: baseURL,
    workload: { concurrency, requestCount, paths },
    environment: {
      cpu: os.cpus()[0]?.model,
      logicalCpuCount: os.cpus().length,
      memoryGiB: Math.round((os.totalmem() / 1024 ** 3) * 10) / 10,
      node: process.version,
      platform: `${process.platform} ${os.release()}`,
    },
    result: {
      durationSeconds: Math.round(durationSeconds * 100) / 100,
      errors: failures,
      latencyMs: {
        p50: percentile(0.5),
        p95: percentile(0.95),
        p99: percentile(0.99),
        max: Math.round(latencies.at(-1) || 0),
      },
      requestsPerSecond: Math.round((requestCount / durationSeconds) * 10) / 10,
    },
  };

  const reportDirectory = path.resolve('docs/performance');
  await mkdir(reportDirectory, { recursive: true });
  await writeFile(
    path.join(reportDirectory, 'api-load-smoke.json'),
    `${JSON.stringify(report, null, 2)}\n`,
  );
  process.stdout.write(`${JSON.stringify(report.result)}\n`);
  if (failures.length > 0) process.exitCode = 1;
} finally {
  await context.dispose();
}
