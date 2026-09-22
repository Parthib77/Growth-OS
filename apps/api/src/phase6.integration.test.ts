import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import {
  ReviewImportCommitResponseSchema,
  ReviewListResponseSchema,
  ReviewResponseSchema,
  ResultsResponseSchema,
  WorkspaceExportSchema,
} from '@growthos/contracts';
import { createApp, connectDatabase, disconnectDatabase } from './app.js';
import {
  AccountDeletionReceipt,
  Booking,
  Campaign,
  CampaignRecipient,
  CampaignRevision,
  CommandReceipt,
  Consent,
  Customer,
  ImportBatch,
  Interaction,
  OperationalEvent,
  Review,
  ReviewImportBatch,
  Session,
  User,
  Workspace,
} from './models.js';

const config = {
  NODE_ENV: 'test' as const,
  PORT: 4000,
  WEB_ORIGIN: 'http://localhost:3000',
  MONGODB_URI: '',
  SESSION_SECRET: 'b'.repeat(32),
  COOKIE_SECURE: false,
};
let replSet: MongoMemoryReplSet;

describe('Phase 6 backend workflows', () => {
  beforeAll(async () => {
    replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    config.MONGODB_URI = replSet.getUri();
    await connectDatabase(config);
  }, 120_000);
  afterAll(async () => {
    await disconnectDatabase();
    if (replSet) await replSet.stop();
  }, 30_000);

  it('persists review transitions, shared Results CSV, export projection, currency lock, and atomic deletion', async () => {
    const agent = request.agent(createApp({ config }));
    const csrf = await agent.get('/api/v1/auth/csrf');
    const registered = await agent
      .post('/api/v1/auth/register')
      .set('x-csrf-token', csrf.body.csrfToken)
      .send({
        email: 'phase6@example.com',
        password: 'correct horse battery staple',
        businessName: 'Phase Six Salon',
      });
    expect(registered.status).toBe(201);
    const token = registered.body.csrfToken as string;
    const workspaceId = registered.body.workspaceId as string;
    const settings = await agent.patch('/api/v1/workspace').set('x-csrf-token', token).send({
      businessName: 'Phase Six Salon',
      category: 'Salon',
      timezone: 'UTC',
      currency: 'USD',
      defaultCountryCode: '+1',
      bookingLink: '',
      followUpDays: 3,
      reviewResponseTemplate: 'Thanks {reviewer_name}',
    });
    expect(settings.status).toBe(200);

    const created = await agent
      .post('/api/v1/reviews')
      .set('x-csrf-token', token)
      .send({ reviewerName: 'Mina', rating: 5, text: 'Wonderful visit', source: 'manual' });
    expect(created.status).toBe(201);
    ReviewResponseSchema.parse(created.body);
    const reviewId = created.body.id as string;
    const draft = await agent
      .patch(`/api/v1/reviews/${reviewId}/response`)
      .set('x-csrf-token', token)
      .send({ action: 'save_draft', text: 'Thank you, Mina.' });
    expect(draft.status).toBe(200);
    const posted = await agent
      .patch(`/api/v1/reviews/${reviewId}/response`)
      .set('x-csrf-token', token)
      .send({ action: 'mark_posted_manually' });
    expect(posted.status).toBe(200);
    expect(posted.body.text).toBe('Wonderful visit');
    const postedSave = await agent
      .patch(`/api/v1/reviews/${reviewId}/response`)
      .set('x-csrf-token', token)
      .send({ action: 'save_draft', text: 'Cannot overwrite a posted response.' });
    expect(postedSave.status).toBe(409);
    const listed = await agent.get('/api/v1/reviews?responseState=posted_manually');
    ReviewListResponseSchema.parse(listed.body);
    expect(listed.body.items[0].response.text).toBe('Thank you, Mina.');
    const event = await OperationalEvent.findOne({
      workspaceId,
      type: 'review.response_changed',
    }).lean();
    expect(JSON.stringify(event?.payload)).not.toContain('Thank you, Mina.');

    const preview = await agent
      .post('/api/v1/review-imports/preview')
      .set('x-csrf-token', token)
      .send({ csv: 'reviewerName,rating,text,source\nNora,4,Good service,google' });
    expect(preview.status).toBe(200);
    const otherAgent = request.agent(createApp({ config }));
    const otherCsrf = await otherAgent.get('/api/v1/auth/csrf');
    const otherRegistration = await otherAgent
      .post('/api/v1/auth/register')
      .set('x-csrf-token', otherCsrf.body.csrfToken)
      .send({
        email: 'phase6-other@example.com',
        password: 'correct horse battery staple',
        businessName: 'Other Salon',
      });
    expect(otherRegistration.status).toBe(201);
    const otherToken = otherRegistration.body.csrfToken as string;
    const otherReview = await otherAgent.get(`/api/v1/reviews?responseState=unanswered`);
    expect(otherReview.status).toBe(200);
    const firstCommit = await agent
      .post(`/api/v1/review-imports/${preview.body.importId}/commit`)
      .set('x-csrf-token', token)
      .send({ resolutions: {} });
    const secondCommit = await agent
      .post(`/api/v1/review-imports/${preview.body.importId}/commit`)
      .set('x-csrf-token', token)
      .send({ resolutions: {} });
    expect(firstCommit.body).toEqual(secondCommit.body);
    ReviewImportCommitResponseSchema.parse(firstCommit.body);
    const crossWorkspaceReview = await otherAgent
      .patch(`/api/v1/reviews/${reviewId}/response`)
      .set('x-csrf-token', otherToken)
      .send({ action: 'save_draft', text: 'cross-tenant' });
    expect(crossWorkspaceReview.status).toBe(404);
    const crossWorkspaceImport = await otherAgent
      .post(`/api/v1/review-imports/${preview.body.importId}/commit`)
      .set('x-csrf-token', otherToken)
      .send({ resolutions: {} });
    expect(crossWorkspaceImport.status).toBe(404);

    const results = await agent.get('/api/v1/results?from=2026-09-22&through=2026-09-22');
    ResultsResponseSchema.parse(results.body);
    expect(results.body.range.throughLocal).toBe('2026-09-22');
    expect(results.body.throughLocal).toBe('2026-09-22');
    expect(results.body.includedBookingStatuses).toEqual([
      'tentative',
      'confirmed',
      'completed',
      'no_show',
    ]);
    expect(typeof results.body.generatedAt).toBe('string');
    const csv = await agent.get('/api/v1/results.csv?from=2026-09-22&through=2026-09-22');
    expect(csv.status).toBe(200);
    expect(csv.text).toContain(`new_enquiries,${results.body.newEnquiries}`);

    const customer = await agent.post('/api/v1/customers').set('x-csrf-token', token).send({
      firstName: 'Quote',
      lastName: 'Lock',
      phone: '+15550009001',
      email: '',
      source: 'manual',
      service: 'Cut',
      quotedMinorUnits: 5000,
      consentChannel: 'phone',
      consentDecision: 'granted',
    });
    expect(customer.status).toBe(201);
    const locked = await agent
      .patch('/api/v1/workspace')
      .set('x-csrf-token', token)
      .send({ currency: 'EUR' });
    expect(locked.status).toBe(409);

    const exported = await agent.get('/api/v1/workspace/export');
    expect(exported.status).toBe(200);
    WorkspaceExportSchema.parse(exported.body);
    expect(exported.headers['content-disposition']).toContain('attachment');
    expect(exported.headers['cache-control']).toBe('no-store');
    expect(JSON.stringify(exported.body)).not.toContain('passwordHash');
    expect(JSON.stringify(exported.body)).not.toContain('normalizedPhone');
    const otherExport = await otherAgent.get('/api/v1/workspace/export');
    expect(otherExport.status).toBe(200);
    expect(JSON.stringify(otherExport.body)).not.toContain('Wonderful visit');

    const emptySettings = await agent
      .patch('/api/v1/workspace')
      .set('x-csrf-token', token)
      .send({});
    expect(emptySettings.status).toBe(400);
    const wrongPassword = await agent
      .delete('/api/v1/workspace/account')
      .set('x-csrf-token', token)
      .send({ password: 'wrong password', businessNameConfirmation: 'Phase Six Salon' });
    expect(wrongPassword.status).toBe(401);
    expect(await Workspace.countDocuments({ _id: workspaceId })).toBe(1);

    const refused = await agent
      .delete('/api/v1/workspace/account')
      .set('x-csrf-token', token)
      .send({ password: 'correct horse battery staple', businessNameConfirmation: 'wrong' });
    expect(refused.status).toBe(400);
    expect(await Workspace.countDocuments({ _id: workspaceId })).toBe(1);
    const deleted = await agent
      .delete('/api/v1/workspace/account')
      .set('x-csrf-token', token)
      .send({
        password: 'correct horse battery staple',
        businessNameConfirmation: 'Phase Six Salon',
      });
    expect(deleted.status).toBe(204);
    expect(await User.countDocuments({ _id: registered.body.userId })).toBe(0);
    expect(await Session.countDocuments({ userId: registered.body.userId })).toBe(0);
    expect(await Review.countDocuments({ workspaceId })).toBe(0);
    expect(await ReviewImportBatch.countDocuments({ workspaceId })).toBe(0);
    expect(await ImportBatch.countDocuments({ workspaceId })).toBe(0);
    expect(await CommandReceipt.countDocuments({ workspaceId })).toBe(0);
    expect(await CampaignRecipient.countDocuments({ workspaceId })).toBe(0);
    expect(await CampaignRevision.countDocuments({ workspaceId })).toBe(0);
    expect(await Campaign.countDocuments({ workspaceId })).toBe(0);
    expect(await Booking.countDocuments({ workspaceId })).toBe(0);
    expect(await Consent.countDocuments({ workspaceId })).toBe(0);
    expect(await Interaction.countDocuments({ workspaceId })).toBe(0);
    expect(await Customer.countDocuments({ workspaceId })).toBe(0);
    expect(await OperationalEvent.countDocuments({ workspaceId })).toBe(0);
    expect(await Workspace.countDocuments({ _id: workspaceId })).toBe(0);
    const receipt = await AccountDeletionReceipt.findOne({
      requestId: deleted.headers['x-request-id'],
    }).lean();
    expect(receipt).toBeTruthy();
    expect(receipt).not.toHaveProperty('userId');
    expect(receipt).not.toHaveProperty('workspaceId');
    expect(JSON.stringify(receipt)).not.toContain(registered.body.userId);
    expect(JSON.stringify(receipt)).not.toContain(workspaceId);
    expect(
      await AccountDeletionReceipt.countDocuments({ requestId: deleted.headers['x-request-id'] }),
    ).toBe(1);
    expect((await agent.get('/api/v1/workspace')).status).toBe(401);
  });
});
