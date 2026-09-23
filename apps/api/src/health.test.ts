import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from './app.js';

const config = {
  NODE_ENV: 'test' as const,
  PORT: 4000,
  WEB_ORIGIN: 'http://localhost:3000',
  MONGODB_URI: 'mongodb://127.0.0.1:27017/growthos-test',
  SESSION_SECRET: 'a'.repeat(32),
  COOKIE_SECURE: false,
  PASSWORD_RESET_EXPOSE_TOKEN: false,
};

describe('API boundary', () => {
  it('returns a request-correlated liveness response', async () => {
    const response = await request(createApp({ config }))
      .get('/api/v1/health/live')
      .set('x-request-id', 'health-check-01');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok' });
    expect(response.headers['x-request-id']).toBe('health-check-01');
  });

  it('rejects malformed state-changing requests before persistence', async () => {
    const response = await request(createApp({ config }))
      .post('/api/v1/auth/register')
      .send({ email: 'bad' });
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('CSRF_FAILED');
  });
});
