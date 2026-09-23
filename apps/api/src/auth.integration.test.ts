import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import {
  PasswordResetCompleteResponseSchema,
  PasswordResetRequestResponseSchema,
} from '@growthos/contracts';
import { createApp, connectDatabase, disconnectDatabase } from './app.js';
import { hashToken } from './ids.js';
import { PasswordReset } from './models.js';

const config = {
  NODE_ENV: 'test' as const,
  PORT: 4000,
  WEB_ORIGIN: 'http://localhost:3000',
  MONGODB_URI: '',
  SESSION_SECRET: 'r'.repeat(32),
  COOKIE_SECURE: false,
  PASSWORD_RESET_EXPOSE_TOKEN: true,
};
let replSet: MongoMemoryReplSet;

describe('password reset', () => {
  beforeAll(async () => {
    replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    config.MONGODB_URI = replSet.getUri();
    await connectDatabase(config);
  }, 120_000);

  afterAll(async () => {
    await disconnectDatabase();
    if (replSet) await replSet.stop();
  }, 30_000);

  it('uses a hashed single-use token, revokes old sessions, and signs in with the new password', async () => {
    const oldPassword = 'correct horse battery staple';
    const newPassword = 'a newer correct horse battery staple';
    const owner = request.agent(createApp({ config }));
    const ownerCsrf = await owner.get('/api/v1/auth/csrf');
    const registered = await owner
      .post('/api/v1/auth/register')
      .set('x-csrf-token', ownerCsrf.body.csrfToken)
      .send({ email: 'reset@example.com', password: oldPassword, businessName: 'Reset Salon' });
    expect(registered.status).toBe(201);

    const secondSession = request.agent(createApp({ config }));
    const secondCsrf = await secondSession.get('/api/v1/auth/csrf');
    const secondSignIn = await secondSession
      .post('/api/v1/auth/sign-in')
      .set('x-csrf-token', secondCsrf.body.csrfToken)
      .send({ email: 'reset@example.com', password: oldPassword });
    expect(secondSignIn.status).toBe(200);

    const resetAgent = request.agent(createApp({ config }));
    const anonymousCsrf = await resetAgent.get('/api/v1/auth/csrf');
    const unknown = await resetAgent
      .post('/api/v1/auth/password-reset-requests')
      .set('x-csrf-token', anonymousCsrf.body.csrfToken)
      .send({ email: 'missing@example.com' });
    const requested = await resetAgent
      .post('/api/v1/auth/password-reset-requests')
      .set('x-csrf-token', anonymousCsrf.body.csrfToken)
      .send({ email: 'reset@example.com' });
    expect(unknown.status).toBe(202);
    expect(requested.status).toBe(202);
    expect(PasswordResetRequestResponseSchema.parse(unknown.body).message).toBe(
      PasswordResetRequestResponseSchema.parse(requested.body).message,
    );
    const token = requested.body.developmentResetToken as string;
    expect(token).toBeTruthy();
    expect(await PasswordReset.findOne({ tokenHash: hashToken(token) })).not.toBeNull();
    expect(await PasswordReset.findOne({ tokenHash: token })).toBeNull();

    const completed = await resetAgent
      .post('/api/v1/auth/password-resets')
      .set('x-csrf-token', anonymousCsrf.body.csrfToken)
      .send({ token, password: newPassword });
    expect(completed.status).toBe(200);
    PasswordResetCompleteResponseSchema.parse(completed.body);
    expect(
      (await PasswordReset.findOne({ tokenHash: hashToken(token) }).lean())?.usedAt,
    ).toBeTruthy();
    expect((await resetAgent.get('/api/v1/workspace')).status).toBe(200);
    expect((await owner.get('/api/v1/workspace')).status).toBe(401);
    expect((await secondSession.get('/api/v1/workspace')).status).toBe(401);

    const reused = await resetAgent
      .post('/api/v1/auth/password-resets')
      .set('x-csrf-token', completed.body.csrfToken)
      .send({ token, password: 'another valid replacement password' });
    expect(reused.status).toBe(401);

    const oldPasswordAgent = request.agent(createApp({ config }));
    const oldCsrf = await oldPasswordAgent.get('/api/v1/auth/csrf');
    expect(
      (
        await oldPasswordAgent
          .post('/api/v1/auth/sign-in')
          .set('x-csrf-token', oldCsrf.body.csrfToken)
          .send({ email: 'reset@example.com', password: oldPassword })
      ).status,
    ).toBe(401);
    const newPasswordAgent = request.agent(createApp({ config }));
    const newCsrf = await newPasswordAgent.get('/api/v1/auth/csrf');
    expect(
      (
        await newPasswordAgent
          .post('/api/v1/auth/sign-in')
          .set('x-csrf-token', newCsrf.body.csrfToken)
          .send({ email: 'reset@example.com', password: newPassword })
      ).status,
    ).toBe(200);
  });

  it('does not create an undeliverable token when delivery is not configured', async () => {
    const noDeliveryConfig = { ...config, PASSWORD_RESET_EXPOSE_TOKEN: false };
    const agent = request.agent(createApp({ config: noDeliveryConfig }));
    const csrf = await agent.get('/api/v1/auth/csrf');
    const before = await PasswordReset.countDocuments();
    const response = await agent
      .post('/api/v1/auth/password-reset-requests')
      .set('x-csrf-token', csrf.body.csrfToken)
      .send({ email: 'reset@example.com' });
    expect(response.status).toBe(202);
    expect(response.body.developmentResetToken).toBeUndefined();
    expect(await PasswordReset.countDocuments()).toBe(before);
  });
});
