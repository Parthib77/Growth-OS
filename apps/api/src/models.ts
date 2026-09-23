import mongoose, { type InferSchemaType, type Model } from 'mongoose';
import {
  operationalEventPayloadSchemas,
  operationalEventSchemaByType,
  subjectKinds,
} from '@growthos/contracts';

const base = { timestamps: true, versionKey: false } as const;

const stringIdentity = { _id: { type: String, required: true } } as const;
const UserSchema = new mongoose.Schema(
  {
    ...stringIdentity,
    email: { type: String, required: true, unique: true, index: true },
    normalizedEmail: { type: String, required: true, unique: true },
    passwordHash: { type: String, required: true },
    sessionGeneration: { type: Number, required: true, default: 0 },
  },
  base,
);
const WorkspaceSchema = new mongoose.Schema(
  {
    ...stringIdentity,
    ownerUserId: { type: String, required: true, index: true },
    businessName: { type: String, required: true },
    category: String,
    timezone: { type: String, default: 'UTC' },
    currency: { type: String, default: 'USD' },
    defaultCountryCode: { type: String, default: '+1' },
    bookingLink: { type: String, default: '' },
    followUpDays: { type: Number, default: 3 },
    reviewResponseTemplate: { type: String, default: '' },
    onboardingComplete: { type: Boolean, default: false },
    isDemo: { type: Boolean, required: true, default: false },
  },
  base,
);
const CustomerSchema = new mongoose.Schema(
  {
    ...stringIdentity,
    workspaceId: { type: String, required: true, index: true },
    firstName: { type: String, required: true },
    lastName: { type: String, default: '' },
    phone: { type: String, required: true },
    normalizedPhone: { type: String, required: true },
    email: { type: String, default: null },
    normalizedEmail: { type: String, default: null },
    source: { type: String, required: true },
    service: { type: String, required: true },
    quotedMinorUnits: Number,
    lifecycle: { type: String, required: true, default: 'enquiry' },
    lastInteractionAt: { type: Date, required: true },
    serviceInterests: { type: [String], default: [] },
    internalNotes: { type: String, default: '' },
    campaignEligibilityLock: { type: Number, required: true, default: 0 },
  },
  base,
);
CustomerSchema.index({ workspaceId: 1, normalizedPhone: 1 });
CustomerSchema.index({ workspaceId: 1, normalizedEmail: 1 });
CustomerSchema.index({ workspaceId: 1, lifecycle: 1, lastInteractionAt: 1, _id: 1 });
const ConsentSchema = new mongoose.Schema(
  {
    ...stringIdentity,
    workspaceId: { type: String, required: true, index: true },
    customerId: { type: String, required: true },
    channel: { type: String, required: true },
    decision: { type: String, required: true },
    capturedAt: { type: Date, required: true },
  },
  base,
);
ConsentSchema.index({ workspaceId: 1, customerId: 1, channel: 1, capturedAt: -1, _id: -1 });
const InteractionSchema = new mongoose.Schema(
  {
    ...stringIdentity,
    workspaceId: { type: String, required: true, index: true },
    customerId: { type: String, required: true },
    actorUserId: { type: String, required: true },
    kind: { type: String, required: true, enum: ['enquiry', 'call', 'message', 'note'] },
    body: { type: String, required: true },
    serviceInterest: { type: String, default: null },
    occurredAt: { type: Date, required: true },
  },
  base,
);
InteractionSchema.index({ workspaceId: 1, customerId: 1, occurredAt: -1, _id: -1 });
const ImportBatchSchema = new mongoose.Schema(
  {
    ...stringIdentity,
    workspaceId: { type: String, required: true, index: true },
    createdBy: { type: String, required: true },
    headers: { type: [String], required: true },
    mapping: { type: mongoose.Schema.Types.Mixed, required: true },
    rows: { type: mongoose.Schema.Types.Mixed, required: true },
    committedAt: Date,
    commitResponse: mongoose.Schema.Types.Mixed,
    createdAt: { type: Date, required: true },
    expiresAt: { type: Date, required: true },
  },
  { versionKey: false, timestamps: false },
);
ImportBatchSchema.index({ workspaceId: 1, createdAt: -1, _id: -1 });
ImportBatchSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
const CampaignSchema = new mongoose.Schema(
  {
    ...stringIdentity,
    workspaceId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    channel: { type: String, required: true, enum: ['whatsapp'] },
    template: { type: String, required: true },
    audience: { type: mongoose.Schema.Types.Mixed, required: true },
    status: {
      type: String,
      required: true,
      enum: ['draft', 'ready', 'active', 'completed', 'cancelled'],
      default: 'draft',
    },
    version: { type: Number, required: true, default: 1 },
    reviewedVersion: { type: Number, default: 0 },
    removedCustomerIds: { type: [String], default: [] },
  },
  base,
);
CampaignSchema.index({ workspaceId: 1, status: 1, updatedAt: -1, _id: -1 });
const CampaignRevisionSchema = new mongoose.Schema(
  {
    ...stringIdentity,
    workspaceId: { type: String, required: true, index: true },
    campaignId: { type: String, required: true },
    version: { type: Number, required: true },
    name: { type: String, required: true },
    channel: { type: String, required: true, enum: ['whatsapp'] },
    template: { type: String, required: true },
    audience: { type: mongoose.Schema.Types.Mixed, required: true },
    status: {
      type: String,
      required: true,
      enum: ['draft', 'ready', 'active', 'completed', 'cancelled'],
    },
    reviewedVersion: { type: Number, required: true },
    recordedAt: { type: Date, required: true },
  },
  { versionKey: false, timestamps: false },
);
CampaignRevisionSchema.index({ workspaceId: 1, campaignId: 1, version: 1 }, { unique: true });
const ReviewSchema = new mongoose.Schema(
  {
    ...stringIdentity,
    workspaceId: { type: String, required: true, index: true },
    reviewerName: { type: String, required: true, immutable: true },
    rating: { type: Number, required: true, min: 1, max: 5, immutable: true },
    text: { type: String, required: true, immutable: true },
    source: { type: String, required: true, immutable: true },
    receivedAt: { type: Date, required: true, immutable: true },
    responseState: {
      type: String,
      required: true,
      enum: ['unanswered', 'drafted', 'posted_manually'],
      default: 'unanswered',
    },
    responseText: { type: String, default: null },
    responseRevisedAt: { type: Date, default: null },
    responsePostedAt: { type: Date, default: null },
  },
  base,
);
ReviewSchema.index({ workspaceId: 1, responseState: 1, receivedAt: -1, _id: -1 });
ReviewSchema.index({ workspaceId: 1, receivedAt: -1, _id: -1 });
const ReviewImportBatchSchema = new mongoose.Schema(
  {
    ...stringIdentity,
    workspaceId: { type: String, required: true, index: true },
    createdBy: { type: String, required: true },
    headers: { type: [String], required: true },
    rows: { type: mongoose.Schema.Types.Mixed, required: true },
    committedAt: Date,
    commitResponse: mongoose.Schema.Types.Mixed,
    createdAt: { type: Date, required: true },
    expiresAt: { type: Date, required: true },
  },
  { versionKey: false, timestamps: false },
);
ReviewImportBatchSchema.index({ workspaceId: 1, createdAt: -1, _id: -1 });
ReviewImportBatchSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
const CampaignRecipientSchema = new mongoose.Schema(
  {
    ...stringIdentity,
    workspaceId: { type: String, required: true, index: true },
    campaignId: { type: String, required: true },
    campaignVersion: { type: Number, required: true },
    customerId: { type: String, required: true },
    firstName: { type: String, required: true },
    lastName: { type: String, default: '' },
    phone: { type: String, default: null },
    service: { type: String, required: true },
    eligibility: {
      type: String,
      required: true,
      enum: [
        'eligible',
        'removed',
        'withdrawn',
        'booked',
        'invalid_contact',
        'no_consent',
        'cancelled',
      ],
    },
    reason: { type: String, default: null },
    consentRecordId: { type: String, default: null },
    eligibilityCheckedAt: { type: Date, required: true },
    personalizedPreview: { type: String, required: true },
    removed: { type: Boolean, required: true, default: false },
    outcome: { type: String, enum: ['sent', 'skipped', 'replied', 'booked'], default: null },
    bookingId: { type: String, default: null },
    outcomeAt: { type: Date, default: null },
  },
  base,
);
CampaignRecipientSchema.index(
  { workspaceId: 1, campaignId: 1, campaignVersion: 1, customerId: 1 },
  { unique: true },
);
CampaignRecipientSchema.index({
  workspaceId: 1,
  campaignId: 1,
  campaignVersion: 1,
  eligibility: 1,
  removed: 1,
  _id: 1,
});
CampaignRecipientSchema.index({
  workspaceId: 1,
  customerId: 1,
  outcome: 1,
  outcomeAt: -1,
  _id: -1,
});
const BookingSchema = new mongoose.Schema(
  {
    ...stringIdentity,
    workspaceId: { type: String, required: true, index: true },
    customerId: { type: String, required: true },
    service: { type: String, required: true },
    appointmentAt: { type: Date, required: true },
    agreedMinorUnits: { type: Number, required: true },
    currency: { type: String, required: true },
    notes: { type: String, default: '' },
    state: { type: String, required: true, default: 'confirmed' },
    sourceCampaignRecipientId: { type: String, default: null },
  },
  base,
);
BookingSchema.index({ workspaceId: 1, appointmentAt: -1, _id: -1 });
BookingSchema.index({ workspaceId: 1, customerId: 1, createdAt: -1, _id: -1 });
BookingSchema.index({ workspaceId: 1, sourceCampaignRecipientId: 1, createdAt: -1, _id: -1 });
const SessionSchema = new mongoose.Schema(
  {
    tokenHash: { type: String, required: true, unique: true },
    userId: { type: String, required: true },
    workspaceId: { type: String, required: true },
    csrfHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    idleExpiresAt: { type: Date, required: true },
    absoluteExpiresAt: { type: Date, required: true },
    lastSeenAt: { type: Date, required: true },
    issuedAt: { type: Date, required: true },
    generation: { type: Number, required: true },
    revokedAt: Date,
  },
  base,
);
SessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
const EventSchema = new mongoose.Schema(
  {
    ...stringIdentity,
    eventId: { type: String, required: true, unique: true },
    schemaVersion: { type: Number, required: true, enum: [1] },
    workspaceId: { type: String, required: true, index: true },
    commandId: { type: String, required: true },
    ordinal: { type: Number, required: true },
    occurredAt: { type: Date, required: true },
    actorUserId: { type: String, default: null },
    actorKind: { type: String, required: true, enum: ['user', 'system'] },
    requestId: { type: String, required: true },
    subjectKind: { type: String, required: true, enum: subjectKinds },
    subjectId: { type: String, required: true },
    type: { type: String, required: true, enum: Object.keys(operationalEventPayloadSchemas) },
    payload: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
      validate: {
        validator: (value: unknown) => {
          if (!value || typeof value !== 'object' || !('type' in value)) return false;
          const eventType = value.type;
          if (typeof eventType !== 'string') return false;
          const schema = operationalEventSchemaByType.get(eventType);
          return schema ? schema.safeParse(value).success : false;
        },
        message: 'Operational event payload is not a registered event variant',
      },
    },
  },
  base,
);
EventSchema.index({ workspaceId: 1, commandId: 1, ordinal: 1 }, { unique: true });
EventSchema.index({ workspaceId: 1, type: 1, occurredAt: -1, _id: -1 });
EventSchema.index({ workspaceId: 1, occurredAt: -1, _id: -1 });
EventSchema.index({ workspaceId: 1, subjectKind: 1, subjectId: 1, occurredAt: -1, _id: -1 });

