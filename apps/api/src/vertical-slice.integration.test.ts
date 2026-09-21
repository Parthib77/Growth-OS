import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { createApp, connectDatabase, disconnectDatabase } from './app.js';

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
    const one = await authenticatedAgent('one@example.com', 'One Salon');
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
    expect(retry.body.id).toBe(firstBooking.body.id);
    expect((await one.agent.get('/api/v1/results')).body.recordedBookingValue.minorUnits).toBe(
      20000,
    );
    const two = await authenticatedAgent('two@example.com', 'Two Salon');
    const crossRead = await two.agent.get(`/api/v1/customers/${customer.body.id}`);
    expect(crossRead.status).toBe(404);
  }, 120_000);
});
