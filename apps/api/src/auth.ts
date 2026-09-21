import type { NextFunction, Request, Response } from 'express';
import { hash, verify } from 'argon2';
import { AppError } from './errors.js';
import { hashToken, newToken } from './ids.js';
import { Session, User } from './models.js';
import type { AppConfig } from './config.js';
import type { ClientSession } from 'mongoose';

declare global {
  namespace Express {
    interface Request {
      requestId: string;
      auth?: { userId: string; workspaceId: string; sessionId: string; sessionToken: string };
    }
  }
}

const SESSION_IDLE_DAYS = 2;
const SESSION_ABSOLUTE_DAYS = 30;
export function sessionCookieName(config: AppConfig): string {
  return config.COOKIE_SECURE ? '__Host-growthos.sid' : 'growthos.sid';
}

function cookieOptions(config: AppConfig) {
  return {
    httpOnly: true,
    secure: config.COOKIE_SECURE,
    sameSite: 'lax' as const,
    path: '/',
    maxAge: SESSION_ABSOLUTE_DAYS * 86400000,
  };
}

export async function createSession(input: {
  userId: string;
  workspaceId: string;
  generation: number;
  config: AppConfig;
  session?: ClientSession;
}): Promise<{ token: string; csrfToken: string; id: string }> {
  const token = newToken();
  const csrfToken = newToken(24);
  const [session] = await Session.create(
    [
      {
        tokenHash: hashToken(token),
        csrfHash: hashToken(csrfToken),
        userId: input.userId,
        workspaceId: input.workspaceId,
        generation: input.generation,
        issuedAt: new Date(),
        lastSeenAt: new Date(),
        idleExpiresAt: new Date(Date.now() + SESSION_IDLE_DAYS * 86400000),
        absoluteExpiresAt: new Date(Date.now() + SESSION_ABSOLUTE_DAYS * 86400000),
        expiresAt: new Date(Date.now() + SESSION_ABSOLUTE_DAYS * 86400000),
      },
    ],
    { session: input.session },
  );
  return { token, csrfToken, id: String(session._id) };
}

export function setSessionCookie(res: Response, config: AppConfig, token: string): void {
  res.cookie(sessionCookieName(config), token, cookieOptions(config));
}

export function clearSessionCookie(res: Response, config: AppConfig): void {
  res.clearCookie(sessionCookieName(config), {
    httpOnly: true,
    secure: config.COOKIE_SECURE,
    sameSite: 'lax',
    path: '/',
  });
}

async function loadSession(req: Request, config: AppConfig) {
  const raw = req.cookies?.[sessionCookieName(config)];
  if (!raw) throw new AppError('UNAUTHENTICATED', 'Sign in to continue.', 401);
  const session = await Session.findOne({
    tokenHash: hashToken(raw),
    revokedAt: { $exists: false },
    expiresAt: { $gt: new Date() },
    idleExpiresAt: { $gt: new Date() },
    absoluteExpiresAt: { $gt: new Date() },
  });
  if (!session || session.userId === 'anonymous')
    throw new AppError('UNAUTHENTICATED', 'Sign in to continue.', 401);
  const user = await User.findById(session.userId).select('sessionGeneration');
  if (!user || user.sessionGeneration !== session.generation)
    throw new AppError('UNAUTHENTICATED', 'Sign in to continue.', 401);
  await Session.updateOne(
    { _id: session._id },
    {
      $set: {
        lastSeenAt: new Date(),
        idleExpiresAt: new Date(Date.now() + SESSION_IDLE_DAYS * 86400000),
      },
    },
  );
  return { session, raw };
}

export function requireSession(config: AppConfig) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const { session, raw } = await loadSession(req, config);
      req.auth = {
        userId: session.userId,
        workspaceId: session.workspaceId,
        sessionId: String(session._id),
        sessionToken: raw,
      };
      next();
    } catch (error) {
      next(error);
    }
  };
}

export function requireCsrf(config: AppConfig) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const origin = req.get('origin');
      if (origin && origin !== config.WEB_ORIGIN)
        throw new AppError('CSRF_FAILED', 'Request origin is not allowed.', 403);
      if (config.NODE_ENV === 'production' && !origin)
        throw new AppError('CSRF_FAILED', 'Request origin is required.', 403);
      const fetchSite = req.get('sec-fetch-site');
      if (fetchSite && !['same-origin', 'same-site', 'none'].includes(fetchSite))
        throw new AppError('CSRF_FAILED', 'Cross-site request rejected.', 403);
      if (config.NODE_ENV === 'production' && !fetchSite)
        throw new AppError('CSRF_FAILED', 'Fetch metadata is required.', 403);
      const rawCookie = req.cookies?.[sessionCookieName(config)];
      const supplied = req.get('x-csrf-token');
      if (!rawCookie || !supplied)
        throw new AppError('CSRF_FAILED', 'A fresh security token is required.', 403);
      const session = await Session.findOne({
        tokenHash: hashToken(rawCookie),
        expiresAt: { $gt: new Date() },
        idleExpiresAt: { $gt: new Date() },
        absoluteExpiresAt: { $gt: new Date() },
        revokedAt: { $exists: false },
      });
      if (
        !session ||
        (!(await verify(session.csrfHash, supplied).catch(() => false)) &&
          session.csrfHash !== hashToken(supplied))
      )
        throw new AppError('CSRF_FAILED', 'A fresh security token is required.', 403);
      next();
    } catch (error) {
      next(error);
    }
  };
}

export async function issueAnonymousCsrf(res: Response, config: AppConfig): Promise<string> {
  const current = newToken();
  const csrfToken = newToken(24);
  await Session.create({
    tokenHash: hashToken(current),
    csrfHash: hashToken(csrfToken),
    userId: 'anonymous',
    workspaceId: 'anonymous',
    generation: 0,
    issuedAt: new Date(),
    lastSeenAt: new Date(),
    idleExpiresAt: new Date(Date.now() + 3600000),
    absoluteExpiresAt: new Date(Date.now() + 3600000),
    expiresAt: new Date(Date.now() + 3600000),
  });
  setSessionCookie(res, config, current);
  return csrfToken;
}

export async function rotateSession(
  res: Response,
  config: AppConfig,
  userId: string,
  workspaceId: string,
  generation: number,
  previousToken?: string,
): Promise<{ csrfToken: string; sessionId: string }> {
  if (previousToken)
    await Session.updateOne(
      { tokenHash: hashToken(previousToken) },
      { $set: { revokedAt: new Date() } },
    );
  const created = await createSession({ userId, workspaceId, generation, config });
  setSessionCookie(res, config, created.token);
  return { csrfToken: created.csrfToken, sessionId: created.id };
}

export { hash, verify };