const CommandReceiptSchema = new mongoose.Schema(
  {
    ...stringIdentity,
    workspaceId: { type: String, required: true },
    operation: { type: String, required: true },
    keyHash: { type: String, required: true },
    requestFingerprint: { type: String, required: true },
    resourceId: { type: String, required: true },
    response: { type: mongoose.Schema.Types.Mixed, required: true },
  },
  base,
);
CommandReceiptSchema.index({ workspaceId: 1, operation: 1, keyHash: 1 }, { unique: true });
CommandReceiptSchema.index({ workspaceId: 1, operation: 1, createdAt: -1 });
const AccountDeletionReceiptSchema = new mongoose.Schema(
  {
    ...stringIdentity,
    requestId: { type: String, required: true, index: true },
    occurredAt: { type: Date, required: true },
    schemaVersion: { type: Number, required: true, enum: [1] },
    subjectHmac: { type: String, required: true },
  },
  { versionKey: false, timestamps: false },
);
AccountDeletionReceiptSchema.index({ occurredAt: -1 });

export type UserDoc = InferSchemaType<typeof UserSchema> & { _id: string };
export type WorkspaceDoc = InferSchemaType<typeof WorkspaceSchema> & { _id: string };
export type CustomerDoc = InferSchemaType<typeof CustomerSchema> & { _id: string };
export type ConsentDoc = InferSchemaType<typeof ConsentSchema> & { _id: string };
export type InteractionDoc = InferSchemaType<typeof InteractionSchema> & { _id: string };
export type ImportBatchDoc = InferSchemaType<typeof ImportBatchSchema> & { _id: string };
export type CampaignDoc = InferSchemaType<typeof CampaignSchema> & { _id: string };
export type CampaignRevisionDoc = InferSchemaType<typeof CampaignRevisionSchema> & { _id: string };
export type ReviewDoc = InferSchemaType<typeof ReviewSchema> & { _id: string };
export type ReviewImportBatchDoc = InferSchemaType<typeof ReviewImportBatchSchema> & {
  _id: string;
};
export type CampaignRecipientDoc = InferSchemaType<typeof CampaignRecipientSchema> & {
  _id: string;
};
export type BookingDoc = InferSchemaType<typeof BookingSchema> & { _id: string };
export type SessionDoc = InferSchemaType<typeof SessionSchema> & { _id: mongoose.Types.ObjectId };
export type OperationalEventDoc = InferSchemaType<typeof EventSchema> & { _id: string };
export type CommandReceiptDoc = InferSchemaType<typeof CommandReceiptSchema> & { _id: string };
export type AccountDeletionReceiptDoc = InferSchemaType<typeof AccountDeletionReceiptSchema> & {
  _id: string;
};

