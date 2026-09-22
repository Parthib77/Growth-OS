import mongoose from 'mongoose';
import {
  CampaignAudienceSchema,
  CampaignOutcomeResponseSchema,
  bookingId as bookingIdValue,
  CampaignOutcomeRequestSchema,
  CampaignResponseSchema,
  CampaignRecipientResponseSchema,
  campaignId as campaignIdValue,
  campaignRecipientId as campaignRecipientIdValue,
  type CommandContext,
  type CreateCampaignRequest,
  type UpdateCampaignRequest,
} from '@growthos/contracts';
import type { z } from 'zod';
import { AppError } from '../errors.js';
import { commandActorUserId } from '../context.js';
import { hashToken, newId, normalizePhone } from '../ids.js';
import {
  Booking,
  Campaign,
  CampaignRevision,
  CampaignRecipient,
  CommandReceipt,
  Consent,
  Customer,
  Workspace,
  type CampaignDoc,
  type CampaignRecipientDoc,
} from '../models.js';
import { appendEvent, fingerprint } from '../routes/shared.js';
import {
  assertCampaignStatusTransition,
  campaignOutcome,
  campaignStatus,
  personalizeCampaignTemplate,
  preparedWhatsAppLink,
  validWhatsAppPhone,
  type Eligibility,
  safeCampaignCsvCell,
  validateCampaignTemplate,
} from './domain.js';

type Audience = z.infer<typeof CampaignAudienceSchema>;
type OutcomeInput = z.infer<typeof CampaignOutcomeRequestSchema>;

function audienceValue(value: unknown): Audience {
  return CampaignAudienceSchema.parse(value);
}

export function campaignView(
  campaign: {
    _id: string;
    name: string;
    status: string;
    version: number;
    channel: 'whatsapp';
    template: string;
    audience: unknown;
    createdAt: Date;
    updatedAt: Date;
  },
  recipientCount: number,
) {
  return CampaignResponseSchema.parse({
    id: String(campaign._id),
    name: campaign.name,
    status: campaign.status,
    version: campaign.version,
    channel: campaign.channel,
    template: campaign.template,
    audience: audienceValue(campaign.audience),
    recipientCount,
    createdAt: campaign.createdAt.toISOString(),
    updatedAt: campaign.updatedAt.toISOString(),
  });
}

async function findCampaign(workspaceId: string, campaignId: string) {
  const campaign = await Campaign.findOne({ _id: campaignId, workspaceId });
  if (!campaign) throw new AppError('RESOURCE_NOT_FOUND', 'Campaign not found.', 404);
  return campaign;
}

async function appendCampaignRevision(
  campaign: CampaignDoc,
  session: mongoose.ClientSession,
): Promise<void> {
  await CampaignRevision.create(
    [
      {
        _id: newId(),
        workspaceId: campaign.workspaceId,
        campaignId: String(campaign._id),
        version: campaign.version,
        name: campaign.name,
        channel: campaign.channel,
        template: campaign.template,
        audience: campaign.audience,
        status: campaign.status,
        reviewedVersion: campaign.reviewedVersion ?? 0,
        recordedAt: new Date(),
      },
    ],
    { session },
  );
}

export function campaignRecipientVersion(campaign: {
  version: number;
  reviewedVersion?: number;
}): number {
  return campaign.reviewedVersion && campaign.reviewedVersion > 0
    ? campaign.reviewedVersion
    : campaign.version;
}

export async function createCampaign(context: CommandContext, input: CreateCampaignRequest) {
  try {
    validateCampaignTemplate(input.template);
  } catch (error: unknown) {
    throw new AppError(
      'VALIDATION_FAILED',
      error instanceof Error ? error.message : 'Invalid template.',
      400,
    );
  }
  const campaignId = newId();
  const session = await mongoose.startSession();
  let created;
  try {
    await session.withTransaction(async () => {
      [created] = await Campaign.create(
        [
          {
            _id: campaignId,
            workspaceId: context.workspaceId,
            name: input.name,
            channel: input.channel,
            template: input.template,
            audience: input.audience,
            status: 'draft',
            version: 1,
            reviewedVersion: 0,
            removedCustomerIds: [],
          },
        ],
        { session },
      );
      if (!created) throw new Error('Campaign was not created');
      await appendCampaignRevision(created, session);
      await appendEvent(
        {
          workspaceId: context.workspaceId,
          userId: commandActorUserId(context),
          requestId: String(context.requestId),
          commandId: String(context.commandId),
          subjectKind: 'campaign',
          subjectId: campaignId,
          ordinal: 0,
          payload: {
            type: 'campaign.created',
            campaignId: campaignIdValue(campaignId),
            version: 1,
          },
        },
        session,
      );
    });
  } finally {
    await session.endSession();
  }
  if (!created) throw new Error('Campaign was not created');
  return campaignView(created, 0);
}

