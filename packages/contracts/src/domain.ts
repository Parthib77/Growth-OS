import { z } from 'zod';

export type Brand<T, Name extends string> = T & { readonly __brand: Name };
export type WorkspaceId = Brand<string, 'WorkspaceId'>;
export type UserId = Brand<string, 'UserId'>;
export type CustomerId = Brand<string, 'CustomerId'>;
export type BookingId = Brand<string, 'BookingId'>;
export type EventId = Brand<string, 'EventId'>;
export type CommandId = Brand<string, 'CommandId'>;
export type RequestId = Brand<string, 'RequestId'>;
export type SessionId = Brand<string, 'SessionId'>;
export type ConsentRecordId = Brand<string, 'ConsentRecordId'>;
export type InteractionId = Brand<string, 'InteractionId'>;
export type ImportBatchId = Brand<string, 'ImportBatchId'>;
export type CampaignId = Brand<string, 'CampaignId'>;
export type CampaignRecipientId = Brand<string, 'CampaignRecipientId'>;
export type Version = Brand<number, 'Version'>;
export type UtcInstant = Brand<string, 'UtcInstant'>;
export type IanaTimezone = Brand<string, 'IanaTimezone'>;
export type CurrencyCode = Brand<string, 'CurrencyCode'>;
export type MinorUnits = Brand<number, 'MinorUnits'>;
export type IdempotencyKey = Brand<string, 'IdempotencyKey'>;

export const campaignStatuses = ['draft', 'ready', 'active', 'completed', 'cancelled'] as const;
export type CampaignStatus = (typeof campaignStatuses)[number];
export const campaignOutcomes = ['sent', 'skipped', 'replied', 'booked'] as const;
export type CampaignOutcome = (typeof campaignOutcomes)[number];
export const campaignTemplateVariables = ['first_name', 'service', 'business_name'] as const;
export type CampaignTemplateVariable = (typeof campaignTemplateVariables)[number];

const campaignTransitionTable: Record<CampaignStatus, readonly CampaignStatus[]> = {
  draft: ['ready', 'cancelled'],
  ready: ['draft', 'active', 'cancelled'],
  active: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
};
export function canTransitionCampaign(from: CampaignStatus, to: CampaignStatus): boolean {
  return campaignTransitionTable[from].includes(to);
}
export function assertCampaignTransition(from: CampaignStatus, to: CampaignStatus): void {
  if (!canTransitionCampaign(from, to))
    throw new DomainError('INVALID_TRANSITION', `Cannot move campaign from ${from} to ${to}`);
}

export const subjectKinds = [
  'customer',
  'campaign',
  'recipient',
  'booking',
  'review',
  'workspace',
] as const;
export type SubjectKind = (typeof subjectKinds)[number];

const idPattern = /^[a-f0-9-]{8,64}$/i;

function brandedId<T extends string>(value: string, label: T): Brand<string, T> {
  if (!idPattern.test(value)) throw new Error(`Invalid ${label}`);
  return value as Brand<string, T>;
}

export const workspaceId = (value: string): WorkspaceId => brandedId(value, 'WorkspaceId');
export const userId = (value: string): UserId => brandedId(value, 'UserId');
export const customerId = (value: string): CustomerId => brandedId(value, 'CustomerId');
export const bookingId = (value: string): BookingId => brandedId(value, 'BookingId');
export const eventId = (value: string): EventId => brandedId(value, 'EventId');
export const commandId = (value: string): CommandId => brandedId(value, 'CommandId');
export const requestId = (value: string): RequestId => brandedId(value, 'RequestId');
export const sessionId = (value: string): SessionId => brandedId(value, 'SessionId');
export const consentRecordId = (value: string): ConsentRecordId =>
  brandedId(value, 'ConsentRecordId');
