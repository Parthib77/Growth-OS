import mongoose from 'mongoose';
import { argon2id, hash as hashPassword } from 'argon2';
import type { Response } from 'express';
import type { AppConfig } from '../config.js';
import { AppError } from '../errors.js';
import { hashToken, newId, newToken, normalizeEmail } from '../ids.js';
import { PasswordReset, Session, User, Workspace } from '../models.js';
import { createSession, setSessionCookie } from '../auth.js';

const RESET_TTL_MS = 30 * 60 * 1000;
const GENERIC_MESSAGE =
  'If an account matches that email, password reset instructions are on the way.';

async function deliverReset(input: {
  config: AppConfig;
  email: string;
  token: string;
  expiresAt: Date;
}): Promise<void> {
  if (!input.config.PASSWORD_RESET_WEBHOOK_URL || !input.config.PASSWORD_RESET_WEBHOOK_SECRET)
    return;
  const resetUrl = `${input.config.WEB_ORIGIN}/?reset_token=${encodeURIComponent(input.token)}`;
  const response = await fetch(input.config.PASSWORD_RESET_WEBHOOK_URL, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${input.config.PASSWORD_RESET_WEBHOOK_SECRET}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      email: input.email,
      resetUrl,
      expiresAt: input.expiresAt.toISOString(),
    }),
    signal: AbortSignal.timeout(5_000),
  });
  if (!response.ok) throw new Error(`Password reset delivery returned HTTP ${response.status}.`);
}

export async function requestPasswordReset(input: {
  config: AppConfig;
  email: string;
  requestId: string;
}): Promise<{ message: string; developmentResetToken?: string }> {
  const user = await User.findOne({ normalizedEmail: normalizeEmail(input.email) });
  const canDeliver =
    Boolean(input.config.PASSWORD_RESET_WEBHOOK_URL) || input.config.PASSWORD_RESET_EXPOSE_TOKEN;
  if (!user || !canDeliver) return { message: GENERIC_MESSAGE };

  const token = newToken();
  const expiresAt = new Date(Date.now() + RESET_TTL_MS);
  const resetId = newId();
  await PasswordReset.updateMany(
    { userId: String(user._id), usedAt: null },
    { $set: { usedAt: new Date() } },
  );
  await PasswordReset.create({
    _id: resetId,
    userId: String(user._id),
    tokenHash: hashToken(token),
    expiresAt,
    usedAt: null,
    createdAt: new Date(),
  });
  try {
    await deliverReset({ config: input.config, email: user.email, token, expiresAt });
  } catch (error: unknown) {
    await PasswordReset.deleteOne({ _id: resetId });
    process.stderr.write(
      `${JSON.stringify({
        level: 'error',
        event: 'password_reset_delivery_failed',
        requestId: input.requestId,
        reason: error instanceof Error ? error.message : 'Unknown delivery failure',
      })}\n`,
    );
    return { message: GENERIC_MESSAGE };
  }
  return {
    message: GENERIC_MESSAGE,
    ...(input.config.PASSWORD_RESET_EXPOSE_TOKEN ? { developmentResetToken: token } : {}),
  };
}

export async function completePasswordReset(input: {
  config: AppConfig;
  token: string;
  password: string;
  previousSessionToken?: string;
  response: Response;
}): Promise<{ userId: string; workspaceId: string; csrfToken: string }> {
  const tokenHash = hashToken(input.token);
  const reset = await PasswordReset.findOne({
    tokenHash,
    usedAt: null,
    expiresAt: { $gt: new Date() },
  });
  if (!reset)
    throw new AppError('UNAUTHENTICATED', 'This password reset link is invalid or expired.', 401);
  const passwordHash = await hashPassword(input.password, { type: argon2id });
  const transaction = await mongoose.startSession();
  let createdSession: Awaited<ReturnType<typeof createSession>> | undefined;
  let workspaceId: string | undefined;
  try {
    await transaction.withTransaction(async () => {
      const currentReset = await PasswordReset.findOne({
        _id: reset._id,
        tokenHash,
        usedAt: null,
        expiresAt: { $gt: new Date() },
      }).session(transaction);
      if (!currentReset)
        throw new AppError(
          'UNAUTHENTICATED',
          'This password reset link is invalid or expired.',
          401,
        );
      const user = await User.findById(currentReset.userId).session(transaction);
      const workspace = user
        ? await Workspace.findOne({ ownerUserId: String(user._id) }).session(transaction)
        : null;
      if (!user || !workspace)
        throw new AppError(
          'UNAUTHENTICATED',
          'This password reset link is invalid or expired.',
          401,
        );
      const generation = user.sessionGeneration + 1;
      user.passwordHash = passwordHash;
      user.sessionGeneration = generation;
      await user.save({ session: transaction });
      await PasswordReset.updateMany(
        { userId: String(user._id), usedAt: null },
        { $set: { usedAt: new Date() } },
        { session: transaction },
      );
      await Session.updateMany(
        { userId: String(user._id), revokedAt: { $exists: false } },
        { $set: { revokedAt: new Date() } },
        { session: transaction },
      );
      if (input.previousSessionToken)
        await Session.updateOne(
          { tokenHash: hashToken(input.previousSessionToken) },
          { $set: { revokedAt: new Date() } },
          { session: transaction },
        );
      workspaceId = String(workspace._id);
      createdSession = await createSession({
        userId: String(user._id),
        workspaceId,
        generation,
        config: input.config,
        session: transaction,
      });
    });
  } finally {
    await transaction.endSession();
  }
  if (!createdSession || !workspaceId)
    throw new Error('Password reset transaction returned no session.');
  setSessionCookie(input.response, input.config, createdSession.token);
  return { userId: reset.userId, workspaceId, csrfToken: createdSession.csrfToken };
}