export async function updateCampaign(
  context: CommandContext,
  campaignId: string,
  input: UpdateCampaignRequest,
  expectedVersion: number,
) {
  const campaign = await findCampaign(context.workspaceId, campaignId);
  if (campaign.version !== expectedVersion || input.version !== expectedVersion)
    throw new AppError(
      'CAMPAIGN_VERSION_CONFLICT',
      'Campaign changed. Reload before editing.',
      412,
    );
  if (campaign.status !== 'draft' && campaign.status !== 'ready')
    throw new AppError('CONFLICT', 'Only draft campaigns can be edited.', 409);
  if (input.template)
    try {
      validateCampaignTemplate(input.template);
    } catch (error: unknown) {
      throw new AppError(
        'VALIDATION_FAILED',
        error instanceof Error ? error.message : 'Invalid template.',
        400,
      );
    }
  const nextVersion = expectedVersion + 1;
  const updates = {
    ...(input.name ? { name: input.name } : {}),
    ...(input.template ? { template: input.template } : {}),
    ...(input.audience ? { audience: input.audience } : {}),
  };
  const changedFields = Object.keys(updates);
  if (changedFields.length === 0)
    return campaignView(
      campaign,
      await CampaignRecipient.countDocuments({
        workspaceId: context.workspaceId,
        campaignId,
        campaignVersion: campaignRecipientVersion(campaign),
        eligibility: 'eligible',
        removed: false,
      }),
    );
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const updated = await Campaign.findOneAndUpdate(
        {
          _id: campaignId,
          workspaceId: context.workspaceId,
          version: expectedVersion,
          status: { $in: ['draft', 'ready'] },
        },
        { $set: { ...updates, status: 'draft', reviewedVersion: 0 }, $inc: { version: 1 } },
        { returnDocument: 'after', session },
      );
      if (!updated)
        throw new AppError(
          'CAMPAIGN_VERSION_CONFLICT',
          'Campaign changed. Reload before editing.',
          412,
        );
      await appendCampaignRevision(updated, session);
      await appendEvent(
        {
          workspaceId: context.workspaceId,
          userId: commandActorUserId(context),
          requestId: String(context.requestId),
          commandId: String(context.commandId),
          subjectKind: 'campaign',
          subjectId: campaignId,
          ordinal: 0,
          payload: {
            type: 'campaign.updated',
            campaignId: campaignIdValue(campaignId),
            version: nextVersion,
            changedFields,
          },
        },
        session,
      );
    });
  } finally {
    await session.endSession();
  }
  const fresh = await findCampaign(context.workspaceId, campaignId);
  return campaignView(fresh, 0);
}