export const interactionId = (value: string): InteractionId => brandedId(value, 'InteractionId');
export const importBatchId = (value: string): ImportBatchId => brandedId(value, 'ImportBatchId');
export const campaignId = (value: string): CampaignId => brandedId(value, 'CampaignId');
export const campaignRecipientId = (value: string): CampaignRecipientId =>
  brandedId(value, 'CampaignRecipientId');

export function utcInstant(value: string): UtcInstant {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf()) || !value.endsWith('Z')) throw new Error('Invalid UTC instant');
  return date.toISOString() as UtcInstant;
}

export function timezone(value: string): IanaTimezone {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value }).format();
  } catch {
    throw new Error('Invalid IANA timezone');
  }
  return value as IanaTimezone;
}

export function currencyCode(value: string): CurrencyCode {
  if (!/^[A-Z]{3}$/.test(value)) throw new Error('Invalid currency code');
  return value as CurrencyCode;
}

export function minorUnits(value: number): MinorUnits {
  if (!Number.isSafeInteger(value)) throw new Error('Money must use safe integer minor units');
  return value as MinorUnits;
}

export type Money = Readonly<{ currency: CurrencyCode; minorUnits: MinorUnits }>;

export function money(value: { currency: string; minorUnits: number }): Money {
  return { currency: currencyCode(value.currency), minorUnits: minorUnits(value.minorUnits) };
}

export type Actor =
  | { kind: 'user'; userId: UserId }
  | { kind: 'system'; reason: 'retention' | 'account_deletion' };

export type CommandContext = Readonly<{
  workspaceId: WorkspaceId;
  actor: Actor;
  commandId: CommandId;
  requestId: RequestId;
  now: UtcInstant;
}>;

export type QueryContext = Readonly<{ workspaceId: WorkspaceId; actorUserId: UserId }>;

export type CustomerLifecycle =
  | { kind: 'enquiry' }
  | { kind: 'contacted'; at: UtcInstant }
  | { kind: 'replied'; at: UtcInstant }
  | { kind: 'booked'; bookingId: BookingId; at: UtcInstant }
  | { kind: 'completed'; at: UtcInstant }
  | { kind: 'lost'; at: UtcInstant; reason?: string };

export type ContactChannel = 'whatsapp' | 'sms' | 'email' | 'phone';
export type ConsentDecision = 'granted' | 'withdrawn';

export type BookingState =
  | { kind: 'tentative' }
  | { kind: 'confirmed'; at: UtcInstant }
  | { kind: 'completed'; at: UtcInstant }
  | { kind: 'cancelled'; at: UtcInstant; reason?: string }
  | { kind: 'no_show'; at: UtcInstant };

export const customerLifecycleKinds = [
  'enquiry',
  'contacted',
  'replied',
  'booked',
  'completed',
  'lost',
] as const;
export const bookingStateKinds = [
  'tentative',
  'confirmed',
  'completed',
  'cancelled',
  'no_show',
] as const;

export function customerLifecycleKind(value: string): CustomerLifecycle['kind'] {
  if ((customerLifecycleKinds as readonly string[]).includes(value))
    return value as CustomerLifecycle['kind'];
  throw new Error('Invalid customer lifecycle');
}

export function bookingStateKind(value: string): BookingState['kind'] {
  if ((bookingStateKinds as readonly string[]).includes(value))
    return value as BookingState['kind'];
  throw new Error('Invalid booking state');
}

export type TransitionError = Readonly<{ code: 'INVALID_TRANSITION'; from: string; to: string }>;

const customerTransitionTable: Record<
  CustomerLifecycle['kind'],
  readonly CustomerLifecycle['kind'][]
> = {
  enquiry: ['contacted', 'replied', 'booked', 'lost'],
  contacted: ['replied', 'booked', 'lost'],
  replied: ['booked', 'lost'],
  booked: ['completed', 'replied', 'lost'],
  completed: ['enquiry'],
  lost: ['enquiry'],
};

export function canTransitionCustomer(
  from: CustomerLifecycle['kind'],
  to: CustomerLifecycle['kind'],
): boolean {
  return customerTransitionTable[from].includes(to);
}

