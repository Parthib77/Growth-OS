import type { Router } from 'express';
import {
  CampaignAuditResponseSchema,
  CampaignListQuerySchema,
  CampaignOutcomeRequestSchema,
  CampaignRecipientListQuerySchema,
  CampaignRecipientRemoveRequestSchema,
  CampaignTransitionRequestSchema,
  CreateCampaignRequestSchema,
  UpdateCampaignRequestSchema,
} from '@growthos/contracts';
import type { AppConfig } from '../config.js';
import { AppError } from '../errors.js';
import { requireSession } from '../auth.js';
import { commandContext, queryContext } from '../context.js';
import { Campaign, CampaignRecipient, OperationalEvent } from '../models.js';
import {
  campaignRecipientVersion,
  campaignView,
  campaignCsv,
  createCampaign,
  listRecipients,
  recipientWhatsAppLink,
  recordOutcome,
  refreshRecipients,
  removeRecipient,
  transitionCampaign,
  updateCampaign,
} from '../campaigns/service.js';

function param(value: string | string[], label: string): string {
  if (typeof value === 'string' && value.length > 0) return value;
  throw new AppError('RESOURCE_NOT_FOUND', `${label} not found.`, 404);
}

function etag(campaignId: string, version: number): string {
  return `"${campaignId}:${version}"`;
}

function expectedVersion(req: { get(name: string): string | undefined }): {
  campaignId: string;
  version: number;
} {
  const value = req.get('if-match') ?? '';
  const match = /^"([a-f0-9-]{8,64}):([1-9][0-9]*)"$/.exec(value);
  if (!match)
    throw new AppError(
      'CAMPAIGN_VERSION_CONFLICT',
      'A strong If-Match campaign ETag is required.',
      412,
    );
  return { campaignId: match[1], version: Number(match[2]) };
}