export async function transitionCampaign(
  context: CommandContext,
  campaignId: string,
  to: string,
  expectedVersion: number,
) {
  const target = campaignStatus(to);
  const campaign = await findCampaign(context.workspaceId, campaignId);
  if (campaign.version !== expectedVersion)
    throw new AppError(
      'CAMPAIGN_VERSION_CONFLICT',
      'Campaign changed. Reload before changing status.',
      412,
    );
  try {
    assertCampaignStatusTransition(campaign.status, target);
  } catch (error: unknown) {
    throw new AppError(
      'INVALID_TRANSITION',
      error instanceof Error ? error.message : 'Invalid campaign transition.',
      409,
    );
  }
  if (target === 'active' && campaign.reviewedVersion === 0)
    throw new AppError('CONFLICT', 'Review recipients before activating this campaign.', 409);
  const nextVersion = expectedVersion + 1;
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      if (target === 'ready') {
        const eligible = await CampaignRecipient.countDocuments({
          workspaceId: context.workspaceId,
          campaignId,
          campaignVersion: campaignRecipientVersion(campaign),
          eligibility: 'eligible',
          removed: false,
        }).session(session);
        if (campaign.reviewedVersion === 0 || eligible === 0)
          throw new AppError(
            'CONFLICT',
            'Review must contain at least one eligible recipient.',
            409,
          );
      }
      if (target === 'active') {
        const eligible = await recheckActivationEligibility(context.workspaceId, campaign, session);
        if (eligible === 0)
          throw new AppError('CONFLICT', 'At least one eligible recipient is required.', 409);
      }
      if (target === 'cancelled')
        await CampaignRecipient.updateMany(
          {
            workspaceId: context.workspaceId,
            campaignId,
            campaignVersion: campaignRecipientVersion(campaign),
            outcome: null,
            removed: false,
          },
          { $set: { eligibility: 'cancelled', reason: 'Campaign cancelled.' } },
          { session },
        );
      const updated = await Campaign.findOneAndUpdate(
        { _id: campaignId, workspaceId: context.workspaceId, version: expectedVersion },
        {
          $set: {
            status: target,
          },
          $inc: { version: 1 },
        },
        { returnDocument: 'after', session },
      );
      if (!updated)
        throw new AppError(
          'CAMPAIGN_VERSION_CONFLICT',
          'Campaign changed. Reload before changing status.',
          412,
        );
      await appendCampaignRevision(updated, session);
      await appendEvent(
        {
          workspaceId: context.workspaceId,
          userId: commandActorUserId(context),
          requestId: String(context.requestId),
          commandId: String(context.commandId),
          subjectKind: 'campaign',
          subjectId: campaignId,
          ordinal: 0,
          payload: {
            type: 'campaign.status_changed',
            campaignId: campaignIdValue(campaignId),
            from: campaignStatus(campaign.status),
            to: target,
            version: nextVersion,
          },
        },
        session,
      );
    });
  } finally {
    await session.endSession();
  }
  const fresh = await findCampaign(context.workspaceId, campaignId);
  const count = await CampaignRecipient.countDocuments({
    workspaceId: context.workspaceId,
    campaignId,
    campaignVersion: campaignRecipientVersion(fresh),
    eligibility: 'eligible',
    removed: false,
  });
  return campaignView(fresh, count);
}

