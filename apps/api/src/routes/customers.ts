import type { Router } from 'express';
import mongoose from 'mongoose';
import {
  CreateCustomerRequestSchema,
  customerId as customerIdValue,
  consentRecordId as consentRecordIdValue,
} from '@growthos/contracts';
import type { AppConfig } from '../config.js';
import { AppError } from '../errors.js';
import { requireSession } from '../auth.js';
import { commandActorUserId, commandContext, queryContext } from '../context.js';
import { newId, normalizeEmail, normalizePhone } from '../ids.js';
import { Consent, Customer, Workspace } from '../models.js';
import { appendEvent, customerView, latestConsents } from './shared.js';

export function registerCustomerRoutes(router: Router, config: AppConfig): void {
  router.get('/customers', requireSession(config), async (req, res, next) => {
    try {
      const query = queryContext(req);
      const workspace = await Workspace.findById(query.workspaceId);
      if (!workspace) throw new AppError('RESOURCE_NOT_FOUND', 'Workspace not found.', 404);
      const pageSize = Math.min(Number(req.query.limit ?? 50) || 50, 100);
      const customers = await Customer.find({ workspaceId: query.workspaceId })
        .sort({ lastInteractionAt: -1, _id: -1 })
        .limit(pageSize)
        .lean();
      const consents = await latestConsents(
        query.workspaceId,
        customers.map((customer) => String(customer._id)),
      );
      res.json({
        items: customers.map((customer) =>
          customerView(customer, consents.get(String(customer._id)), workspace.currency),
        ),
        nextCursor: null,
      });
    } catch (error: unknown) {
      next(error);
    }
  });

  router.get('/customers/:customerId', requireSession(config), async (req, res, next) => {
    try {
      const query = queryContext(req);
      const customer = await Customer.findOne({
        _id: req.params.customerId,
        workspaceId: query.workspaceId,
      }).lean();
      if (!customer) throw new AppError('RESOURCE_NOT_FOUND', 'Customer not found.', 404);
      const workspace = await Workspace.findById(query.workspaceId).lean();
      if (!workspace) throw new AppError('RESOURCE_NOT_FOUND', 'Workspace not found.', 404);
      const consents = await latestConsents(query.workspaceId, [String(customer._id)]);
      res.json(customerView(customer, consents.get(String(customer._id)), workspace.currency));
    } catch (error: unknown) {
      next(error);
    }
  });

  router.post('/customers', requireSession(config), async (req, res, next) => {
    try {
      const input = CreateCustomerRequestSchema.parse(req.body);
      const context = commandContext(req);
      const actorUserId = commandActorUserId(context);
      const workspace = await Workspace.findById(context.workspaceId);
      if (!workspace) throw new AppError('RESOURCE_NOT_FOUND', 'Workspace not found.', 404);
      const normalizedPhone = normalizePhone(input.phone);
      const normalizedEmail = input.email ? normalizeEmail(input.email) : null;
      const duplicate = await Customer.findOne({
        workspaceId: context.workspaceId,
        $or: [{ normalizedPhone }, ...(normalizedEmail ? [{ normalizedEmail }] : [])],
      }).lean();
      if (duplicate)
        throw new AppError(
          'DUPLICATE_CUSTOMER',
          'A possible duplicate exists. Review it before creating another customer.',
          409,
        );
      const customerId = newId();
      const consentId = newId();
      const commandId = String(context.commandId);
      const session = await mongoose.startSession();
      let created: Awaited<ReturnType<typeof Customer.create>>[number] | undefined;
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
          await appendEvent(
            {
              workspaceId: context.workspaceId,
              userId: actorUserId,
              requestId: String(context.requestId),
              commandId,
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
              commandId,
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
          if (!created) throw new Error('Customer was not created');
        });
      } finally {
        await session.endSession();
      }
      if (!created) throw new Error('Customer creation returned no document');
      res.status(201).json(
        customerView(created, {
          channel: input.consentChannel,
          decision: input.consentDecision,
        }),
      );
    } catch (error: unknown) {
      next(error);
    }
  });
}
