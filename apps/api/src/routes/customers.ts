import type { Router } from 'express';
import {
  CreateCustomerRequestSchema,
  CreateInteractionRequestSchema,
  RecordConsentRequestSchema,
  UpdateCustomerRequestSchema,
} from '@growthos/contracts';
import type { AppConfig } from '../config.js';
import { AppError } from '../errors.js';
import { requireSession } from '../auth.js';
import { commandContext, queryContext } from '../context.js';
import { Customer, Workspace } from '../models.js';
import { consentHistory, customerView, interactionHistory, latestConsents } from './shared.js';
import {
  createCustomer,
  recordConsent,
  recordInteraction,
  updateCustomer,
} from '../customers/service.js';

function customerParam(value: string | string[]): string {
  if (typeof value === 'string' && value.length > 0) return value;
  throw new AppError('RESOURCE_NOT_FOUND', 'Customer not found.', 404);
}

export function registerCustomerRoutes(router: Router, config: AppConfig): void {
  router.get('/customers', requireSession(config), async (req, res, next) => {
    try {
      const query = queryContext(req);
      const workspace = await Workspace.findById(query.workspaceId);
      if (!workspace) throw new AppError('RESOURCE_NOT_FOUND', 'Workspace not found.', 404);
      const limit = Math.min(Math.max(Number(req.query.limit ?? 50) || 50, 1), 100);
      const offset = Math.max(Number(req.query.cursor ?? 0) || 0, 0);
      const search = typeof req.query.q === 'string' ? req.query.q.trim() : '';
      const lifecycle = typeof req.query.lifecycle === 'string' ? req.query.lifecycle : undefined;
      const filter: Record<string, unknown> = { workspaceId: query.workspaceId };
      if (lifecycle) filter.lifecycle = lifecycle;
      if (search) {
        const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        filter.$or = ['firstName', 'lastName', 'phone', 'email'].map((field) => ({
          [field]: { $regex: escaped, $options: 'i' },
        }));
      }
      const customers = await Customer.find(filter)
        .sort({ lastInteractionAt: -1, _id: -1 })
        .skip(offset)
        .limit(limit + 1)
        .lean();
      const hasMore = customers.length > limit;
      if (hasMore) customers.pop();
      const consents = await latestConsents(
        query.workspaceId,
        customers.map((customer) => String(customer._id)),
      );
      res.json({
        items: customers.map((customer) =>
          customerView(customer, consents.get(String(customer._id)), workspace.currency),
        ),
        nextCursor: hasMore ? String(offset + limit) : null,
      });
    } catch (error: unknown) {
      next(error);
    }
  });

  router.get('/customers/:customerId', requireSession(config), async (req, res, next) => {
    try {
      const query = queryContext(req);
      const customer = await Customer.findOne({
        _id: customerParam(req.params.customerId),
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

  router.get('/customers/:customerId/detail', requireSession(config), async (req, res, next) => {
    try {
      const query = queryContext(req);
      const customer = await Customer.findOne({
        _id: customerParam(req.params.customerId),
        workspaceId: query.workspaceId,
      }).lean();
      if (!customer) throw new AppError('RESOURCE_NOT_FOUND', 'Customer not found.', 404);
      const workspace = await Workspace.findById(query.workspaceId).lean();
      if (!workspace) throw new AppError('RESOURCE_NOT_FOUND', 'Workspace not found.', 404);
      const [consents, interactions, latest] = await Promise.all([
        consentHistory(query.workspaceId, String(customer._id)),
        interactionHistory(query.workspaceId, String(customer._id)),
        latestConsents(query.workspaceId, [String(customer._id)]),
      ]);
      res.json({
        ...customerView(customer, latest.get(String(customer._id)), workspace.currency),
        interactions: interactions.map((interaction) => ({
          id: String(interaction._id),
          kind: interaction.kind,
          body: interaction.body,
          serviceInterest: interaction.serviceInterest ?? null,
          occurredAt: new Date(interaction.occurredAt).toISOString(),
        })),
        consentHistory: consents.map((consent) => ({
          id: String(consent._id),
          channel: consent.channel,
          decision: consent.decision,
          capturedAt: new Date(consent.capturedAt).toISOString(),
        })),
      });
    } catch (error: unknown) {
      next(error);
    }
  });

  router.post('/customers', requireSession(config), async (req, res, next) => {
    try {
      const input = CreateCustomerRequestSchema.parse(req.body);
      const context = commandContext(req);
      const result = await createCustomer(context, input);
      const workspace = await Workspace.findById(context.workspaceId).lean();
      if (!workspace) throw new AppError('RESOURCE_NOT_FOUND', 'Workspace not found.', 404);
      res.status(201).json(customerView(result.customer, result.consent, workspace.currency));
    } catch (error: unknown) {
      next(error);
    }
  });

  router.patch('/customers/:customerId', requireSession(config), async (req, res, next) => {
    try {
      const input = UpdateCustomerRequestSchema.parse(req.body);
      const context = commandContext(req);
      const customer = await updateCustomer(context, customerParam(req.params.customerId), input);
      const workspace = await Workspace.findById(context.workspaceId).lean();
      if (!workspace) throw new AppError('RESOURCE_NOT_FOUND', 'Workspace not found.', 404);
      const latest = await latestConsents(context.workspaceId, [String(customer._id)]);
      res.json(customerView(customer, latest.get(String(customer._id)), workspace.currency));
    } catch (error: unknown) {
      next(error);
    }
  });

  router.post(
    '/customers/:customerId/interactions',
    requireSession(config),
    async (req, res, next) => {
      try {
        const input = CreateInteractionRequestSchema.parse(req.body);
        res
          .status(201)
          .json(
            await recordInteraction(
              commandContext(req),
              customerParam(req.params.customerId),
              input,
            ),
          );
      } catch (error: unknown) {
        next(error);
      }
    },
  );

  router.post('/customers/:customerId/consents', requireSession(config), async (req, res, next) => {
    try {
      const input = RecordConsentRequestSchema.parse(req.body);
      res
        .status(201)
        .json(
          await recordConsent(commandContext(req), customerParam(req.params.customerId), input),
        );
    } catch (error: unknown) {
      next(error);
    }
  });
}
