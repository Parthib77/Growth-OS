import type { Router } from 'express';
import mongoose from 'mongoose';
import { OnboardingRequestSchema } from '@growthos/contracts';
import type { AppConfig } from '../config.js';
import { AppError } from '../errors.js';
import { requireSession } from '../auth.js';
import { commandActorUserId, commandContext, queryContext } from '../context.js';
import { Workspace } from '../models.js';
import { appendEvent } from './shared.js';

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

export function registerWorkspaceRoutes(router: Router, config: AppConfig): void {
  router.get('/workspace', requireSession(config), async (req, res, next) => {
    try {
      const query = queryContext(req);
      const workspace = await Workspace.findOne({
        _id: query.workspaceId,
        ownerUserId: query.actorUserId,
      });
      if (!workspace) throw new AppError('RESOURCE_NOT_FOUND', 'Workspace not found.', 404);
      res.json(workspaceView(workspace));
    } catch (error: unknown) {
      next(error);
    }
  });

  router.patch('/workspace', requireSession(config), async (req, res, next) => {
    try {
      const input = OnboardingRequestSchema.parse(req.body);
      const command = commandContext(req);
      const actorUserId = commandActorUserId(command);
      const transaction = await mongoose.startSession();
      let workspace;
      try {
        await transaction.withTransaction(async () => {
          workspace = await Workspace.findOneAndUpdate(
            { _id: command.workspaceId, ownerUserId: actorUserId },
            { $set: { ...input, bookingLink: input.bookingLink || '', onboardingComplete: true } },
            { returnDocument: 'after', session: transaction },
          );
          if (!workspace) throw new AppError('RESOURCE_NOT_FOUND', 'Workspace not found.', 404);
          await appendEvent(
            {
              workspaceId: command.workspaceId,
              userId: actorUserId,
              requestId: String(command.requestId),
              commandId: String(command.commandId),
              subjectKind: 'workspace',
              subjectId: command.workspaceId,
              ordinal: 0,
              payload: { type: 'workspace.settings_changed', changedFields: Object.keys(input) },
            },
            transaction,
          );
        });
      } finally {
        await transaction.endSession();
      }
      if (!workspace) throw new AppError('RESOURCE_NOT_FOUND', 'Workspace not found.', 404);
      res.json(workspaceView(workspace));
    } catch (error: unknown) {
      next(error);
    }
  });
}
