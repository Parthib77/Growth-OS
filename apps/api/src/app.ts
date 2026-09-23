import express from 'express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import mongoose from 'mongoose';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { readConfig, type AppConfig } from './config.js';
import { errorHandler } from './errors.js';
import { normalizeEmail } from './ids.js';
import { ensureIndexes } from './models.js';
import { requireCsrf } from './auth.js';
import { registerRoutes } from './routes/index.js';

export type AppOptions = { config?: AppConfig; connect?: boolean };

export function createApp(options: AppOptions = {}) {
  const config = options.config ?? readConfig();
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet({ contentSecurityPolicy: false }));
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
  // CSRF, origin, and fetch-metadata checks must run before parsing attacker-controlled JSON.
  app.use(express.json({ limit: '1mb', strict: true }));
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    keyGenerator: (req) => {
      const identifier =
        typeof req.body?.email === 'string' ? normalizeEmail(req.body.email) : 'unknown';
      return `${identifier}:${ipKeyGenerator(req.ip ?? 'unknown')}`;
    },
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
  app.use('/api/v1/auth/password-reset-requests', authLimiter);
  app.use('/api/v1/auth/password-resets', authLimiter);

  const api = express.Router();
  registerRoutes(api, config);
  if (config.NODE_ENV === 'test') {
    api.get('/test/zod', (req, res, next) => {
      try {
        z.object({ value: z.string().min(1) }).parse(req.query);
        res.json({ ok: true });
      } catch (error: unknown) {
        next(error);
      }
    });
    api.get('/test/error', () => {
      throw new Error('test failure');
    });
  }

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
  app.use(errorHandler);
  return app;
}

export async function connectDatabase(config = readConfig()): Promise<void> {
  await mongoose.connect(config.MONGODB_URI, {
    serverSelectionTimeoutMS: 5000,
    autoIndex: false,
  });
  if (config.NODE_ENV !== 'production') await ensureIndexes();
}
export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
}