export const User: Model<UserDoc> = mongoose.models.User ?? mongoose.model('User', UserSchema);
export const Workspace: Model<WorkspaceDoc> =
  mongoose.models.Workspace ?? mongoose.model('Workspace', WorkspaceSchema);
export const Customer: Model<CustomerDoc> =
  mongoose.models.Customer ?? mongoose.model('Customer', CustomerSchema);
export const Consent: Model<ConsentDoc> =
  mongoose.models.Consent ?? mongoose.model('Consent', ConsentSchema);
export const Interaction: Model<InteractionDoc> =
  mongoose.models.Interaction ?? mongoose.model('Interaction', InteractionSchema);
export const ImportBatch: Model<ImportBatchDoc> =
  mongoose.models.ImportBatch ?? mongoose.model('ImportBatch', ImportBatchSchema);
export const Campaign: Model<CampaignDoc> =
  mongoose.models.Campaign ?? mongoose.model('Campaign', CampaignSchema);
export const CampaignRevision: Model<CampaignRevisionDoc> =
  mongoose.models.CampaignRevision ?? mongoose.model('CampaignRevision', CampaignRevisionSchema);
export const Review: Model<ReviewDoc> =
  mongoose.models.Review ?? mongoose.model('Review', ReviewSchema);
export const ReviewImportBatch: Model<ReviewImportBatchDoc> =
  mongoose.models.ReviewImportBatch ?? mongoose.model('ReviewImportBatch', ReviewImportBatchSchema);
