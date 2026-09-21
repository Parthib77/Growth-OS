import express, { type NextFunction, type Request, type Response } from 'express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import mongoose from 'mongoose';
import { randomUUID, createHash } from 'node:crypto';
import { z } from 'zod';
import { buildOpenApi } from '@growthos/contracts';
import {
  CreateBookingRequestSchema,
  CreateCustomerRequestSchema,
  OnboardingRequestSchema,
  RegisterRequestSchema,
  SignInRequestSchema,
} from '@growthos/contracts';
import { readConfig, type AppConfig } from './config.js';
import { AppError, errorBody, errorHandler } from './errors.js';
import { hashToken, newId, newToken, normalizeEmail, normalizePhone } from './ids.js';
import {
  Booking,
  Consent,
  Customer,
  OperationalEvent,
  Session,
  User,
  Workspace,
  ensureIndexes,
} from './models.js';
import {
  clearSessionCookie,
  issueAnonymousCsrf,
  requireCsrf,
  requireSession,
  rotateSession,
  sessionCookieName,
  setSessionCookie,
  verify,
} from './auth.js';

export type AppOptions = { config?: AppConfig; connect?: boolean };

function fingerprint(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function dateValue(value: Date | string | undefined): string {
  return new Date(value ?? Date.now()).toISOString();
}

function workspaceView(workspace: {
  _id: unknown;
  businessName: string;
  category?: string | null;
  timezone: string;
  currency: string;
  defaultCountryCode: string;
  bookingLink?: string;
  followUpDays: number;
  onboardingComplete: boolean;
}) {
  return {
    id: String(workspace._id),
    businessName: workspace.businessName,
    category: workspace.category ?? null,
    timezone: workspace.timezone,
    currency: workspace.currency,
    defaultCountryCode: workspace.defaultCountryCode,
    bookingLink: workspace.bookingLink || null,
    followUpDays: workspace.followUpDays,
    onboardingComplete: workspace.onboardingComplete,
  };
}

function customerView(customer: any, consent: any, currency = 'USD') {
  return {
    id: String(customer._id),
    firstName: customer.firstName,
    lastName: customer.lastName,
    phone: customer.phone,
    email: customer.email || null,
    source: customer.source,
    service: customer.service,
    quotedMoney:
      customer.quotedMinorUnits == null
        ? null
        : { currency, minorUnits: customer.quotedMinorUnits },
    consent: consent ? { channel: consent.channel, decision: consent.decision } : null,
    lifecycle: customer.lifecycle,
    lastInteractionAt: dateValue(customer.lastInteractionAt),
  };
}

async function latestConsents(workspaceId: string, customerIds: string[]) {
  const rows = await Consent.find({ workspaceId, customerId: { $in: customerIds } })
    .sort({ capturedAt: -1, _id: -1 })
    .lean();
  const map = new Map<string, any>();
  for (const row of rows) if (!map.has(row.customerId)) map.set(row.customerId, row);
  return map;
}

function addEvent(
  input: {
    workspaceId: string;
    userId: string;
    requestId: string;
    commandId: string;
    subjectKind: string;
    subjectId: string;
    type: string;
    payload: Record<string, unknown>;
  },
  session?: mongoose.ClientSession,
) {
  return OperationalEvent.create(
    [
      {
        workspaceId: input.workspaceId,
        actorUserId: input.userId,
        requestId: input.requestId,
        commandId: input.commandId,
        ordinal: 0,
        occurredAt: new Date(),
        subjectKind: input.subjectKind,
        subjectId: input.subjectId,
        type: input.type,
        payload: input.payload,
      },
    ],
    { session },
  );
}

export function createApp(options: AppOptions = {}) {
  const config = options.config ?? readConfig();
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(express.json({ limit: '100kb', strict: true }));
  app.use(cookieParser());
  app.use((req, res, next) => {
    req.requestId = req.get('x-request-id')?.match(/^[a-zA-Z0-9._-]{8,80}$/)?.[0] ?? randomUUID();
    res.setHeader('x-request-id', req.requestId);
    next();
  });
  app.use((req, _res, next) => {
    if (
      ['POST', 'PATCH', 'PUT', 'DELETE'].includes(req.method) &&
      req.path.startsWith('/api/v1') &&
      req.path !== '/api/v1/auth/csrf'
    )
      return requireCsrf(config)(req, _res, next);
    next();
  });
  app.use(errorHandler);
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (_req, res) =>
      res.status(429).json({
        error: {
          code: 'RATE_LIMITED',
          message: 'Too many attempts. Try again later.',
          requestId: res.getHeader('x-request-id'),
        },
      }),
  });
  app.use('/api/v1/auth/register', authLimiter);
  app.use('/api/v1/auth/sign-in', authLimiter);

  const api = express.Router();
  api.get('/health/live', (_req, res) => res.json({ status: 'ok' }));
  api.get('/health/ready', async (_req, res) => {
    try {
      if (mongoose.connection.readyState !== 1) throw new Error('database not connected');
      await ensureIndexes();
      res.json({ status: 'ready' });
    } catch {
      res.status(503).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Database is not ready.',
          requestId: String(res.getHeader('x-request-id')),
        },
      });
    }
  });
  api.get('/auth/csrf', async (_req, res, next) => {
    try {
      res.json({ csrfToken: await issueAnonymousCsrf(res, config) });
    } catch (e) {
      next(e);
    }
  });

  api.post('/auth/register', async (req, res, next) => {
    try {
      const input = RegisterRequestSchema.parse(req.body);
      const email = normalizeEmail(input.email);
      if (await User.exists({ normalizedEmail: email }))
        throw new AppError('CONFLICT', 'An account with this email already exists.', 409);
      const userId = newId();
      const workspaceId = newId();
      const passwordHash = await (
        await import('argon2')
      ).hash(input.password, { type: (await import('argon2')).argon2id });
      const session = await mongoose.startSession();
      let created;
      try {
        await session.withTransaction(async () => {
          await User.create(
            [
              {
                _id: userId,
                email: input.email.trim(),
                normalizedEmail: email,
                passwordHash,
                sessionGeneration: 0,
              },
            ],
            { session },
          );
          await Workspace.create(
            [
              {
                _id: workspaceId,
                ownerUserId: userId,
                businessName: input.businessName.trim(),
                onboardingComplete: false,
              },
            ],
            { session },
          );
        });
        const csrf = await rotateSession(
          res,
          config,
          userId,
          workspaceId,
          0,
          req.cookies?.[sessionCookieName(config)],
        );
        created = { userId, workspaceId, csrfToken: csrf.csrfToken };
      } finally {
        await session.endSession();
      }
      res.status(201).json({ userId, workspaceId, csrfToken: created?.csrfToken });
    } catch (e) {
      next(e);
    }
  });

  api.post('/auth/sign-in', async (req, res, next) => {
    try {
      const input = SignInRequestSchema.parse(req.body);
      const email = normalizeEmail(input.email);
      const user = await User.findOne({ normalizedEmail: email });
      if (!user || !(await verify(user.passwordHash, input.password).catch(() => false)))
        throw new AppError('UNAUTHENTICATED', 'Email or password is incorrect.', 401);
      const workspace = await Workspace.findOne({ ownerUserId: String(user._id) });
      if (!workspace) throw new AppError('UNAUTHENTICATED', 'Email or password is incorrect.', 401);
      const csrf = await rotateSession(
        res,
        config,
        String(user._id),
        String(workspace._id),
        user.sessionGeneration,
      );
      res.json({
        userId: String(user._id),
        workspaceId: String(workspace._id),
        csrfToken: csrf.csrfToken,
      });
    } catch (e) {
      next(e);
    }
  });
  api.post('/auth/sign-out', requireSession(config), async (req, res, next) => {
    try {
      await Session.updateOne({ _id: req.auth!.sessionId }, { $set: { revokedAt: new Date() } });
      clearSessionCookie(res, config);
      res.status(204).send();
    } catch (e) {
      next(e);
    }
  });
  api.get('/session', requireSession(config), (req, res) =>
    res.json({ userId: req.auth!.userId, workspaceId: req.auth!.workspaceId }),
  );

  api.get('/workspace', requireSession(config), async (req, res, next) => {
    try {
      const workspace = await Workspace.findOne({
        _id: req.auth!.workspaceId,
        ownerUserId: req.auth!.userId,
      });
      if (!workspace) throw new AppError('RESOURCE_NOT_FOUND', 'Workspace not found.', 404);
      res.json(workspaceView(workspace));
    } catch (e) {
      next(e);
    }
  });
  api.patch('/workspace', requireSession(config), async (req, res, next) => {
    try {
      const input = OnboardingRequestSchema.parse(req.body);
      const workspace = await Workspace.findOneAndUpdate(
        { _id: req.auth!.workspaceId, ownerUserId: req.auth!.userId },
        { $set: { ...input, bookingLink: input.bookingLink || '', onboardingComplete: true } },
        { new: true },
      );
      if (!workspace) throw new AppError('RESOURCE_NOT_FOUND', 'Workspace not found.', 404);
      res.json(workspaceView(workspace));
    } catch (e) {
      next(e);
    }
  });

  api.get('/customers', requireSession(config), async (req, res, next) => {
    try {
      const workspace = await Workspace.findById(req.auth!.workspaceId);
      if (!workspace) throw new AppError('RESOURCE_NOT_FOUND', 'Workspace not found.', 404);
      const pageSize = Math.min(Number(req.query.limit ?? 50) || 50, 100);
      const customers = await Customer.find({ workspaceId: req.auth!.workspaceId })
        .sort({ lastInteractionAt: -1, _id: -1 })
        .limit(pageSize)
        .lean();
      const consents = await latestConsents(
        req.auth!.workspaceId,
        customers.map((c) => String(c._id)),
      );
      res.json({
        items: customers.map((c) =>
          customerView(c, consents.get(String(c._id)), workspace.currency),
        ),
        nextCursor: null,
      });
    } catch (e) {
      next(e);
    }
  });
  api.post('/customers', requireSession(config), async (req, res, next) => {
    try {
      const input = CreateCustomerRequestSchema.parse(req.body);
      const workspace = await Workspace.findById(req.auth!.workspaceId);
      if (!workspace) throw new AppError('RESOURCE_NOT_FOUND', 'Workspace not found.', 404);
      const normalizedPhone = normalizePhone(input.phone);
      const normalizedEmail = input.email ? normalizeEmail(input.email) : null;
      const duplicate = await Customer.findOne({
        workspaceId: req.auth!.workspaceId,
        $or: [{ normalizedPhone }, ...(normalizedEmail ? [{ normalizedEmail }] : [])],
      }).lean();
      if (duplicate)
        throw new AppError(
          'DUPLICATE_CUSTOMER',
          'A possible duplicate exists. Review it before creating another customer.',
          409,
        );
      const customerId = newId();
      const consentId = newId();
      const commandId = newId();
      const session = await mongoose.startSession();
      let created: any;
      try {
        await session.withTransaction(async () => {
          const [customer] = await Customer.create(
            [
              {
                _id: customerId,
                workspaceId: req.auth!.workspaceId,
                firstName: input.firstName,
                lastName: input.lastName,
                phone: input.phone,
                normalizedPhone,
                email: input.email || null,
                normalizedEmail,
                source: input.source,
                service: input.service,
                quotedMinorUnits: input.quotedMinorUnits,
                lifecycle: 'enquiry',
                lastInteractionAt: new Date(),
              },
            ],
            { session },
          );
          await Consent.create(
            [
              {
                _id: consentId,
                workspaceId: req.auth!.workspaceId,
                customerId,
                channel: input.consentChannel,
                decision: input.consentDecision,
                capturedAt: new Date(),
              },
            ],
            { session },
          );
          await addEvent(
            {
              workspaceId: req.auth!.workspaceId,
              userId: req.auth!.userId,
              requestId: req.requestId,
              commandId,
              subjectKind: 'customer',
              subjectId: customerId,
              type: 'enquiry.created',
              payload: {
                customerId,
                source: input.source,
                quotedMinorUnits: input.quotedMinorUnits,
              },
            },
            session,
          );
          await addEvent(
            {
              workspaceId: req.auth!.workspaceId,
              userId: req.auth!.userId,
              requestId: req.requestId,
              commandId,
              subjectKind: 'customer',
              subjectId: customerId,
              type: 'consent.recorded',
              payload: {
                customerId,
                channel: input.consentChannel,
                decision: input.consentDecision,
                consentRecordId: consentId,
              },
            },
            session,
          );
          created = customer;
        });
      } finally {
        await session.endSession();
      }
      res
        .status(201)
        .json(
          customerView(created, { channel: input.consentChannel, decision: input.consentDecision }),
        );
    } catch (e) {
      next(e);
    }
  });

  api.get('/today', requireSession(config), async (req, res, next) => {
    try {
      const workspace = await Workspace.findById(req.auth!.workspaceId);
      if (!workspace) throw new AppError('RESOURCE_NOT_FOUND', 'Workspace not found.', 404);
      const customers = await Customer.find({
        workspaceId: req.auth!.workspaceId,
        lifecycle: { $in: ['enquiry', 'contacted', 'replied'] },
      })
        .sort({ lastInteractionAt: 1 })
        .limit(100)
        .lean();
      const consents = await latestConsents(
        req.auth!.workspaceId,
        customers.map((c) => String(c._id)),
      );
      const now = Date.now();
      const items = customers.map((c) => {
        const consent = consents.get(String(c._id));
        const overdue = now - new Date(c.lastInteractionAt).getTime() > 3 * 86400000;
        const reasons = [
          overdue ? 'Follow-up overdue' : 'New enquiry',
          consent?.decision === 'granted' ? 'Consent recorded' : 'Contact permission needs review',
        ];
        return {
          ...customerView(c, consent, workspace.currency),
          reasons,
          nextAction:
            consent?.decision === 'granted'
              ? 'Prepare a personal follow-up'
              : 'Review contact permission',
        };
      });
      res.json({ items, generatedAt: new Date().toISOString() });
    } catch (e) {
      next(e);
    }
  });

  api.get('/bookings', requireSession(config), async (req, res, next) => {
    try {
      const rows = await Booking.find({ workspaceId: req.auth!.workspaceId })
        .sort({ appointmentAt: -1 })
        .limit(100)
        .lean();
      res.json({
        items: rows.map((b) => ({
          id: String(b._id),
          customerId: b.customerId,
          service: b.service,
          appointmentAt: dateValue(b.appointmentAt),
          agreedMoney: { currency: b.currency, minorUnits: b.agreedMinorUnits },
          state: b.state,
        })),
      });
    } catch (e) {
      next(e);
    }
  });
  api.post('/bookings', requireSession(config), async (req, res, next) => {
    try {
      const input = CreateBookingRequestSchema.parse(req.body);
      const key = req.get('idempotency-key');
      if (!key || !/^[A-Za-z0-9._-]{8,120}$/.test(key))
        throw new AppError('VALIDATION_FAILED', 'Idempotency-Key is required.', 400);
      const keyHash = hashToken(`${req.auth!.workspaceId}:booking:${key}`);
      const requestFingerprint = fingerprint(input);
      const prior = await Booking.findOne({
        workspaceId: req.auth!.workspaceId,
        idempotencyKeyHash: keyHash,
      }).lean();
      if (prior) {
        if (prior.requestFingerprint !== requestFingerprint)
          throw new AppError(
            'IDEMPOTENCY_KEY_REUSED',
            'This idempotency key was used for different booking details.',
            409,
          );
        return res.status(201).json({
          id: String(prior._id),
          customerId: prior.customerId,
          service: prior.service,
          appointmentAt: dateValue(prior.appointmentAt),
          agreedMoney: { currency: prior.currency, minorUnits: prior.agreedMinorUnits },
          state: prior.state,
        });
      }
      const customer = await Customer.findOne({
        _id: input.customerId,
        workspaceId: req.auth!.workspaceId,
      });
      if (!customer) throw new AppError('RESOURCE_NOT_FOUND', 'Customer not found.', 404);
      const workspace = await Workspace.findById(req.auth!.workspaceId);
      if (!workspace || input.currency !== workspace.currency)
        throw new AppError(
          'VALIDATION_FAILED',
          'Booking currency must match the workspace currency.',
          400,
        );
      const bookingId = newId();
      const commandId = newId();
      const session = await mongoose.startSession();
      let created: any;
      try {
        await session.withTransaction(async () => {
          [created] = await Booking.create(
            [
              {
                _id: bookingId,
                workspaceId: req.auth!.workspaceId,
                customerId: input.customerId,
                service: input.service,
                appointmentAt: new Date(input.appointmentAt),
                agreedMinorUnits: input.agreedMinorUnits,
                currency: input.currency,
                notes: input.notes,
                state: 'confirmed',
                idempotencyKeyHash: keyHash,
                requestFingerprint,
              },
            ],
            { session },
          );
          await Customer.updateOne(
            { _id: input.customerId, workspaceId: req.auth!.workspaceId },
            { $set: { lifecycle: 'booked', lastInteractionAt: new Date() } },
            { session },
          );
          await addEvent(
            {
              workspaceId: req.auth!.workspaceId,
              userId: req.auth!.userId,
              requestId: req.requestId,
              commandId,
              subjectKind: 'booking',
              subjectId: bookingId,
              type: 'booking.recorded',
              payload: {
                bookingId,
                customerId: input.customerId,
                agreedMinorUnits: input.agreedMinorUnits,
                currency: input.currency,
              },
            },
            session,
          );
        });
      } catch (error: any) {
        if (error?.code === 11000) {
          const raced = await Booking.findOne({
            workspaceId: req.auth!.workspaceId,
            idempotencyKeyHash: keyHash,
          }).lean();
          if (raced && raced.requestFingerprint === requestFingerprint) created = raced;
          else
            throw new AppError(
              'IDEMPOTENCY_KEY_REUSED',
              'This idempotency key was used for different booking details.',
              409,
            );
        } else throw error;
      } finally {
        await session.endSession();
      }
      res.status(201).json({
        id: String(created._id),
        customerId: created.customerId,
        service: created.service,
        appointmentAt: dateValue(created.appointmentAt),
        agreedMoney: { currency: created.currency, minorUnits: created.agreedMinorUnits },
        state: created.state,
      });
    } catch (e) {
      next(e);
    }
  });

  api.get('/results', requireSession(config), async (req, res, next) => {
    try {
      const from = req.query.from
        ? new Date(String(req.query.from))
        : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
      const to = req.query.to ? new Date(String(req.query.to)) : new Date();
      const workspace = await Workspace.findById(req.auth!.workspaceId);
      if (!workspace) throw new AppError('RESOURCE_NOT_FOUND', 'Workspace not found.', 404);
      const eventFilter = {
        workspaceId: req.auth!.workspaceId,
        occurredAt: { $gte: from, $lte: to },
      };
      const [newEnquiries, bookings] = await Promise.all([
        OperationalEvent.countDocuments({ ...eventFilter, type: 'enquiry.created' }),
        Booking.find({
          workspaceId: req.auth!.workspaceId,
          appointmentAt: { $gte: from, $lte: to },
          state: { $ne: 'cancelled' },
        }).lean(),
      ]);
      res.json({
        range: { from: from.toISOString(), to: to.toISOString(), timezone: workspace.timezone },
        newEnquiries,
        bookingsRecorded: bookings.length,
        recordedBookingValue: {
          currency: workspace.currency,
          minorUnits: bookings.reduce((sum, item) => sum + item.agreedMinorUnits, 0),
        },
      });
    } catch (e) {
      next(e);
    }
  });

  api.get('/openapi.json', (_req, res) => res.json(buildOpenApi()));
  app.use('/api/v1', api);
  app.use((_req, res) =>
    res.status(404).json({
      error: {
        code: 'RESOURCE_NOT_FOUND',
        message: 'Not found.',
        requestId: String(res.getHeader('x-request-id')),
      },
    }),
  );
  return app;
}

export async function connectDatabase(config = readConfig()): Promise<void> {
  await mongoose.connect(config.MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
  await ensureIndexes();
}
export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
}
