import mongoose, { type InferSchemaType, type Model } from 'mongoose';

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
    onboardingComplete: { type: Boolean, default: false },
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
    idempotencyKeyHash: { type: String, required: true },
    requestFingerprint: { type: String, required: true },
  },
  base,
);
BookingSchema.index({ workspaceId: 1, appointmentAt: -1, _id: -1 });
BookingSchema.index({ workspaceId: 1, idempotencyKeyHash: 1 }, { unique: true });
const SessionSchema = new mongoose.Schema(
  {
    tokenHash: { type: String, required: true, unique: true },
    userId: { type: String, required: true },
    workspaceId: { type: String, required: true },
    csrfHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    generation: { type: Number, required: true },
    revokedAt: Date,
  },
  base,
);
SessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
const EventSchema = new mongoose.Schema(
  {
    workspaceId: { type: String, required: true, index: true },
    commandId: { type: String, required: true },
    ordinal: { type: Number, required: true },
    occurredAt: { type: Date, required: true },
    actorUserId: { type: String, required: true },
    requestId: { type: String, required: true },
    subjectKind: { type: String, required: true },
    subjectId: { type: String, required: true },
    type: { type: String, required: true },
    payload: { type: mongoose.Schema.Types.Mixed, required: true },
  },
  base,
);
EventSchema.index({ workspaceId: 1, commandId: 1, ordinal: 1 }, { unique: true });
EventSchema.index({ workspaceId: 1, type: 1, occurredAt: -1, _id: -1 });

export type UserDoc = InferSchemaType<typeof UserSchema> & { _id: string };
export type WorkspaceDoc = InferSchemaType<typeof WorkspaceSchema> & { _id: string };
export type CustomerDoc = InferSchemaType<typeof CustomerSchema> & { _id: string };
export type ConsentDoc = InferSchemaType<typeof ConsentSchema> & { _id: string };
export type BookingDoc = InferSchemaType<typeof BookingSchema> & { _id: string };
export type SessionDoc = InferSchemaType<typeof SessionSchema> & { _id: mongoose.Types.ObjectId };

export const User: Model<UserDoc> = mongoose.models.User ?? mongoose.model('User', UserSchema);
export const Workspace: Model<WorkspaceDoc> =
  mongoose.models.Workspace ?? mongoose.model('Workspace', WorkspaceSchema);
export const Customer: Model<CustomerDoc> =
  mongoose.models.Customer ?? mongoose.model('Customer', CustomerSchema);
export const Consent: Model<ConsentDoc> =
  mongoose.models.Consent ?? mongoose.model('Consent', ConsentSchema);
export const Booking: Model<BookingDoc> =
  mongoose.models.Booking ?? mongoose.model('Booking', BookingSchema);
export const Session: Model<SessionDoc> =
  mongoose.models.Session ?? mongoose.model('Session', SessionSchema);
export const OperationalEvent =
  mongoose.models.OperationalEvent ?? mongoose.model('OperationalEvent', EventSchema);

export async function ensureIndexes(): Promise<void> {
  await Promise.all([
    User.syncIndexes(),
    Workspace.syncIndexes(),
    Customer.syncIndexes(),
    Consent.syncIndexes(),
    Booking.syncIndexes(),
    Session.syncIndexes(),
    OperationalEvent.syncIndexes(),
  ]);
}