export async function refreshRecipients(
  context: CommandContext,
  campaignId: string,
  expectedVersion: number,
) {
  const campaign = await findCampaign(context.workspaceId, campaignId);
  if (campaign.version !== expectedVersion)
    throw new AppError(
      'CAMPAIGN_VERSION_CONFLICT',
      'Campaign changed. Reload before reviewing recipients.',
      412,
    );
  if (campaign.status !== 'draft')
    throw new AppError('CONFLICT', 'Only draft campaigns can review recipients.', 409);
  const audience = audienceValue(campaign.audience);
  const existing = await CampaignRecipient.find({
    workspaceId: context.workspaceId,
    campaignId,
    campaignVersion: expectedVersion,
  }).lean();
  if (campaign.reviewedVersion === expectedVersion && existing.length > 0)
    return recipientViews(existing, campaign);
  const filter: Record<string, unknown> = { workspaceId: context.workspaceId };
  if (audience.lifecycle) filter.lifecycle = audience.lifecycle;
  if (audience.service) filter.service = audience.service;
  if (audience.source) filter.source = audience.source;
  const customers = await Customer.find(filter).lean();
  const ids = customers.map((customer) => String(customer._id));
  const [consents, bookings] = await Promise.all([
    Consent.find({
      workspaceId: context.workspaceId,
      customerId: { $in: ids },
      channel: audience.consentChannel,
    })
      .sort({ capturedAt: -1, _id: -1 })
      .lean(),
    Booking.find({
      workspaceId: context.workspaceId,
      customerId: { $in: ids },
      state: { $in: ['tentative', 'confirmed'] },
    })
      .select('customerId')
      .lean(),
  ]);
  const latestConsent = new Map<string, (typeof consents)[number]>();
  for (const consent of consents)
    if (!latestConsent.has(consent.customerId)) latestConsent.set(consent.customerId, consent);
  const bookedIds = new Set(bookings.map((booking) => booking.customerId));
  const removedIds = new Set((campaign.removedCustomerIds ?? []).map(String));
  const checkedAt = new Date();
  const workspace = await Workspace.findById(context.workspaceId).lean();
  if (!workspace) throw new AppError('RESOURCE_NOT_FOUND', 'Workspace not found.', 404);
  const rows = customers.map((customer) => {
    const consent = latestConsent.get(String(customer._id));
    let eligibility: Eligibility = 'eligible';
    let reason: string | null = null;
    if (removedIds.has(String(customer._id))) {
      eligibility = 'removed';
      reason = 'Manually removed.';
    } else if (bookedIds.has(String(customer._id))) {
      eligibility = 'booked';
      reason = 'Customer already has an active booking.';
    } else if (!consent) {
      eligibility = 'no_consent';
      reason = 'No WhatsApp consent recorded.';
    } else if (consent.decision !== 'granted') {
      eligibility = 'withdrawn';
      reason = 'Latest WhatsApp consent is withdrawn.';
    } else if (!validWhatsAppPhone(normalizePhone(customer.phone))) {
      eligibility = 'invalid_contact';
      reason = 'Phone is not valid for WhatsApp.';
    }
    const preview = personalizeCampaignTemplate(campaign.template, {
      firstName: customer.firstName,
      service: customer.service,
      businessName: workspace.businessName,
    });
    return {
      _id: newId(),
      workspaceId: context.workspaceId,
      campaignId,
      campaignVersion: expectedVersion,
      customerId: String(customer._id),
      firstName: customer.firstName,
      lastName: customer.lastName,
      phone: normalizePhone(customer.phone) || null,
      service: customer.service,
      eligibility,
      reason,
      consentRecordId: consent?.decision === 'granted' ? String(consent._id) : null,
      eligibilityCheckedAt: checkedAt,
      personalizedPreview: preview,
      removed: eligibility === 'removed',
      outcome: null,
      bookingId: null,
      outcomeAt: null,
    };
  });
  const nextVersion = expectedVersion + 1;
  for (const row of rows) row.campaignVersion = nextVersion;
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const preparedRows: CampaignRecipientDoc[] = [];
      for (const row of rows) {
        const { _id, ...fields } = row;
        const saved = await CampaignRecipient.findOneAndUpdate(
          {
            workspaceId: context.workspaceId,
            campaignId,
            campaignVersion: nextVersion,
            customerId: row.customerId,
          },
          { $set: fields, $setOnInsert: { _id } },
          { upsert: true, returnDocument: 'after', session },
        );
        if (!saved) throw new Error('Recipient was not persisted');
        preparedRows.push(saved);
      }
      const updated = await Campaign.findOneAndUpdate(
        { _id: campaignId, workspaceId: context.workspaceId, version: expectedVersion },
        { $set: { reviewedVersion: nextVersion }, $inc: { version: 1 } },
        { returnDocument: 'after', session },
      );
      if (!updated)
        throw new AppError(
          'CAMPAIGN_VERSION_CONFLICT',
          'Campaign changed. Reload before reviewing recipients.',
          412,
        );
      await appendCampaignRevision(updated, session);
      let ordinal = 0;
      for (const row of preparedRows.filter((candidate) => candidate.eligibility === 'eligible')) {
        await appendEvent(
          {
            workspaceId: context.workspaceId,
            userId: commandActorUserId(context),
            requestId: String(context.requestId),
            commandId: String(context.commandId),
            subjectKind: 'campaign',
            subjectId: campaignId,
            ordinal,
            payload: {
              type: 'campaign.message_prepared',
              campaignId: campaignIdValue(campaignId),
              recipientId: campaignRecipientIdValue(String(row._id)),
            },
          },
          session,
        );
        ordinal += 1;
      }
    });
  } finally {
    await session.endSession();
  }
  const saved = await CampaignRecipient.find({
    workspaceId: context.workspaceId,
    campaignId,
    campaignVersion: nextVersion,
  }).lean();
  return recipientViews(saved, campaign);
}