export const CampaignRecipient: Model<CampaignRecipientDoc> =
  mongoose.models.CampaignRecipient ?? mongoose.model('CampaignRecipient', CampaignRecipientSchema);
export const Booking: Model<BookingDoc> =
  mongoose.models.Booking ?? mongoose.model('Booking', BookingSchema);
export const Session: Model<SessionDoc> =
  mongoose.models.Session ?? mongoose.model('Session', SessionSchema);
export const OperationalEvent =
  mongoose.models.OperationalEvent ?? mongoose.model('OperationalEvent', EventSchema);
export const CommandReceipt: Model<CommandReceiptDoc> =
  mongoose.models.CommandReceipt ?? mongoose.model('CommandReceipt', CommandReceiptSchema);
export const AccountDeletionReceipt: Model<AccountDeletionReceiptDoc> =
  mongoose.models.AccountDeletionReceipt ??
  mongoose.model('AccountDeletionReceipt', AccountDeletionReceiptSchema);

export async function ensureIndexes(): Promise<void> {
  await Promise.all([
    User.syncIndexes(),
    Workspace.syncIndexes(),
    Customer.syncIndexes(),
    Consent.syncIndexes(),
    Interaction.syncIndexes(),
    ImportBatch.syncIndexes(),
    Campaign.syncIndexes(),
    CampaignRevision.syncIndexes(),
    Review.syncIndexes(),
    ReviewImportBatch.syncIndexes(),
    CampaignRecipient.syncIndexes(),
    Booking.syncIndexes(),
    Session.syncIndexes(),
    OperationalEvent.syncIndexes(),
    CommandReceipt.syncIndexes(),
    AccountDeletionReceipt.syncIndexes(),
  ]);
}