export function registerCampaignRoutes(router: Router, config: AppConfig): void {
  router.get('/campaigns', requireSession(config), async (req, res, next) => {
    try {
      const query = queryContext(req);
      const options = CampaignListQuerySchema.parse(req.query);
      const filter: Record<string, unknown> = { workspaceId: query.workspaceId };
      if (options.status) filter.status = options.status;
      const rows = await Campaign.find(filter)
        .sort({ updatedAt: -1, _id: -1 })
        .skip(options.cursor)
        .limit(options.limit + 1)
        .lean();
      const hasMore = rows.length > options.limit;
      if (hasMore) rows.pop();
      const items = await Promise.all(
        rows.map(async (campaign) =>
          campaignView(
            campaign,
            await CampaignRecipient.countDocuments({
              workspaceId: query.workspaceId,
              campaignId: campaign._id,
              campaignVersion: campaignRecipientVersion(campaign),
              eligibility: 'eligible',
              removed: false,
            }),
          ),
        ),
      );
      res.json({ items, nextCursor: hasMore ? String(options.cursor + options.limit) : null });
    } catch (error: unknown) {
      next(error);
    }
  });

  router.post('/campaigns', requireSession(config), async (req, res, next) => {
    try {
      const result = await createCampaign(
        commandContext(req),
        CreateCampaignRequestSchema.parse(req.body),
      );
      res.setHeader('ETag', etag(result.id, result.version));
      res.status(201).json(result);
    } catch (error: unknown) {
      next(error);
    }
  });

  router.get('/campaigns/:campaignId', requireSession(config), async (req, res, next) => {
    try {
      const query = queryContext(req);
      const campaignId = param(req.params.campaignId, 'Campaign');
      const campaign = await Campaign.findOne({
        _id: campaignId,
        workspaceId: query.workspaceId,
      }).lean();
      if (!campaign) throw new AppError('RESOURCE_NOT_FOUND', 'Campaign not found.', 404);
      const count = await CampaignRecipient.countDocuments({
        workspaceId: query.workspaceId,
        campaignId,
        campaignVersion: campaignRecipientVersion(campaign),
        eligibility: 'eligible',
        removed: false,
      });
      res.setHeader('ETag', etag(campaignId, campaign.version));
      res.json(campaignView(campaign, count));
    } catch (error: unknown) {
      next(error);
    }
  });

  router.get('/campaigns/:campaignId/audit', requireSession(config), async (req, res, next) => {
    try {
      const query = queryContext(req);
      const campaignId = param(req.params.campaignId, 'Campaign');
      const campaign = await Campaign.exists({ _id: campaignId, workspaceId: query.workspaceId });
      if (!campaign) throw new AppError('RESOURCE_NOT_FOUND', 'Campaign not found.', 404);
      const events = await OperationalEvent.find({
        workspaceId: query.workspaceId,
        subjectKind: 'campaign',
        subjectId: campaignId,
      })
        .sort({ occurredAt: -1, _id: -1 })
        .limit(100)
        .lean();
      res.json(
        CampaignAuditResponseSchema.parse({
          items: events.map((event) => ({
            id: event.eventId,
            type: event.type,
            occurredAt: event.occurredAt.toISOString(),
            payload: event.payload,
          })),
        }),
      );
    } catch (error: unknown) {
      next(error);
    }
  });

  router.patch('/campaigns/:campaignId', requireSession(config), async (req, res, next) => {
    try {
      const campaignId = param(req.params.campaignId, 'Campaign');
      const header = expectedVersion(req);
      if (header.campaignId !== campaignId)
        throw new AppError(
          'CAMPAIGN_VERSION_CONFLICT',
          'If-Match does not identify this campaign.',
          412,
        );
      const input = UpdateCampaignRequestSchema.parse(req.body);
      const result = await updateCampaign(commandContext(req), campaignId, input, header.version);
      res.setHeader('ETag', etag(campaignId, result.version));
      res.json(result);
    } catch (error: unknown) {
      next(error);
    }
  });

  router.post(
    '/campaigns/:campaignId/transition',
    requireSession(config),
    async (req, res, next) => {
      try {
        const campaignId = param(req.params.campaignId, 'Campaign');
        const header = expectedVersion(req);
        if (header.campaignId !== campaignId)
          throw new AppError(
            'CAMPAIGN_VERSION_CONFLICT',
            'If-Match does not identify this campaign.',
            412,
          );
        const input = CampaignTransitionRequestSchema.parse(req.body);
        if (input.version !== header.version)
          throw new AppError(
            'CAMPAIGN_VERSION_CONFLICT',
            'Body version and If-Match disagree.',
            412,
          );
        const result = await transitionCampaign(
          commandContext(req),
          campaignId,
          input.to,
          header.version,
        );
        res.setHeader('ETag', etag(campaignId, result.version));
        res.json(result);
      } catch (error: unknown) {
        next(error);
      }
    },
  );

  router.post(
    '/campaigns/:campaignId/recipients/refresh',
    requireSession(config),
    async (req, res, next) => {
      try {
        const campaignId = param(req.params.campaignId, 'Campaign');
        const header = expectedVersion(req);
        if (header.campaignId !== campaignId)
          throw new AppError(
            'CAMPAIGN_VERSION_CONFLICT',
            'If-Match does not identify this campaign.',
            412,
          );
        const input = CampaignTransitionRequestSchema.shape.version.parse(req.body.version);
        if (input !== header.version)
          throw new AppError(
            'CAMPAIGN_VERSION_CONFLICT',
            'Body version and If-Match disagree.',
            412,
          );
        const result = await refreshRecipients(commandContext(req), campaignId, header.version);
        const current = await Campaign.findOne({
          _id: campaignId,
          workspaceId: commandContext(req).workspaceId,
        })
          .select('version')
          .lean();
        if (!current) throw new AppError('RESOURCE_NOT_FOUND', 'Campaign not found.', 404);
        res.setHeader('ETag', etag(campaignId, current.version));
        res.json({ ...result, nextCursor: null });
      } catch (error: unknown) {
        next(error);
      }
    },
  );

  router.get(
    '/campaigns/:campaignId/recipients',
    requireSession(config),
    async (req, res, next) => {
      try {
        const options = CampaignRecipientListQuerySchema.parse(req.query);
        res.json(
          await listRecipients(
            commandContext(req),
            param(req.params.campaignId, 'Campaign'),
            options,
          ),
        );
      } catch (error: unknown) {
        next(error);
      }
    },
  );

  router.post(
    '/campaigns/:campaignId/recipients/:recipientId/remove',
    requireSession(config),
    async (req, res, next) => {
      try {
        const campaignId = param(req.params.campaignId, 'Campaign');
        const header = expectedVersion(req);
        if (header.campaignId !== campaignId)
          throw new AppError(
            'CAMPAIGN_VERSION_CONFLICT',
            'If-Match does not identify this campaign.',
            412,
          );
        const input = CampaignRecipientRemoveRequestSchema.parse(req.body);
        if (input.campaignVersion !== header.version)
          throw new AppError(
            'CAMPAIGN_VERSION_CONFLICT',
            'Body version and If-Match disagree.',
            412,
          );
        const result = await removeRecipient(
          commandContext(req),
          campaignId,
          param(req.params.recipientId, 'Recipient'),
          header.version,
        );
        res.setHeader('ETag', etag(campaignId, header.version + 1));
        res.json(result);
      } catch (error: unknown) {
        next(error);
      }
    },
  );

  router.post(
    '/campaigns/:campaignId/recipients/:recipientId/outcome',
    requireSession(config),
    async (req, res, next) => {
      try {
        const key = req.get('idempotency-key');
        if (!key || !/^[A-Za-z0-9._-]{8,120}$/.test(key))
          throw new AppError('VALIDATION_FAILED', 'Idempotency-Key is required.', 400);
        const result = await recordOutcome(
          commandContext(req),
          param(req.params.campaignId, 'Campaign'),
          param(req.params.recipientId, 'Recipient'),
          CampaignOutcomeRequestSchema.parse(req.body),
          key,
        );
        res.json(result);
      } catch (error: unknown) {
        next(error);
      }
    },
  );

  router.get(
    '/campaigns/:campaignId/recipients/:recipientId/whatsapp-link',
    requireSession(config),
    async (req, res, next) => {
      try {
        res.json(
          await recipientWhatsAppLink(
            commandContext(req),
            param(req.params.campaignId, 'Campaign'),
            param(req.params.recipientId, 'Recipient'),
          ),
        );
      } catch (error: unknown) {
        next(error);
      }
    },
  );

  router.get(
    '/campaigns/:campaignId/recipients.csv',
    requireSession(config),
    async (req, res, next) => {
      try {
        const csv = await campaignCsv(
          commandContext(req),
          param(req.params.campaignId, 'Campaign'),
        );
        res
          .type('text/csv')
          .setHeader('Content-Disposition', 'attachment; filename="campaign-recipients.csv"')
          .send(csv);
      } catch (error: unknown) {
        next(error);
      }
    },
  );
}