async function recheckActivationEligibility(
  workspaceId: string,
  campaign: { _id: string; audience: unknown; version: number },
  session: mongoose.ClientSession,
) {
  const audience = audienceValue(campaign.audience);
  const rows = await CampaignRecipient.find({
    workspaceId,
    campaignId: campaign._id,
    campaignVersion: campaignRecipientVersion(campaign),
    removed: false,
  })
    .session(session)
    .lean();
  if (rows.length === 0) return 0;
  const ids = rows.map((row) => row.customerId);
  const [consents, bookings, customers] = await Promise.all([
    Consent.find({ workspaceId, customerId: { $in: ids }, channel: audience.consentChannel })
      .sort({ capturedAt: -1, _id: -1 })
      .session(session)
      .lean(),
    Booking.find({
      workspaceId,
      customerId: { $in: ids },
      state: { $in: ['tentative', 'confirmed'] },
    })
      .select('customerId')
      .session(session)
      .lean(),
    Customer.find({ workspaceId, _id: { $in: ids } })
      .select('_id phone')
      .session(session)
      .lean(),
  ]);
  const latest = new Map<string, (typeof consents)[number]>();
  for (const consent of consents)
    if (!latest.has(consent.customerId)) latest.set(consent.customerId, consent);
  const booked = new Set(bookings.map((booking) => booking.customerId));
  const phones = new Map(
    customers.map((customer) => [String(customer._id), normalizePhone(customer.phone)]),
  );
  await Customer.updateMany(
    { workspaceId, _id: { $in: ids } },
    { $inc: { campaignEligibilityLock: 1 } },
    { session },
  );
  let eligibleCount = 0;
  for (const row of rows) {
    const consent = latest.get(row.customerId);
    const phone = phones.get(row.customerId) || '';
    const eligibility: Eligibility = row.removed
      ? 'removed'
      : booked.has(row.customerId)
        ? 'booked'
        : consent?.decision === 'withdrawn'
          ? 'withdrawn'
          : !consent
            ? 'no_consent'
            : !validWhatsAppPhone(phone)
              ? 'invalid_contact'
              : 'eligible';
    const reason =
      eligibility === 'eligible'
        ? null
        : eligibility === 'booked'
          ? 'Customer already has an active booking.'
          : eligibility === 'withdrawn'
            ? 'WhatsApp consent is no longer granted.'
            : eligibility === 'no_consent'
              ? 'No WhatsApp consent recorded.'
              : eligibility === 'invalid_contact'
                ? 'Phone is not valid for WhatsApp.'
                : 'Manually removed.';
    if (eligibility === 'eligible') eligibleCount += 1;
    await CampaignRecipient.updateOne(
      { _id: row._id, workspaceId },
      {
        $set: {
          phone: phone || null,
          eligibility,
          reason,
          consentRecordId: consent?.decision === 'granted' ? String(consent._id) : null,
          eligibilityCheckedAt: new Date(),
        },
      },
      { session },
    );
  }
  return eligibleCount;
}

function recipientViews(
  rows: readonly {
    _id: string;
    campaignId: string;
    customerId: string;
    firstName: string;
    lastName: string;
    phone?: string | null;
    eligibility: Eligibility;
    reason?: string | null;
    consentRecordId?: string | null;
    eligibilityCheckedAt: Date;
    removed: boolean;
    outcome?: 'sent' | 'skipped' | 'replied' | 'booked' | null;
    personalizedPreview: string;
  }[],
  _campaign: { _id: string },
) {
  return {
    items: rows.map((row) => ({
      id: String(row._id),
      campaignId: String(row.campaignId),
      customerId: row.customerId,
      firstName: row.firstName,
      lastName: row.lastName,
      phone: row.phone,
      eligibility: row.eligibility,
      reason: row.reason,
      consentRecordId: row.consentRecordId,
      eligibilityCheckedAt: row.eligibilityCheckedAt.toISOString(),
      removed: row.removed,
      outcome: row.outcome,
      personalizedPreview: row.personalizedPreview,
      whatsappHref: null,
    })),
  };
}

export async function listRecipients(
  context: CommandContext,
  campaignId: string,
  options: { limit: number; cursor: number; eligibility?: Eligibility } = { limit: 50, cursor: 0 },
) {
  const campaign = await findCampaign(context.workspaceId, campaignId);
  const filter: Record<string, unknown> = {
    workspaceId: context.workspaceId,
    campaignId,
    campaignVersion: campaignRecipientVersion(campaign),
  };
  if (options.eligibility) filter.eligibility = options.eligibility;
  const rows = await CampaignRecipient.find(filter)
    .sort({ _id: 1 })
    .skip(options.cursor)
    .limit(options.limit + 1)
    .lean();
  const hasMore = rows.length > options.limit;
  if (hasMore) rows.pop();
  return {
    ...recipientViews(rows, campaign),
    nextCursor: hasMore ? String(options.cursor + options.limit) : null,
  };
}

