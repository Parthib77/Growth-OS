import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import {
  CampaignListResponseSchema,
  ResultsResponseSchema,
  ReviewListResponseSchema,
  WorkspaceResponseSchema,
} from '@growthos/contracts';
import { createApp, connectDatabase, disconnectDatabase } from './app.js';
import { DEMO_ACCOUNT, seedDemoWorkspace } from './demo/seed.js';
import { Customer, OperationalEvent, User, Workspace } from './models.js';

const config = {
  NODE_ENV: 'test' as const,
  PORT: 4000,
  WEB_ORIGIN: 'http://localhost:3000',
  MONGODB_URI: '',
  SESSION_SECRET: 'd'.repeat(32),
  COOKIE_SECURE: false,
};
let replSet: MongoMemoryReplSet;

describe('database-backed demo workspace', () => {
  beforeAll(async () => {
    replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    config.MONGODB_URI = replSet.getUri();
    await connectDatabase(config);
  }, 120_000);

  afterAll(async () => {
    await disconnectDatabase();
    if (replSet) await replSet.stop();
  }, 30_000);

  it('seeds once, preserves later changes, and serves every fixture through the real API', async () => {
    const first = await seedDemoWorkspace({ now: new Date('2026-09-23T12:00:00.000Z') });
    expect(first.status).toBe('created');
    expect(await Customer.countDocuments({ workspaceId: first.workspaceId })).toBe(3);
    expect(await OperationalEvent.countDocuments({ workspaceId: first.workspaceId })).toBe(10);

    await Workspace.updateOne(
      { _id: first.workspaceId },
      { $set: { businessName: 'Operator changed this demo' } },
    );
    const second = await seedDemoWorkspace({ now: new Date('2026-10-01T12:00:00.000Z') });
    expect(second).toEqual({ ...first, status: 'exists' });
    expect((await Workspace.findById(first.workspaceId).lean())?.businessName).toBe(
      'Operator changed this demo',
    );
    expect(await Customer.countDocuments({ workspaceId: first.workspaceId })).toBe(3);
    expect(await OperationalEvent.countDocuments({ workspaceId: first.workspaceId })).toBe(10);

    const agent = request.agent(createApp({ config }));
    const anonymous = await agent.get('/api/v1/auth/csrf');
    const signedIn = await agent
      .post('/api/v1/auth/sign-in')
      .set('x-csrf-token', anonymous.body.csrfToken)
      .send({ email: DEMO_ACCOUNT.email, password: DEMO_ACCOUNT.password });
    expect(signedIn.status).toBe(200);

    const workspace = await agent.get('/api/v1/workspace');
    expect(WorkspaceResponseSchema.parse(workspace.body).isDemo).toBe(true);
    const today = await agent.get('/api/v1/today');
    expect(today.status).toBe(200);
    expect(today.body.items).toHaveLength(2);
    const campaigns = await agent.get('/api/v1/campaigns');
    expect(CampaignListResponseSchema.parse(campaigns.body).items).toHaveLength(1);
    const reviews = await agent.get('/api/v1/reviews');
    expect(ReviewListResponseSchema.parse(reviews.body).items).toHaveLength(2);
    const results = await agent.get('/api/v1/results?from=2026-09-01&through=2026-09-30');
    const parsedResults = ResultsResponseSchema.parse(results.body);
    expect(parsedResults.newEnquiries).toBe(3);
    expect(parsedResults.recordedBookingValue.minorUnits).toBe(9800);
  });

  it('refuses to claim an existing non-demo account', async () => {
    const agent = request.agent(createApp({ config }));
    const csrf = await agent.get('/api/v1/auth/csrf');
    const registered = await agent
      .post('/api/v1/auth/register')
      .set('x-csrf-token', csrf.body.csrfToken)
      .send({
        email: 'ordinary@example.com',
        password: 'correct horse battery staple',
        businessName: 'Ordinary Workspace',
      });
    expect(registered.status).toBe(201);
    await expect(seedDemoWorkspace({ email: 'ordinary@example.com' })).rejects.toThrow(
      'non-demo account',
    );
    expect(await User.countDocuments({ normalizedEmail: 'ordinary@example.com' })).toBe(1);
  });

  it('converges when two operators seed the same demo concurrently', async () => {
    const email = 'concurrent-demo@growthos.local';
    const attempts = await Promise.all([
      seedDemoWorkspace({ email, now: new Date('2026-09-23T12:00:00.000Z') }),
      seedDemoWorkspace({ email, now: new Date('2026-09-23T12:00:00.000Z') }),
    ]);
    expect(attempts.map((attempt) => attempt.status).sort()).toEqual(['created', 'exists']);
    expect(await User.countDocuments({ normalizedEmail: email })).toBe(1);
    expect(await Workspace.countDocuments({ ownerUserId: attempts[0].userId, isDemo: true })).toBe(
      1,
    );
  });
});
