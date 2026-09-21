import type { Request } from 'express';
import {
  commandId,
  requestId,
  utcInstant,
  userId,
  workspaceId,
  type CommandContext,
  type QueryContext,
} from '@growthos/contracts';
import { AppError } from './errors.js';
import { newId } from './ids.js';

function authenticated(req: Request) {
  if (!req.auth) throw new AppError('UNAUTHENTICATED', 'Sign in to continue.', 401);
  return req.auth;
}

export function commandContext(req: Request): CommandContext {
  const auth = authenticated(req);
  return {
    workspaceId: workspaceId(auth.workspaceId),
    actor: { kind: 'user', userId: userId(auth.userId) },
    commandId: commandId(newId()),
    requestId: requestId(req.requestId),
    now: utcInstant(new Date().toISOString()),
  };
}

export function commandActorUserId(context: CommandContext): string {
  if (context.actor.kind !== 'user') throw new AppError('FORBIDDEN', 'User action required.', 403);
  return String(context.actor.userId);
}

export function queryContext(req: Request): QueryContext {
  const auth = authenticated(req);
  return { workspaceId: workspaceId(auth.workspaceId), actorUserId: userId(auth.userId) };
}