export async function removeRecipient(
  context: CommandContext,
  campaignId: string,
  recipientId: string,
  expectedVersion: number,
) {
  const campaign = await findCampaign(context.workspaceId, campaignId);
  if (campaign.version !== expectedVersion)
    throw new AppError(
      'CAMPAIGN_VERSION_CONFLICT',
      'Campaign changed. Reload before removing a recipient.',
      412,
    );
  if (campaign.status !== 'draft')
    throw new AppError('CONFLICT', 'Only draft campaigns can remove recipients.', 409);
  const session = await mongoose.startSession();
  try {
    let removed: CampaignRecipientDoc | null = null;
    await session.withTransaction(async () => {
      const candidate = await CampaignRecipient.findOne({
        _id: recipientId,
        campaignId,
        workspaceId: context.workspaceId,
        campaignVersion: expectedVersion,
        removed: false,
      }).session(session);
      if (!candidate) throw new AppError('RESOURCE_NOT_FOUND', 'Recipient not found.', 404);
      const currentRows = await CampaignRecipient.find({
        workspaceId: context.workspaceId,
        campaignId,
        campaignVersion: expectedVersion,
      })
        .session(session)
        .lean();
      const copies = currentRows.map((row) => {
        const { _id: _oldId, createdAt: _createdAt, updatedAt: _updatedAt, ...fields } = row;
        return {
          ...fields,
          _id: newId(),
          campaignVersion: expectedVersion + 1,
          ...(row._id === candidate._id
            ? { removed: true, eligibility: 'removed', reason: 'Manually removed.' }
            : {}),
        };
      });
      const created: CampaignRecipientDoc[] = [];
      for (const copy of copies) {
        const row = new CampaignRecipient(copy);
        await row.save({ session });
        created.push(row);
      }
      removed = created.find((row) => row.customerId === candidate.customerId) ?? null;
      if (!removed) throw new AppError('RESOURCE_NOT_FOUND', 'Recipient not found.', 404);
      const updated = await Campaign.findOneAndUpdate(
        { _id: campaignId, workspaceId: context.workspaceId, version: expectedVersion },
        {
          $addToSet: { removedCustomerIds: removed.customerId },
          $set: { reviewedVersion: expectedVersion + 1 },
          $inc: { version: 1 },
        },
        { returnDocument: 'after', session },
      );
      if (!updated)
        throw new AppError(
          'CAMPAIGN_VERSION_CONFLICT',
          'Campaign changed. Reload before removing a recipient.',
          412,
        );
      await appendCampaignRevision(updated, session);
      await appendEvent(
        {
          workspaceId: context.workspaceId,
          userId: commandActorUserId(context),
          requestId: String(context.requestId),
          commandId: String(context.commandId),
          subjectKind: 'campaign',
          subjectId: campaignId,
          ordinal: 0,
          payload: {
            type: 'campaign.recipient_removed',
            campaignId: campaignIdValue(campaignId),
            recipientId: campaignRecipientIdValue(recipientId),
          },
        },
        session,
      );
    });
    if (!removed) throw new Error('Recipient was not removed');
    return recipientViews([removed], campaign).items[0];
  } finally {
    await session.endSession();
  }
}

