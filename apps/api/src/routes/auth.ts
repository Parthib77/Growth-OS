import type { Router } from 'express';
import mongoose from 'mongoose';
import { argon2id, hash as hashPassword } from 'argon2';
import {
  RegisterRequestSchema,
  SignInRequestSchema,
  userId as userIdValue,
  workspaceId as workspaceIdValue,
} from '@growthos/contracts';
import type { AppConfig } from '../config.js';
import { AppError } from '../errors.js';
import { hashToken, newId, normalizeEmail } from '../ids.js';
import { Session, User, Workspace } from '../models.js';
import {
  clearSessionCookie,
  createSession,
  issueAnonymousCsrf,
  requireSession,
  rotateSession,
  sessionCookieName,
  setSessionCookie,
  verify,
} from '../auth.js';
import { appendEvent } from './shared.js';

export function registerAuthRoutes(router: Router, config: AppConfig): void {
  router.get('/auth/csrf', async (_req, res, next) => {
    try {
      res.json({ csrfToken: await issueAnonymousCsrf(res, config) });
    } catch (error: unknown) {
      next(error);
    }
  });

  router.post('/auth/register', async (req, res, next) => {
    try {
      const input = RegisterRequestSchema.parse(req.body);
      const email = normalizeEmail(input.email);
      const existing = await User.findOne({ normalizedEmail: email });
      if (existing) {
        const samePassword = await verify(existing.passwordHash, input.password).catch(() => false);
        const existingWorkspace = await Workspace.findOne({ ownerUserId: String(existing._id) });
        if (!samePassword || !existingWorkspace)
          throw new AppError('CONFLICT', 'An account with this email already exists.', 409);
        const csrf = await rotateSession(
          res,
          config,
          String(existing._id),
          String(existingWorkspace._id),
          existing.sessionGeneration,
          req.cookies?.[sessionCookieName(config)],
        );
        return res.status(201).json({
          userId: String(existing._id),
          workspaceId: String(existingWorkspace._id),
          csrfToken: csrf.csrfToken,
        });
      }

      const userId = newId();
      const workspaceId = newId();
      const passwordHash = await hashPassword(input.password, { type: argon2id });
      const transaction = await mongoose.startSession();
      let response: { userId: string; workspaceId: string; csrfToken: string } | undefined;
      try {
        await transaction.withTransaction(async () => {
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
            { session: transaction },
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
            { session: transaction },
          );
          await appendEvent(
            {
              workspaceId,
              userId,
              requestId: req.requestId,
              commandId: newId(),
              subjectKind: 'workspace',
              subjectId: workspaceId,
              ordinal: 0,
              payload: {
                type: 'account.registered',
                userId: userIdValue(userId),
                workspaceId: workspaceIdValue(workspaceId),
              },
            },
            transaction,
          );
          const priorToken = req.cookies?.[sessionCookieName(config)];
          if (priorToken)
            await Session.updateOne(
              { tokenHash: hashToken(priorToken) },
              { $set: { revokedAt: new Date() } },
              { session: transaction },
            );
          const session = await createSession({
            userId,
            workspaceId,
            generation: 0,
            config,
            session: transaction,
          });
          setSessionCookie(res, config, session.token);
          response = { userId, workspaceId, csrfToken: session.csrfToken };
        });
      } finally {
        await transaction.endSession();
      }
      if (!response) throw new Error('Registration transaction returned no response');
      res.status(201).json(response);
    } catch (error: unknown) {
      next(error);
    }
  });

  router.post('/auth/sign-in', async (req, res, next) => {
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
    } catch (error: unknown) {
      next(error);
    }
  });

  router.post('/auth/sign-out', requireSession(config), async (req, res, next) => {
    try {
      await Session.updateOne({ _id: req.auth!.sessionId }, { $set: { revokedAt: new Date() } });
      clearSessionCookie(res, config);
      res.status(204).send();
    } catch (error: unknown) {
      next(error);
    }
  });

  router.get('/session', requireSession(config), (req, res) =>
    res.json({ userId: req.auth!.userId, workspaceId: req.auth!.workspaceId }),
  );
}