export function assertCustomerTransition(
  from: CustomerLifecycle['kind'],
  to: CustomerLifecycle['kind'],
): void {
  if (!canTransitionCustomer(from, to))
    throw new DomainError('INVALID_TRANSITION', `Cannot move customer from ${from} to ${to}`);
}

const bookingTransitionTable: Record<BookingState['kind'], readonly BookingState['kind'][]> = {
  tentative: ['confirmed', 'cancelled'],
  confirmed: ['completed', 'cancelled', 'no_show'],
  completed: [],
  cancelled: [],
  no_show: [],
};

export function canTransitionBooking(
  from: BookingState['kind'],
  to: BookingState['kind'],
): boolean {
  return bookingTransitionTable[from].includes(to);
}

export class DomainError extends Error {
  constructor(
    readonly code: 'INVALID_TRANSITION' | 'CURRENCY_MISMATCH' | 'UNAUTHORIZED_ACTION',
    message: string,
  ) {
    super(message);
    this.name = 'DomainError';
  }
}

export function addMoney(left: Money, right: Money): Money {
  if (left.currency !== right.currency)
    throw new DomainError('CURRENCY_MISMATCH', 'Money currencies differ');
  return { currency: left.currency, minorUnits: minorUnits(left.minorUnits + right.minorUnits) };
}

export type OperationalEventPayload =
  | { type: 'enquiry.created'; customerId: CustomerId; source: string; quotedMinorUnits?: number }
  | {
      type: 'consent.recorded';
      customerId: CustomerId;
      channel: ContactChannel;
      decision: ConsentDecision;
      consentRecordId: ConsentRecordId;
    }
  | {
      type: 'customer.updated';
      customerId: CustomerId;
      changedFields: readonly string[];
    }
  | {
      type: 'customer.lifecycle_changed';
      customerId: CustomerId;
      from: CustomerLifecycle['kind'];
      to: CustomerLifecycle['kind'];
    }
  | {
      type: 'interaction.recorded';
      customerId: CustomerId;
      interactionId: InteractionId;
      kind: 'enquiry' | 'call' | 'message' | 'note';
    }
  | {
      type: 'customer.imported';
      customerId: CustomerId;
      importBatchId: ImportBatchId;
    }
  | { type: 'campaign.created'; campaignId: CampaignId; version: number }
  | {
      type: 'campaign.updated';
      campaignId: CampaignId;
      version: number;
      changedFields: readonly string[];
    }
  | {
      type: 'campaign.status_changed';
      campaignId: CampaignId;
      from: CampaignStatus;
      to: CampaignStatus;
      version: number;
    }
  | { type: 'campaign.recipient_removed'; campaignId: CampaignId; recipientId: CampaignRecipientId }
  | {
      type: 'campaign.outcome_recorded';
      campaignId: CampaignId;
      recipientId: CampaignRecipientId;
      outcome: CampaignOutcome;
      bookingId?: BookingId;
    }
  | { type: 'campaign.message_prepared'; campaignId: CampaignId; recipientId: CampaignRecipientId }
  | { type: 'campaign.message_sent'; campaignId: CampaignId; recipientId: CampaignRecipientId }
  | { type: 'campaign.reply_recorded'; campaignId: CampaignId; recipientId: CampaignRecipientId }
  | {
      type: 'campaign.booking_attributed';
      campaignId: CampaignId;
      recipientId: CampaignRecipientId;
      bookingId: BookingId;
    }
  | {
      type: 'booking.recorded';
      bookingId: BookingId;
      customerId: CustomerId;
      agreedMinorUnits: number;
      currency: CurrencyCode;
    }
  | { type: 'account.registered'; userId: UserId; workspaceId: WorkspaceId }
  | { type: 'workspace.settings_changed'; changedFields: readonly string[] };