export async function recordOutcome(
  context: CommandContext,
  campaignId: string,
  recipientId: string,
  input: OutcomeInput,
  idempotencyKey: string,
) {
  const keyHash = hashToken(`${context.workspaceId}:campaign.outcome:${idempotencyKey}`);
  const requestFingerprint = fingerprint({ campaignId, recipientId, input });
  const prior = await CommandReceipt.findOne({
    workspaceId: context.workspaceId,
    operation: 'campaign.outcome',
    keyHash,
  }).lean();
  if (prior) {
    if (prior.requestFingerprint !== requestFingerprint)
      throw new AppError(
        'IDEMPOTENCY_KEY_REUSED',
        'This idempotency key was used for a different outcome.',
        409,
      );
    const stored = CampaignOutcomeResponseSchema.parse(prior.response);
    return { ...stored, idempotent: true };
  }
  const campaign = await findCampaign(context.workspaceId, campaignId);
  if (campaign.status !== 'active')
    throw new AppError('CONFLICT', 'Only active campaigns accept outcomes.', 409);
  const session = await mongoose.startSession();
  try {
    let response: { recipient: unknown; idempotent: boolean } | undefined;
    await session.withTransaction(async () => {
      const recipient = await CampaignRecipient.findOne({
        _id: recipientId,
        campaignId,
        workspaceId: context.workspaceId,
        campaignVersion: campaignRecipientVersion(campaign),
      }).session(session);
      if (!recipient) throw new AppError('RESOURCE_NOT_FOUND', 'Recipient not found.', 404);
      const outcome = campaignOutcome(input.outcome);
      const bookingId = input.outcome === 'booked' ? input.bookingId : undefined;
      if (recipient.removed || recipient.eligibility !== 'eligible')
        throw new AppError('CONFLICT', 'This recipient is not eligible.', 409);
      const previous = recipient.outcome;
      const allowed =
        previous === null
          ? outcome === 'sent' || outcome === 'skipped'
          : previous === 'sent'
            ? outcome === 'replied' || outcome === 'booked'
            : previous === 'replied'
              ? outcome === 'booked'
              : false;
      if (!allowed)
        throw new AppError(
          'CONFLICT',
          'Outcome is not a valid next state for this recipient.',
          409,
        );
      if (outcome === 'sent') {
        const audience = audienceValue(campaign.audience);
        const [consent, activeBooking, customer] = await Promise.all([
          Consent.findOne({
            workspaceId: context.workspaceId,
            customerId: recipient.customerId,
            channel: audience.consentChannel,
          })
            .sort({ capturedAt: -1, _id: -1 })
            .session(session)
            .lean(),
          Booking.findOne({
            workspaceId: context.workspaceId,
            customerId: recipient.customerId,
            state: { $in: ['tentative', 'confirmed'] },
          })
            .select('_id')
            .session(session)
            .lean(),
          Customer.findOne({
            _id: recipient.customerId,
            workspaceId: context.workspaceId,
          })
            .select('phone')
            .session(session)
            .lean(),
        ]);
        await Customer.updateOne(
          { _id: recipient.customerId, workspaceId: context.workspaceId },
          { $inc: { campaignEligibilityLock: 1 } },
          { session },
        );
        const currentPhone = customer ? normalizePhone(customer.phone) : '';
        if (consent?.decision !== 'granted' || activeBooking || !validWhatsAppPhone(currentPhone))
          throw new AppError('CONFLICT', 'Recipient is no longer eligible to be marked sent.', 409);
        recipient.phone = currentPhone;
      }
      if (outcome === 'booked') {
        const booking = await Booking.findOne({
          _id: bookingId,
          workspaceId: context.workspaceId,
          customerId: recipient.customerId,
        }).session(session);
        if (!booking)
          throw new AppError(
            'RESOURCE_NOT_FOUND',
            'Booking relation not found for this customer.',
            404,
          );
        if (booking.sourceCampaignRecipientId && booking.sourceCampaignRecipientId !== recipientId)
          throw new AppError(
            'CONFLICT',
            'Booking is already attributed to another campaign recipient.',
            409,
          );
        await Booking.updateOne(
          {
            _id: bookingId,
            workspaceId: context.workspaceId,
            customerId: recipient.customerId,
            sourceCampaignRecipientId: null,
          },
          { $set: { sourceCampaignRecipientId: recipientId } },
          { session },
        );
      }
      recipient.outcome = outcome;
      recipient.bookingId = bookingId ?? null;
      recipient.outcomeAt = new Date();
      await recipient.save({ session });
      const recipientView = recipientViews([recipient], campaign).items[0];
      await appendEvent(
        {
          workspaceId: context.workspaceId,
          userId: commandActorUserId(context),
          requestId: String(context.requestId),
          commandId: String(context.commandId),
          subjectKind: 'campaign',
          subjectId: campaignId,
          ordinal: 0,
          payload: {
            type: 'campaign.outcome_recorded',
            campaignId: campaignIdValue(campaignId),
            recipientId: campaignRecipientIdValue(recipientId),
            outcome,
            ...(bookingId ? { bookingId: bookingIdValue(bookingId) } : {}),
          },
        },
        session,
      );
      if (outcome === 'sent')
        await appendEvent(
          {
            workspaceId: context.workspaceId,
            userId: commandActorUserId(context),
            requestId: String(context.requestId),
            commandId: String(context.commandId),
            subjectKind: 'campaign',
            subjectId: campaignId,
            ordinal: 1,
            payload: {
              type: 'campaign.message_sent',
              campaignId: campaignIdValue(campaignId),
              recipientId: campaignRecipientIdValue(recipientId),
            },
          },
          session,
        );
      if (outcome === 'replied')
        await appendEvent(
          {
            workspaceId: context.workspaceId,
            userId: commandActorUserId(context),
            requestId: String(context.requestId),
            commandId: String(context.commandId),
            subjectKind: 'campaign',
            subjectId: campaignId,
            ordinal: 1,
            payload: {
              type: 'campaign.reply_recorded',
              campaignId: campaignIdValue(campaignId),
              recipientId: campaignRecipientIdValue(recipientId),
            },
          },
          session,
        );
      if (outcome === 'booked' && bookingId)
        await appendEvent(
          {
            workspaceId: context.workspaceId,
            userId: commandActorUserId(context),
            requestId: String(context.requestId),
            commandId: String(context.commandId),
            subjectKind: 'campaign',
            subjectId: campaignId,
            ordinal: 1,
            payload: {
              type: 'campaign.booking_attributed',
              campaignId: campaignIdValue(campaignId),
              recipientId: campaignRecipientIdValue(recipientId),
              bookingId: bookingIdValue(bookingId),
            },
          },
          session,
        );
      const receipt = { recipient: recipientView, idempotent: false };
      await CommandReceipt.create(
        [
          {
            _id: String(context.commandId),
            workspaceId: context.workspaceId,
            operation: 'campaign.outcome',
            keyHash,
            requestFingerprint,
            resourceId: recipientId,
            response: receipt,
          },
        ],
        { session },
      );
      response = receipt;
    });
    if (!response) throw new Error('Outcome was not recorded');
    return response;
  } catch (error: unknown) {
    const raced = await CommandReceipt.findOne({
      workspaceId: context.workspaceId,
      operation: 'campaign.outcome',
      keyHash,
    }).lean();
    if (raced) {
      if (raced.requestFingerprint !== requestFingerprint)
        throw new AppError(
          'IDEMPOTENCY_KEY_REUSED',
          'This idempotency key was used for a different outcome.',
          409,
        );
      const stored = CampaignOutcomeResponseSchema.parse(raced.response);
      return { ...stored, idempotent: true };
    }
    throw error;
  } finally {
    await session.endSession();
  }
}

