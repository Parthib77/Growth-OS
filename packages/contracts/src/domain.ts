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
export type CampaignId = Brand<string, 'CampaignId'>;
export type CampaignRecipientId = Brand<string, 'CampaignRecipientId'>;
export type Version = Brand<number, 'Version'>;
export type UtcInstant = Brand<string, 'UtcInstant'>;
export type IanaTimezone = Brand<string, 'IanaTimezone'>;
export type CurrencyCode = Brand<string, 'CurrencyCode'>;
export type MinorUnits = Brand<number, 'MinorUnits'>;
export type IdempotencyKey = Brand<string, 'IdempotencyKey'>;

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
      type: 'booking.recorded';
      bookingId: BookingId;
      customerId: CustomerId;
      agreedMinorUnits: number;
      currency: CurrencyCode;
    };

export type OperationalEvent = Readonly<{
  eventId: EventId;
  schemaVersion: 1;
  workspaceId: WorkspaceId;
  commandId: CommandId;
  ordinal: number;
  occurredAt: UtcInstant;
  actor: Actor;
  requestId: RequestId;
  subject: { kind: 'customer' | 'booking' | 'workspace'; id: string };
  payload: OperationalEventPayload;
}>;

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
  'booking.recorded': z.object({
    type: z.literal('booking.recorded'),
    bookingId: z.string(),
    customerId: z.string(),
    agreedMinorUnits: z.number().int(),
    currency: z.string(),
  }),
} as const;

export function redactEventPayload(payload: OperationalEventPayload): Record<string, unknown> {
  switch (payload.type) {
    case 'enquiry.created':
      return {
        type: payload.type,
        customerId: payload.customerId,
        source: payload.source,
        quotedMinorUnits: payload.quotedMinorUnits,
      };
    case 'consent.recorded':
      return {
        type: payload.type,
        customerId: payload.customerId,
        channel: payload.channel,
        decision: payload.decision,
        consentRecordId: payload.consentRecordId,
      };
    case 'booking.recorded':
      return {
        type: payload.type,
        bookingId: payload.bookingId,
        customerId: payload.customerId,
        agreedMinorUnits: payload.agreedMinorUnits,
        currency: payload.currency,
      };
    default: {
      const exhaustive: never = payload;
      return exhaustive;
    }
  }
}
