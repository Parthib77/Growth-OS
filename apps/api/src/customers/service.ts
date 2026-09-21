import mongoose from 'mongoose';
import {
  customerId as customerIdValue,
  customerLifecycleKind,
  consentRecordId as consentRecordIdValue,
  interactionId as interactionIdValue,
  type CommandContext,
  type CreateCustomerRequest,
  type CreateInteractionRequest,
  RecordConsentRequestSchema,
  type UpdateCustomerRequest,
} from '@growthos/contracts';
import type { z } from 'zod';
import { AppError } from '../errors.js';
import { commandActorUserId } from '../context.js';
import { newId, normalizeEmail, normalizePhone } from '../ids.js';
import { Consent, Customer, Interaction, Workspace, type CustomerDoc } from '../models.js';
import { appendEvent } from '../routes/shared.js';
import { assertLifecycleTransition } from './domain.js';

type ConsentInput = z.infer<typeof RecordConsentRequestSchema>;

export async function createCustomer(
  context: CommandContext,
  input: CreateCustomerRequest,
): Promise<{ customer: CustomerDoc; consent: { channel: string; decision: string } }> {
  const workspace = await Workspace.findById(context.workspaceId);
  if (!workspace) throw new AppError('RESOURCE_NOT_FOUND', 'Workspace not found.', 404);
  const normalizedPhone = normalizePhone(input.phone);
  const normalizedEmail = input.email ? normalizeEmail(input.email) : null;
  const duplicates = await Customer.find({
    workspaceId: context.workspaceId,
    $or: [{ normalizedPhone }, ...(normalizedEmail ? [{ normalizedEmail }] : [])],
  }).lean();
  if (duplicates.length > 0 && !input.confirmDuplicate)
    throw new AppError(
      'DUPLICATE_CUSTOMER',
      'A possible duplicate exists. Review it before creating another customer.',
      409,
      undefined,
      {
        candidates: duplicates.map((duplicate) => ({
          id: String(duplicate._id),
          firstName: duplicate.firstName,
          lastName: duplicate.lastName,
          phone: duplicate.phone,
          email: duplicate.email,
        })),
      },
    );
  const customerId = newId();
  const consentId = newId();
  const session = await mongoose.startSession();
  let created: CustomerDoc | undefined;
  try {
    await session.withTransaction(async () => {
      [created] = await Customer.create(
        [
          {
            _id: customerId,
            workspaceId: context.workspaceId,
            firstName: input.firstName,
            lastName: input.lastName,
            phone: input.phone,
            normalizedPhone,
            email: input.email || null,
            normalizedEmail,
            source: input.source,
            service: input.service,
            quotedMinorUnits: input.quotedMinorUnits,
            lifecycle: 'enquiry',
            lastInteractionAt: new Date(),
            serviceInterests: input.serviceInterests,
            internalNotes: input.internalNotes,
          },
        ],
        { session },
      );
      await Consent.create(
        [
          {
            _id: consentId,
            workspaceId: context.workspaceId,
            customerId,
            channel: input.consentChannel,
            decision: input.consentDecision,
            capturedAt: new Date(),
          },
        ],
        { session },
      );
      const actorUserId = commandActorUserId(context);
      await appendEvent(
        {
          workspaceId: context.workspaceId,
          userId: actorUserId,
          requestId: String(context.requestId),
          commandId: String(context.commandId),
          subjectKind: 'customer',
          subjectId: customerId,
          ordinal: 0,
          payload: {
            type: 'enquiry.created',
            customerId: customerIdValue(customerId),
            source: input.source,
            quotedMinorUnits: input.quotedMinorUnits,
          },
        },
        session,
      );
      await appendEvent(
        {
          workspaceId: context.workspaceId,
          userId: actorUserId,
          requestId: String(context.requestId),
          commandId: String(context.commandId),
          subjectKind: 'customer',
          subjectId: customerId,
          ordinal: 1,
          payload: {
            type: 'consent.recorded',
            customerId: customerIdValue(customerId),
            channel: input.consentChannel,
            decision: input.consentDecision,
            consentRecordId: consentRecordIdValue(consentId),
          },
        },
        session,
      );
    });
  } finally {
    await session.endSession();
  }
  if (!created) throw new Error('Customer creation returned no document');
  return {
    customer: created,
    consent: { channel: input.consentChannel, decision: input.consentDecision },
  };
}