export async function campaignCsv(context: CommandContext, campaignId: string) {
  const campaign = await findCampaign(context.workspaceId, campaignId);
  const rows = await CampaignRecipient.find({
    workspaceId: context.workspaceId,
    campaignId,
    campaignVersion: campaignRecipientVersion(campaign),
  })
    .sort({ _id: 1 })
    .lean();
  const lines = [
    ['first_name', 'last_name', 'phone', 'eligibility', 'outcome', 'preview'],
    ...rows.map((row) => [
      row.firstName,
      row.lastName,
      row.phone ?? '',
      row.eligibility,
      row.outcome ?? '',
      row.personalizedPreview,
    ]),
  ];
  return (
    lines.map((line) => line.map((cell) => safeCampaignCsvCell(cell)).join(',')).join('\r\n') +
    '\r\n'
  );
}

export async function recipientWhatsAppLink(
  context: CommandContext,
  campaignId: string,
  recipientId: string,
) {
  const campaign = await findCampaign(context.workspaceId, campaignId);
  const recipient = await CampaignRecipient.findOne({
    _id: recipientId,
    campaignId,
    workspaceId: context.workspaceId,
    campaignVersion: campaignRecipientVersion(campaign),
  }).lean();
  if (!recipient || recipient.removed || recipient.eligibility !== 'eligible')
    throw new AppError('CONFLICT', 'Recipient is not eligible for WhatsApp.', 409);
  const audience = audienceValue(campaign.audience);
  const [consent, booking, customer] = await Promise.all([
    Consent.findOne({
      workspaceId: context.workspaceId,
      customerId: recipient.customerId,
      channel: audience.consentChannel,
    })
      .sort({ capturedAt: -1, _id: -1 })
      .lean(),
    Booking.findOne({
      workspaceId: context.workspaceId,
      customerId: recipient.customerId,
      state: { $in: ['tentative', 'confirmed'] },
    })
      .select('_id')
      .lean(),
    Customer.findOne({ _id: recipient.customerId, workspaceId: context.workspaceId })
      .select('phone')
      .lean(),
  ]);
  const phone = customer ? normalizePhone(customer.phone) : '';
  if (
    campaign.status !== 'active' ||
    consent?.decision !== 'granted' ||
    booking ||
    !validWhatsAppPhone(phone)
  )
    throw new AppError('CONFLICT', 'Recipient is no longer eligible for WhatsApp.', 409);
  return {
    href: preparedWhatsAppLink(phone, recipient.personalizedPreview),
    deliveryClaim: 'prepared_link_only' as const,
  };
}
