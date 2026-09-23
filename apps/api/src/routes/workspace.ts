import { createHmac } from 'node:crypto';
import type { Router } from 'express';
import mongoose, { type ClientSession } from 'mongoose';
import { DeleteAccountRequestSchema, WorkspaceSettingsPatchSchema } from '@growthos/contracts';
import type { AppConfig } from '../config.js';
import { AppError } from '../errors.js';
import { clearSessionCookie, requireSession, verify } from '../auth.js';
import { commandActorUserId, commandContext, queryContext } from '../context.js';
import { newId } from '../ids.js';
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
  PasswordReset,
  Review,
  ReviewImportBatch,
  Session,
  User,
  Workspace,
} from '../models.js';
import { projectWorkspaceExport, WORKSPACE_EXPORT_LIMITS } from '../workspace/export.js';
import { accountDeletionManifest, type AccountDeletionManifestStep } from '../workspace/domain.js';
import { workspaceView } from '../workspace/view.js';
import { appendEvent } from './shared.js';

async function deleteOwnedCollection(
  step: Exclude<AccountDeletionManifestStep, 'workspace' | 'user'>,
  userId: string,
  workspaceId: string,
  session: ClientSession,
): Promise<void> {
  switch (step) {
    case 'reviewImportBatches':
      await ReviewImportBatch.deleteMany({ workspaceId }).session(session);
      return;
    case 'customerImportBatches':
      await ImportBatch.deleteMany({ workspaceId }).session(session);
      return;
    case 'commandReceipts':
      await CommandReceipt.deleteMany({ workspaceId }).session(session);
      return;
    case 'campaignRecipients':
      await CampaignRecipient.deleteMany({ workspaceId }).session(session);
      return;
    case 'campaignRevisions':
      await CampaignRevision.deleteMany({ workspaceId }).session(session);
      return;
    case 'campaigns':
      await Campaign.deleteMany({ workspaceId }).session(session);
      return;
    case 'reviews':
      await Review.deleteMany({ workspaceId }).session(session);
      return;
    case 'bookings':
      await Booking.deleteMany({ workspaceId }).session(session);
      return;
    case 'consents':
      await Consent.deleteMany({ workspaceId }).session(session);
      return;
    case 'interactions':
      await Interaction.deleteMany({ workspaceId }).session(session);
      return;
    case 'customers':
      await Customer.deleteMany({ workspaceId }).session(session);
      return;
    case 'operationalEvents':
      await OperationalEvent.deleteMany({ workspaceId }).session(session);
      return;
    case 'passwordResets':
      await PasswordReset.deleteMany({ userId }).session(session);
      return;
    case 'sessions':
      await Session.deleteMany({ $or: [{ userId }, { workspaceId }] }).session(session);
      return;
    default: {
      const exhaustive: never = step;
      return exhaustive;
    }
  }
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
      const input = WorkspaceSettingsPatchSchema.parse(req.body);
      const command = commandContext(req);
      const actorUserId = commandActorUserId(command);
      const transaction = await mongoose.startSession();
      let workspace;
      try {
        await transaction.withTransaction(async () => {
          const existing = await Workspace.findOne({
            _id: command.workspaceId,
            ownerUserId: actorUserId,
          }).session(transaction);
          if (!existing) throw new AppError('RESOURCE_NOT_FOUND', 'Workspace not found.', 404);
          if (input.currency && input.currency !== existing.currency) {
            const [hasQuote, hasBooking] = await Promise.all([
              Customer.exists({
                workspaceId: command.workspaceId,
                quotedMinorUnits: { $exists: true, $ne: null },
              }).session(transaction),
              Booking.exists({ workspaceId: command.workspaceId }).session(transaction),
            ]);
            if (hasQuote || hasBooking)
              throw new AppError(
                'CURRENCY_LOCKED',
                'Currency cannot change after a quote or booking exists.',
                409,
              );
          }
          const onboardingFields = [
            'businessName',
            'category',
            'timezone',
            'currency',
            'defaultCountryCode',
            'bookingLink',
            'followUpDays',
          ] as const;
          const completesOnboarding = onboardingFields.every((field) => input[field] !== undefined);
          const update = {
            ...input,
            ...(input.bookingLink !== undefined ? { bookingLink: input.bookingLink ?? '' } : {}),
            ...(completesOnboarding ? { onboardingComplete: true } : {}),
          };
          workspace = await Workspace.findOneAndUpdate(
            { _id: command.workspaceId, ownerUserId: actorUserId },
            { $set: update },
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

  router.get('/workspace/export', requireSession(config), async (req, res, next) => {
    try {
      const query = queryContext(req);
      const session = await mongoose.startSession();
      let document;
      try {
        await session.withTransaction(
          async () => {
            const user = await User.findById(query.actorUserId).session(session);
            const workspace = await Workspace.findOne({
              _id: query.workspaceId,
              ownerUserId: query.actorUserId,
            })
              .session(session)
              .lean();
            const customers = await Customer.find({ workspaceId: query.workspaceId })
              .limit(WORKSPACE_EXPORT_LIMITS.maxRecordsPerCollection + 1)
              .session(session)
              .lean();
            const consents = await Consent.find({ workspaceId: query.workspaceId })
              .limit(WORKSPACE_EXPORT_LIMITS.maxRecordsPerCollection + 1)
              .session(session)
              .lean();
            const interactions = await Interaction.find({ workspaceId: query.workspaceId })
              .limit(WORKSPACE_EXPORT_LIMITS.maxRecordsPerCollection + 1)
              .session(session)
              .lean();
            const campaigns = await Campaign.find({ workspaceId: query.workspaceId })
              .limit(WORKSPACE_EXPORT_LIMITS.maxRecordsPerCollection + 1)
              .session(session)
              .lean();
            const campaignRevisions = await CampaignRevision.find({
              workspaceId: query.workspaceId,
            })
              .limit(WORKSPACE_EXPORT_LIMITS.maxRecordsPerCollection + 1)
              .session(session)
              .lean();
            const campaignRecipients = await CampaignRecipient.find({
              workspaceId: query.workspaceId,
            })
              .limit(WORKSPACE_EXPORT_LIMITS.maxRecordsPerCollection + 1)
              .session(session)
              .lean();
            const bookings = await Booking.find({ workspaceId: query.workspaceId })
              .limit(WORKSPACE_EXPORT_LIMITS.maxRecordsPerCollection + 1)
              .session(session)
              .lean();
            const reviews = await Review.find({ workspaceId: query.workspaceId })
              .limit(WORKSPACE_EXPORT_LIMITS.maxRecordsPerCollection + 1)
              .session(session)
              .lean();
            const operationalEvents = await OperationalEvent.find({
              workspaceId: query.workspaceId,
            })
              .limit(WORKSPACE_EXPORT_LIMITS.maxRecordsPerCollection + 1)
              .session(session)
              .lean();
            if (!user || !workspace)
              throw new AppError('RESOURCE_NOT_FOUND', 'Workspace not found.', 404);
            document = projectWorkspaceExport({
              user,
              workspace,
              customers,
              consents,
              interactions,
              campaigns,
              campaignRevisions,
              campaignRecipients,
              bookings,
              reviews,
              operationalEvents,
            });
          },
          { readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' } },
        );
      } finally {
        await session.endSession();
      }
      if (!document)
        throw new AppError('INTERNAL_ERROR', 'Export transaction returned no document.', 500);
      res
        .type('application/json')
        .setHeader('content-disposition', 'attachment; filename="growthos-export.json"')
        .setHeader('cache-control', 'no-store')
        .json(document);
    } catch (error: unknown) {
      next(error);
    }
  });

  router.delete('/workspace/account', requireSession(config), async (req, res, next) => {
    try {
      const input = DeleteAccountRequestSchema.parse(req.body);
      const auth = req.auth!;
      const user = await User.findById(auth.userId);
      const workspace = await Workspace.findOne({
        _id: auth.workspaceId,
        ownerUserId: auth.userId,
      });
      if (
        !user ||
        !workspace ||
        !(await verify(user.passwordHash, input.password).catch(() => false))
      )
        throw new AppError('UNAUTHENTICATED', 'Current password is incorrect.', 401);
      if (input.businessNameConfirmation !== workspace.businessName)
        throw new AppError(
          'ACCOUNT_DELETION_REQUIRES_CONFIRMATION',
          'Type the business name exactly to confirm deletion.',
          400,
        );
      const session = await mongoose.startSession();
      try {
        await session.withTransaction(async () => {
          const currentUser = await User.findById(auth.userId).session(session);
          const currentWorkspace = await Workspace.findOne({
            _id: auth.workspaceId,
            ownerUserId: auth.userId,
          }).session(session);
          if (!currentUser || !currentWorkspace)
            throw new AppError('RESOURCE_NOT_FOUND', 'Account not found.', 404);
          if (
            currentUser.passwordHash !== user.passwordHash ||
            currentWorkspace.businessName !== workspace.businessName ||
            !(await verify(currentUser.passwordHash, input.password).catch(() => false))
          )
            throw new AppError('CONFLICT', 'Account details changed; retry the deletion.', 409);

          for (const step of accountDeletionManifest) {
            if (step === 'workspace') {
              await AccountDeletionReceipt.create(
                [
                  {
                    _id: newId(),
                    requestId: req.requestId,
                    occurredAt: new Date(),
                    schemaVersion: 1,
                    subjectHmac: createHmac('sha256', config.SESSION_SECRET)
                      .update(`${auth.userId}:${auth.workspaceId}`)
                      .digest('hex'),
                  },
                ],
                { session },
              );
              await Workspace.deleteOne({ _id: auth.workspaceId }).session(session);
            } else if (step === 'user') {
              await User.deleteOne({ _id: auth.userId }).session(session);
            } else if (step === 'sessions') {
              await Session.deleteMany({
                $or: [{ userId: auth.userId }, { workspaceId: auth.workspaceId }],
              }).session(session);
            } else {
              await deleteOwnedCollection(step, auth.userId, auth.workspaceId, session);
            }
          }
        });
      } finally {
        await session.endSession();
      }
      clearSessionCookie(res, config);
      console.info(
        JSON.stringify({ level: 'info', event: 'account_deleted', requestId: req.requestId }),
      );
      res.status(204).send();
    } catch (error: unknown) {
      next(error);
    }
  });
}
