import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import {
  BookingResponseSchema,
  CustomerResponseSchema,
  RegisterResponseSchema,
  ResultsResponseSchema,
} from '@growthos/contracts';
import { createApp, connectDatabase, disconnectDatabase } from './app.js';
import { Booking, CommandReceipt, OperationalEvent } from './models.js';

const config = {
  NODE_ENV: 'test' as const,
  PORT: 4000,
  WEB_ORIGIN: 'http://localhost:3000',
  MONGODB_URI: '',
  SESSION_SECRET: 'a'.repeat(32),
  COOKIE_SECURE: false,
};
let replSet: MongoMemoryReplSet;

async function authenticatedAgent(email: string, businessName: string) {
  const agent = request.agent(createApp({ config }));
  const csrf = await agent.get('/api/v1/auth/csrf');
  const registration = await agent
    .post('/api/v1/auth/register')
    .set('x-csrf-token', csrf.body.csrfToken)
    .send({ email, password: 'correct horse battery staple', businessName });
  expect(registration.status).toBe(201);
  RegisterResponseSchema.parse(registration.body);
  return {
    agent,
    csrf: registration.body.csrfToken as string,
    workspaceId: registration.body.workspaceId as string,
  };
}

describe('vertical slice with a real MongoDB replica set', () => {
  beforeAll(async () => {
    replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    config.MONGODB_URI = replSet.getUri();
    await connectDatabase(config);
  }, 120_000);
  afterAll(async () => {
    await disconnectDatabase();
    if (replSet) await replSet.stop();
  }, 30_000);

  it('registers, onboards, stores an enquiry, records an idempotent booking, and isolates workspaces', async () => {
    const readiness = await request(createApp({ config })).get('/api/v1/health/ready');
    expect(readiness.status).toBe(200);
    expect(readiness.body).toEqual({ status: 'ready' });
    const one = await authenticatedAgent('one@example.com', 'One Salon');
    expect(
      await OperationalEvent.countDocuments({
        workspaceId: one.workspaceId,
        type: 'account.registered',
      }),
    ).toBe(1);
    const retryAgent = request.agent(createApp({ config }));
    const retryCsrf = await retryAgent.get('/api/v1/auth/csrf');
    const retryRegistration = await retryAgent
      .post('/api/v1/auth/register')
      .set('x-csrf-token', retryCsrf.body.csrfToken)
      .send({
        email: 'one@example.com',
        password: 'correct horse battery staple',
        businessName: 'One Salon',
      });
    expect(retryRegistration.status).toBe(201);
    expect(retryRegistration.body.workspaceId).toBe(one.workspaceId);
    const conflictRegistration = await retryAgent
      .post('/api/v1/auth/register')
      .set('x-csrf-token', retryRegistration.body.csrfToken)
      .send({
        email: 'one@example.com',
        password: 'a different password',
        businessName: 'One Salon',
      });
    expect(conflictRegistration.status).toBe(409);
    const onboard = await one.agent.patch('/api/v1/workspace').set('x-csrf-token', one.csrf).send({
      businessName: 'One Salon',
      category: 'Salon',
      timezone: 'UTC',
      currency: 'USD',
      defaultCountryCode: '+1',
      bookingLink: '',
      followUpDays: 3,
    });
    expect(onboard.status).toBe(200);
    const customer = await one.agent.post('/api/v1/customers').set('x-csrf-token', one.csrf).send({
      firstName: 'Asha',
      lastName: 'Patel',
      phone: '+15550001001',
      email: 'asha@example.com',
      source: 'Phone call',
      service: 'Colour consultation',
      quotedMinorUnits: 18500,
      consentChannel: 'whatsapp',
      consentDecision: 'granted',
    });
    expect(customer.status).toBe(201);
    CustomerResponseSchema.parse(customer.body);
    expect((await one.agent.get('/api/v1/today')).body.items[0].reasons.join(' ')).toContain(
      'Consent recorded',
    );
    const bookingBody = {
      customerId: customer.body.id,
      service: 'Colour consultation',
      appointmentAt: '2026-10-07T13:00:00.000Z',
      agreedMinorUnits: 20000,
      currency: 'USD',
      notes: '',
    };
    const firstBooking = await one.agent
      .post('/api/v1/bookings')
      .set('x-csrf-token', one.csrf)
      .set('idempotency-key', 'booking-one-0001')
      .send(bookingBody);
    const retry = await one.agent
      .post('/api/v1/bookings')
      .set('x-csrf-token', one.csrf)
      .set('idempotency-key', 'booking-one-0001')
      .send(bookingBody);
    expect(firstBooking.status).toBe(201);
    BookingResponseSchema.parse(firstBooking.body);
    ResultsResponseSchema.parse((await one.agent.get('/api/v1/results')).body);
    expect(retry.body.id).toBe(firstBooking.body.id);
    expect((await one.agent.get(`/api/v1/customers/${customer.body.id}`)).status).toBe(200);
    const storedEvent = await OperationalEvent.findOne({
      workspaceId: one.workspaceId,
      type: 'booking.recorded',
    }).lean();
    expect(typeof storedEvent?.eventId).toBe('string');
    expect(storedEvent).toMatchObject({
      schemaVersion: 1,
      actorKind: 'user',
      ordinal: 0,
      payload: { type: 'booking.recorded' },
    });
    expect(
      await CommandReceipt.countDocuments({
        workspaceId: one.workspaceId,
        operation: 'booking.record',
      }),
    ).toBe(1);
    expect((await one.agent.get('/api/v1/results')).body.recordedBookingValue.minorUnits).toBe(
      20000,
    );
    const two = await authenticatedAgent('two@example.com', 'Two Salon');
    const crossRead = await two.agent.get(`/api/v1/customers/${customer.body.id}`);
    expect(crossRead.status).toBe(404);
    expect((await two.agent.get('/api/v1/today')).body.items).toHaveLength(0);
    expect((await two.agent.get('/api/v1/bookings')).body.items).toHaveLength(0);
    expect((await two.agent.get('/api/v1/results')).body.newEnquiries).toBe(0);
    expect(await Booking.countDocuments({ workspaceId: two.workspaceId })).toBe(0);
  }, 120_000);
});