export async function updateCustomer(
  context: CommandContext,
  customerId: string,
  input: UpdateCustomerRequest,
): Promise<CustomerDoc> {
  const customer = await Customer.findOne({ _id: customerId, workspaceId: context.workspaceId });
  if (!customer) throw new AppError('RESOURCE_NOT_FOUND', 'Customer not found.', 404);
  const previousLifecycle = customer.lifecycle;
  if (input.lifecycle && input.lifecycle !== previousLifecycle) {
    try {
      assertLifecycleTransition(previousLifecycle, input.lifecycle);
    } catch {
      throw new AppError(
        'INVALID_TRANSITION',
        `Cannot move customer from ${previousLifecycle} to ${input.lifecycle}.`,
        409,
      );
    }
  }
  const update: Record<string, unknown> = { ...input };
  if ('phone' in input) update.normalizedPhone = normalizePhone(input.phone ?? '');
  if ('email' in input) {
    update.normalizedEmail = input.email ? normalizeEmail(input.email) : null;
    update.email = input.email || null;
  }
  const duplicate =
    'phone' in input || 'email' in input
      ? await Customer.findOne({
          workspaceId: context.workspaceId,
          _id: { $ne: customer._id },
          $or: [
            ...(update.normalizedPhone ? [{ normalizedPhone: update.normalizedPhone }] : []),
            ...(update.normalizedEmail ? [{ normalizedEmail: update.normalizedEmail }] : []),
          ],
        }).lean()
      : null;
  if (duplicate)
    throw new AppError(
      'DUPLICATE_CUSTOMER',
      'A possible duplicate exists. Review it before saving.',
      409,
      undefined,
      { candidateId: String(duplicate._id) },
    );
  const changedFields = Object.keys(input);
  Object.assign(customer, update);
  customer.lastInteractionAt = new Date();
  await customer.save();
  const actorUserId = commandActorUserId(context);
  await appendEvent({
    workspaceId: context.workspaceId,
    userId: actorUserId,
    requestId: String(context.requestId),
    commandId: String(context.commandId),
    subjectKind: 'customer',
    subjectId: customerId,
    ordinal: 0,
    payload: { type: 'customer.updated', customerId: customerIdValue(customerId), changedFields },
  });
  if (input.lifecycle && input.lifecycle !== previousLifecycle)
    await appendEvent({
      workspaceId: context.workspaceId,
      userId: actorUserId,
      requestId: String(context.requestId),
      commandId: String(context.commandId),
      subjectKind: 'customer',
      subjectId: customerId,
      ordinal: 1,
      payload: {
        type: 'customer.lifecycle_changed',
        customerId: customerIdValue(customerId),
        from: customerLifecycleKind(previousLifecycle),
        to: input.lifecycle,
      },
    });
  return customer;
}

export async function recordInteraction(
  context: CommandContext,
  customerId: string,
  input: CreateInteractionRequest,
) {
  const customer = await Customer.findOne({ _id: customerId, workspaceId: context.workspaceId });
  if (!customer) throw new AppError('RESOURCE_NOT_FOUND', 'Customer not found.', 404);
  const id = newId();
  const occurredAt = input.occurredAt ? new Date(input.occurredAt) : new Date();
  await Interaction.create({
    _id: id,
    workspaceId: context.workspaceId,
    customerId,
    actorUserId: commandActorUserId(context),
    kind: input.kind,
    body: input.body,
    serviceInterest: input.serviceInterest || null,
    occurredAt,
  });
  customer.lastInteractionAt = new Date();
  await customer.save();
  await appendEvent({
    workspaceId: context.workspaceId,
    userId: commandActorUserId(context),
    requestId: String(context.requestId),
    commandId: String(context.commandId),
    subjectKind: 'customer',
    subjectId: customerId,
    ordinal: 0,
    payload: {
      type: 'interaction.recorded',
      customerId: customerIdValue(customerId),
      interactionId: interactionIdValue(id),
      kind: input.kind,
    },
  });
  return {
    id,
    kind: input.kind,
    body: input.body,
    serviceInterest: input.serviceInterest || null,
    occurredAt: occurredAt.toISOString(),
  };
}

export async function recordConsent(
  context: CommandContext,
  customerId: string,
  input: ConsentInput,
) {
  const customer = await Customer.findOne({ _id: customerId, workspaceId: context.workspaceId });
  if (!customer) throw new AppError('RESOURCE_NOT_FOUND', 'Customer not found.', 404);
  const id = newId();
  const capturedAt = new Date();
  await Consent.create({
    _id: id,
    workspaceId: context.workspaceId,
    customerId,
    channel: input.channel,
    decision: input.decision,
    capturedAt,
  });
  await appendEvent({
    workspaceId: context.workspaceId,
    userId: commandActorUserId(context),
    requestId: String(context.requestId),
    commandId: String(context.commandId),
    subjectKind: 'customer',
    subjectId: customerId,
    ordinal: 0,
    payload: {
      type: 'consent.recorded',
      customerId: customerIdValue(customerId),
      channel: input.channel,
      decision: input.decision,
      consentRecordId: consentRecordIdValue(id),
    },
  });
  return {
    id,
    channel: input.channel,
    decision: input.decision,
    capturedAt: capturedAt.toISOString(),
  };
}