export type OperationalEvent = Readonly<{
  eventId: EventId;
  schemaVersion: 1;
  workspaceId: WorkspaceId;
  commandId: CommandId;
  ordinal: number;
  occurredAt: UtcInstant;
  actor: Actor;
  requestId: RequestId;
  subject: { kind: SubjectKind; id: string };
  payload: OperationalEventPayload;
}>;

export function operationalEvent(input: {
  eventId: string;
  workspaceId: string;
  commandId: string;
  ordinal: number;
  occurredAt: string;
  actor: Actor;
  requestId: string;
  subject: { kind: SubjectKind; id: string };
  payload: OperationalEventPayload;
}): OperationalEvent {
  if (!Number.isSafeInteger(input.ordinal) || input.ordinal < 0)
    throw new Error('Event ordinal must be a non-negative safe integer');
  return {
    eventId: eventId(input.eventId),
    schemaVersion: 1,
    workspaceId: workspaceId(input.workspaceId),
    commandId: commandId(input.commandId),
    ordinal: input.ordinal,
    occurredAt: utcInstant(input.occurredAt),
    actor: input.actor,
    requestId: requestId(input.requestId),
    subject: input.subject,
    payload: input.payload,
  };
}

export const operationalEventPayloadSchemas = {
  'enquiry.created': z.object({
    type: z.literal('enquiry.created'),
    customerId: z.string(),
    source: z.string(),
    quotedMinorUnits: z.number().int().optional(),
  }),
  'consent.recorded': z.object({
    type: z.literal('consent.recorded'),
    customerId: z.string(),
    channel: z.enum(['whatsapp', 'sms', 'email', 'phone']),
    decision: z.enum(['granted', 'withdrawn']),
    consentRecordId: z.string(),
  }),
  'customer.updated': z.object({
    type: z.literal('customer.updated'),
    customerId: z.string(),
    changedFields: z.array(z.string()),
  }),
  'customer.lifecycle_changed': z.object({
    type: z.literal('customer.lifecycle_changed'),
    customerId: z.string(),
    from: z.enum(customerLifecycleKinds),
    to: z.enum(customerLifecycleKinds),
  }),
  'interaction.recorded': z.object({
    type: z.literal('interaction.recorded'),
    customerId: z.string(),
    interactionId: z.string(),
    kind: z.enum(['enquiry', 'call', 'message', 'note']),
  }),
  'customer.imported': z.object({
    type: z.literal('customer.imported'),
    customerId: z.string(),
    importBatchId: z.string(),
  }),
  'campaign.created': z.object({
    type: z.literal('campaign.created'),
    campaignId: z.string(),
    version: z.number().int(),
  }),
  'campaign.updated': z.object({
    type: z.literal('campaign.updated'),
    campaignId: z.string(),
    version: z.number().int(),
    changedFields: z.array(z.string()),
  }),
  'campaign.status_changed': z.object({
    type: z.literal('campaign.status_changed'),
    campaignId: z.string(),
    from: z.enum(campaignStatuses),
    to: z.enum(campaignStatuses),
    version: z.number().int(),
  }),
  'campaign.recipient_removed': z.object({
    type: z.literal('campaign.recipient_removed'),
    campaignId: z.string(),
    recipientId: z.string(),
  }),
  'campaign.outcome_recorded': z.object({
    type: z.literal('campaign.outcome_recorded'),
    campaignId: z.string(),
    recipientId: z.string(),
    outcome: z.enum(campaignOutcomes),
    bookingId: z.string().optional(),
  }),
  'campaign.message_prepared': z.object({
    type: z.literal('campaign.message_prepared'),
    campaignId: z.string(),
    recipientId: z.string(),
  }),
  'campaign.message_sent': z.object({
    type: z.literal('campaign.message_sent'),
    campaignId: z.string(),
    recipientId: z.string(),
  }),
  'campaign.reply_recorded': z.object({
    type: z.literal('campaign.reply_recorded'),
    campaignId: z.string(),
    recipientId: z.string(),
  }),
  'campaign.booking_attributed': z.object({
    type: z.literal('campaign.booking_attributed'),
    campaignId: z.string(),
    recipientId: z.string(),
    bookingId: z.string(),
  }),
  'booking.recorded': z.object({
    type: z.literal('booking.recorded'),
    bookingId: z.string(),
    customerId: z.string(),
    agreedMinorUnits: z.number().int(),
    currency: z.string(),
  }),
  'account.registered': z.object({
    type: z.literal('account.registered'),
    userId: z.string(),
    workspaceId: z.string(),
  }),
  'workspace.settings_changed': z.object({
    type: z.literal('workspace.settings_changed'),
    changedFields: z.array(z.string()),
  }),
} as const;

