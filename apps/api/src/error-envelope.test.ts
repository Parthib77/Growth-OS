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

describe('structured error boundary', () => {
  it('returns a request-correlated 404 envelope', async () => {
    const response = await request(createApp({ config }))
      .get('/api/v1/does-not-exist')
      .set('x-request-id', 'missing-01');
    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      error: { code: 'RESOURCE_NOT_FOUND', message: 'Not found.', requestId: 'missing-01' },
    });
  });

  it('returns validation, auth, csrf, and server envelopes', async () => {
    const app = createApp({ config });
    const malformed = await request(app)
      .post('/api/v1/auth/register')
      .set('x-request-id', 'csrf-0001')
      .send({ email: 'not-an-email' });
    expect(malformed.status).toBe(403);
    expect(malformed.body.error).toMatchObject({ code: 'CSRF_FAILED', requestId: 'csrf-0001' });

    const zod = await request(app).get('/api/v1/test/zod');
    expect(zod.status).toBe(400);
    expect(zod.body.error.code).toBe('VALIDATION_FAILED');

    const unauthenticated = await request(app).get('/api/v1/session');
    expect(unauthenticated.status).toBe(401);
    expect(unauthenticated.body.error.code).toBe('UNAUTHENTICATED');

    const serverError = await request(app).get('/api/v1/test/error');
    expect(serverError.status).toBe(500);
    expect(serverError.body.error.code).toBe('INTERNAL_ERROR');
    expect(serverError.body.error.requestId).toBeTruthy();
  });
});