export async function verifyIndexes(): Promise<void> {
  const expected: Readonly<Record<string, readonly string[]>> = {
    User: ['email_1', 'normalizedEmail_1'],
    Workspace: ['ownerUserId_1'],
    Customer: [
      'workspaceId_1',
      'workspaceId_1_normalizedPhone_1',
      'workspaceId_1_normalizedEmail_1',
      'workspaceId_1_lifecycle_1_lastInteractionAt_1__id_1',
    ],
    Consent: ['workspaceId_1', 'workspaceId_1_customerId_1_channel_1_capturedAt_-1__id_-1'],
    Interaction: ['workspaceId_1', 'workspaceId_1_customerId_1_occurredAt_-1__id_-1'],
    ImportBatch: ['workspaceId_1', 'workspaceId_1_createdAt_-1__id_-1', 'expiresAt_1'],
    Campaign: ['workspaceId_1', 'workspaceId_1_status_1_updatedAt_-1__id_-1'],
    CampaignRevision: ['workspaceId_1', 'workspaceId_1_campaignId_1_version_1'],
    Review: [
      'workspaceId_1',
      'workspaceId_1_responseState_1_receivedAt_-1__id_-1',
      'workspaceId_1_receivedAt_-1__id_-1',
    ],
    ReviewImportBatch: ['workspaceId_1', 'workspaceId_1_createdAt_-1__id_-1', 'expiresAt_1'],
    CampaignRecipient: [
      'workspaceId_1',
      'workspaceId_1_campaignId_1_campaignVersion_1_customerId_1',
      'workspaceId_1_campaignId_1_campaignVersion_1_eligibility_1_removed_1__id_1',
      'workspaceId_1_customerId_1_outcome_1_outcomeAt_-1__id_-1',
    ],
    Booking: [
      'workspaceId_1',
      'workspaceId_1_appointmentAt_-1__id_-1',
      'workspaceId_1_customerId_1_createdAt_-1__id_-1',
      'workspaceId_1_sourceCampaignRecipientId_1_createdAt_-1__id_-1',
    ],
    Session: ['tokenHash_1', 'expiresAt_1'],
    OperationalEvent: [
      'eventId_1',
      'workspaceId_1',
      'workspaceId_1_commandId_1_ordinal_1',
      'workspaceId_1_type_1_occurredAt_-1__id_-1',
      'workspaceId_1_occurredAt_-1__id_-1',
      'workspaceId_1_subjectKind_1_subjectId_1_occurredAt_-1__id_-1',
    ],
    CommandReceipt: [
      'workspaceId_1_operation_1_keyHash_1',
      'workspaceId_1_operation_1_createdAt_-1',
    ],
    AccountDeletionReceipt: ['requestId_1', 'occurredAt_-1'],
  };
  const models = [
    User,
    Workspace,
    Customer,
    Consent,
    Interaction,
    ImportBatch,
    Campaign,
    CampaignRevision,
    Review,
    ReviewImportBatch,
    CampaignRecipient,
    Booking,
    Session,
    OperationalEvent,
    CommandReceipt,
    AccountDeletionReceipt,
  ];
  for (const model of models) {
    const indexes = await model.listIndexes();
    const names = new Set(
      indexes.flatMap((index) => (typeof index.name === 'string' ? [index.name] : [])),
    );
    const missing = (expected[model.modelName] ?? []).filter((name) => !names.has(name));
    if (missing.length > 0)
      throw new Error(`${model.modelName} indexes missing: ${missing.join(', ')}`);
  }
}

export async function supportsTransactions(): Promise<boolean> {
  const db = mongoose.connection.db;
  if (!db) return false;
  const hello = await db.admin().command({ hello: 1 });
  return typeof hello.setName === 'string' || hello.msg === 'isdbgrid';
}