export const operationalEventSchemaByType: ReadonlyMap<string, z.ZodType> = new Map(
  Object.entries(operationalEventPayloadSchemas),
);

export const eventRedactors: {
  [K in OperationalEventPayload['type']]: (
    payload: Extract<OperationalEventPayload, { type: K }>,
  ) => Record<string, unknown>;
} = {
  'enquiry.created': (payload) => ({ ...payload }),
  'consent.recorded': (payload) => ({ ...payload }),
  'customer.updated': (payload) => ({ ...payload }),
  'customer.lifecycle_changed': (payload) => ({ ...payload }),
  'interaction.recorded': (payload) => ({ ...payload }),
  'customer.imported': (payload) => ({ ...payload }),
  'campaign.created': (payload) => ({ ...payload }),
  'campaign.updated': (payload) => ({ ...payload }),
  'campaign.status_changed': (payload) => ({ ...payload }),
  'campaign.recipient_removed': (payload) => ({ ...payload }),
  'campaign.outcome_recorded': (payload) => ({ ...payload }),
  'campaign.message_prepared': (payload) => ({ ...payload }),
  'campaign.message_sent': (payload) => ({ ...payload }),
  'campaign.reply_recorded': (payload) => ({ ...payload }),
  'campaign.booking_attributed': (payload) => ({ ...payload }),
  'booking.recorded': (payload) => ({ ...payload }),
  'account.registered': (payload) => ({ ...payload }),
  'workspace.settings_changed': (payload) => ({ ...payload }),
};

export function redactEventPayload(payload: OperationalEventPayload): Record<string, unknown> {
  switch (payload.type) {
    case 'enquiry.created':
      return eventRedactors['enquiry.created'](payload);
    case 'consent.recorded':
      return eventRedactors['consent.recorded'](payload);
    case 'customer.updated':
      return eventRedactors['customer.updated'](payload);
    case 'customer.lifecycle_changed':
      return eventRedactors['customer.lifecycle_changed'](payload);
    case 'interaction.recorded':
      return eventRedactors['interaction.recorded'](payload);
    case 'customer.imported':
      return eventRedactors['customer.imported'](payload);
    case 'campaign.created':
      return eventRedactors['campaign.created'](payload);
    case 'campaign.updated':
      return eventRedactors['campaign.updated'](payload);
    case 'campaign.status_changed':
      return eventRedactors['campaign.status_changed'](payload);
    case 'campaign.recipient_removed':
      return eventRedactors['campaign.recipient_removed'](payload);
    case 'campaign.outcome_recorded':
      return eventRedactors['campaign.outcome_recorded'](payload);
    case 'campaign.message_prepared':
      return eventRedactors['campaign.message_prepared'](payload);
    case 'campaign.message_sent':
      return eventRedactors['campaign.message_sent'](payload);
    case 'campaign.reply_recorded':
      return eventRedactors['campaign.reply_recorded'](payload);
    case 'campaign.booking_attributed':
      return eventRedactors['campaign.booking_attributed'](payload);
    case 'booking.recorded':
      return eventRedactors['booking.recorded'](payload);
    case 'account.registered':
      return eventRedactors['account.registered'](payload);
    case 'workspace.settings_changed':
      return eventRedactors['workspace.settings_changed'](payload);
    default: {
      const exhaustive: never = payload;
      return exhaustive;
    }
  }
}
