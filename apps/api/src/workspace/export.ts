import {
  operationalEventSchemaByType,
  parseOperationalEventPayload,
  redactEventPayload,
  WorkspaceExportSchema,
  type WorkspaceExportDocument,
} from '@growthos/contracts';
import type {
  CampaignDoc,
  CampaignRecipientDoc,
  CampaignRevisionDoc,
  BookingDoc,
  ConsentDoc,
  CustomerDoc,
  InteractionDoc,
  OperationalEventDoc,
  ReviewDoc,
  UserDoc,
  WorkspaceDoc,
} from '../models.js';
import { AppError } from '../errors.js';
import { workspaceView } from './view.js';

export const WORKSPACE_EXPORT_LIMITS = Object.freeze({
  maxRecordsPerCollection: 10_000,
  maxBytes: 5_000_000,
});

function dateValue(value: Date): string {
  return new Date(value).toISOString();
}

function responseView(review: ReviewDoc) {
  return {
    id: String(review._id),
    reviewerName: review.reviewerName,
    rating: review.rating,
    text: review.text,
    source: review.source,
    receivedAt: dateValue(review.receivedAt),
    response:
      review.responseState === 'unanswered'
        ? { kind: 'unanswered' as const }
        : review.responseState === 'drafted'
          ? {
              kind: 'drafted' as const,
              text: review.responseText ?? '',
              revisedAt: dateValue(review.responseRevisedAt ?? review.receivedAt),
            }
          : {
              kind: 'posted_manually' as const,
              text: review.responseText ?? '',
              postedAt: dateValue(review.responsePostedAt ?? review.receivedAt),
            },
  };
}

function operationalEventView(event: OperationalEventDoc) {
  const eventSchema = operationalEventSchemaByType.get(event.type);
  if (!eventSchema)
    throw new AppError('INTERNAL_ERROR', 'Stored event type is not registered.', 500);
  eventSchema.parse(event.payload);
  const payload = redactEventPayload(parseOperationalEventPayload(event.payload));
  return {
    eventId: event.eventId,
    requestId: event.requestId,
    commandId: event.commandId,
    ordinal: event.ordinal,
    occurredAt: dateValue(event.occurredAt),
    subject: { kind: event.subjectKind, id: event.subjectId },
    payload,
  };
}

function enforceCollectionBound(name: string, count: number): void {
  if (count > WORKSPACE_EXPORT_LIMITS.maxRecordsPerCollection)
    throw new AppError('CONFLICT', `Workspace export exceeds the ${name} record limit.`, 413);
}

export function projectWorkspaceExport(input: {
  user: UserDoc;
  workspace: WorkspaceDoc;
  customers: readonly CustomerDoc[];
  consents: readonly ConsentDoc[];
  interactions: readonly InteractionDoc[];
  campaigns: readonly CampaignDoc[];
  campaignRevisions: readonly CampaignRevisionDoc[];
  campaignRecipients: readonly CampaignRecipientDoc[];
  bookings: readonly BookingDoc[];
  reviews: readonly ReviewDoc[];
  operationalEvents: readonly OperationalEventDoc[];
}): WorkspaceExportDocument {
  const collections = [
    ['customers', input.customers.length],
    ['consents', input.consents.length],
    ['interactions', input.interactions.length],
    ['campaigns', input.campaigns.length],
    ['campaignRevisions', input.campaignRevisions.length],
    ['campaignRecipients', input.campaignRecipients.length],
    ['bookings', input.bookings.length],
    ['reviews', input.reviews.length],
    ['operationalEvents', input.operationalEvents.length],
  ] as const;
  for (const [name, count] of collections) enforceCollectionBound(name, count);

  const document = {
    schemaVersion: 1 as const,
    exportedAt: new Date().toISOString(),
    account: { email: input.user.email },
    workspace: workspaceView(input.workspace),
    customers: input.customers.map((customer) => ({
      id: String(customer._id),
      firstName: customer.firstName,
      lastName: customer.lastName,
      phone: customer.phone,
      email: customer.email ?? null,
      source: customer.source,
      service: customer.service,
      quotedMinorUnits: customer.quotedMinorUnits ?? null,
      lifecycle: customer.lifecycle,
      lastInteractionAt: dateValue(customer.lastInteractionAt),
      serviceInterests: customer.serviceInterests ?? [],
      internalNotes: customer.internalNotes ?? '',
    })),
    consents: input.consents.map((consent) => ({
      id: String(consent._id),
      customerId: consent.customerId,
      channel: consent.channel,
      decision: consent.decision,
      capturedAt: dateValue(consent.capturedAt),
    })),
    interactions: input.interactions.map((interaction) => ({
      id: String(interaction._id),
      customerId: interaction.customerId,
      actorUserId: interaction.actorUserId,
      kind: interaction.kind,
      body: interaction.body,
      serviceInterest: interaction.serviceInterest ?? null,
      occurredAt: dateValue(interaction.occurredAt),
    })),
    campaigns: input.campaigns.map((campaign) => ({
      id: String(campaign._id),
      name: campaign.name,
      channel: campaign.channel,
      template: campaign.template,
      audience: campaign.audience,
      status: campaign.status,
      version: campaign.version,
      reviewedVersion: campaign.reviewedVersion,
    })),
    campaignRevisions: input.campaignRevisions.map((revision) => ({
      id: String(revision._id),
      campaignId: revision.campaignId,
      version: revision.version,
      name: revision.name,
      channel: revision.channel,
      template: revision.template,
      audience: revision.audience,
      status: revision.status,
      reviewedVersion: revision.reviewedVersion,
      recordedAt: dateValue(revision.recordedAt),
    })),
    campaignRecipients: input.campaignRecipients.map((recipient) => ({
      id: String(recipient._id),
      campaignId: recipient.campaignId,
      customerId: recipient.customerId,
      firstName: recipient.firstName,
      lastName: recipient.lastName,
      phone: recipient.phone ?? null,
      service: recipient.service,
      eligibility: recipient.eligibility,
      reason: recipient.reason ?? null,
      consentRecordId: recipient.consentRecordId ?? null,
      eligibilityCheckedAt: dateValue(recipient.eligibilityCheckedAt),
      personalizedPreview: recipient.personalizedPreview,
      removed: recipient.removed,
      outcome: recipient.outcome ?? null,
      bookingId: recipient.bookingId ?? null,
      outcomeAt: recipient.outcomeAt ? dateValue(recipient.outcomeAt) : null,
    })),
    bookings: input.bookings.map((booking) => ({
      id: String(booking._id),
      customerId: booking.customerId,
      service: booking.service,
      appointmentAt: dateValue(booking.appointmentAt),
      agreedMinorUnits: booking.agreedMinorUnits,
      currency: booking.currency,
      notes: booking.notes,
      state: booking.state,
      sourceCampaignRecipientId: booking.sourceCampaignRecipientId ?? null,
    })),
    reviews: input.reviews.map(responseView),
    operationalEvents: input.operationalEvents.map(operationalEventView),
  };
  const parsed = WorkspaceExportSchema.parse(document);
  const bytes = Buffer.byteLength(JSON.stringify(parsed), 'utf8');
  if (bytes > WORKSPACE_EXPORT_LIMITS.maxBytes)
    throw new AppError('CONFLICT', 'Workspace export exceeds the byte limit.', 413);
  return parsed;
}
