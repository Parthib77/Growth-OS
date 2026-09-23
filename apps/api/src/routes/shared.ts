import { createHash } from 'node:crypto';
import type { ClientSession } from 'mongoose';
import {
  operationalEvent,
  userId,
  type OperationalEventPayload,
  type SubjectKind,
} from '@growthos/contracts';
import {
  Consent,
  Interaction,
  OperationalEvent,
  type BookingDoc,
  type ConsentDoc,
  type CustomerDoc,
} from '../models.js';
import { newId } from '../ids.js';

export function fingerprint(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

export function dateValue(value: Date | string | undefined): string {
  return new Date(value ?? Date.now()).toISOString();
}

type CustomerProjection = Pick<
  CustomerDoc,
  | '_id'
  | 'firstName'
  | 'lastName'
  | 'phone'
  | 'email'
  | 'source'
  | 'service'
  | 'quotedMinorUnits'
  | 'lifecycle'
  | 'lastInteractionAt'
  | 'serviceInterests'
  | 'internalNotes'
>;
export type ConsentProjection = Pick<ConsentDoc, 'channel' | 'decision'> & {
  _id?: string;
  capturedAt?: Date;
};

export function customerView(
  customer: CustomerProjection,
  consent: ConsentProjection | undefined,
  currency = 'USD',
) {
  return {
    id: String(customer._id),
    firstName: customer.firstName,
    lastName: customer.lastName,
    phone: customer.phone,
    email: customer.email || null,
    source: customer.source,
    service: customer.service,
    quotedMoney:
      customer.quotedMinorUnits == null
        ? null
        : { currency, minorUnits: customer.quotedMinorUnits },
    consent: consent ? { channel: consent.channel, decision: consent.decision } : null,
    lifecycle: customer.lifecycle,
    lastInteractionAt: dateValue(customer.lastInteractionAt),
    serviceInterests: customer.serviceInterests ?? [],
    internalNotes: customer.internalNotes ?? '',
    contactEligible: consent?.decision === 'granted',
  };
}

export async function latestConsents(workspaceId: string, customerIds: string[]) {
  const rows = await Consent.find({ workspaceId, customerId: { $in: customerIds } })
    .sort({ capturedAt: -1, _id: -1 })
    .lean();
  const map = new Map<string, ConsentProjection>();
  for (const row of rows) if (!map.has(row.customerId)) map.set(row.customerId, row);
  return map;
}

export async function consentHistory(workspaceId: string, customerId: string) {
  return Consent.find({ workspaceId, customerId }).sort({ capturedAt: -1, _id: -1 }).lean();
}

export async function interactionHistory(workspaceId: string, customerId: string) {
  return Interaction.find({ workspaceId, customerId }).sort({ occurredAt: -1, _id: -1 }).lean();
}

export function bookingView(
  booking: Pick<
    BookingDoc,
    '_id' | 'customerId' | 'service' | 'appointmentAt' | 'currency' | 'agreedMinorUnits' | 'state'
  >,
) {
  return {
    id: String(booking._id),
    customerId: booking.customerId,
    service: booking.service,
    appointmentAt: dateValue(booking.appointmentAt),
    agreedMoney: { currency: booking.currency, minorUnits: booking.agreedMinorUnits },
    state: booking.state,
  };
}

export function appendEvent(
  input: {
    workspaceId: string;
    userId: string;
    requestId: string;
    commandId: string;
    subjectKind: SubjectKind;
    subjectId: string;
    ordinal: number;
    occurredAt?: Date | string;
    payload: OperationalEventPayload;
  },
  session?: ClientSession,
) {
  const actorUserId = userId(input.userId);
  const event = operationalEvent({
    eventId: newId(),
    workspaceId: input.workspaceId,
    commandId: input.commandId,
    ordinal: input.ordinal,
    occurredAt: new Date(input.occurredAt ?? Date.now()).toISOString(),
    actor: { kind: 'user', userId: actorUserId },
    requestId: input.requestId,
    subject: { kind: input.subjectKind, id: input.subjectId },
    payload: input.payload,
  });
  return OperationalEvent.create(
    [
      {
        _id: String(event.eventId),
        eventId: String(event.eventId),
        schemaVersion: event.schemaVersion,
        workspaceId: String(event.workspaceId),
        actorUserId: String(actorUserId),
        actorKind: event.actor.kind,
        requestId: String(event.requestId),
        commandId: String(event.commandId),
        ordinal: event.ordinal,
        occurredAt: new Date(event.occurredAt),
        subjectKind: event.subject.kind,
        subjectId: event.subject.id,
        type: event.payload.type,
        payload: event.payload,
      },
    ],
    { session },
  );
}
