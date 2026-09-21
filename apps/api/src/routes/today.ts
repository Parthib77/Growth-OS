import type { Router } from 'express';
import type { AppConfig } from '../config.js';
import { AppError } from '../errors.js';
import { requireSession } from '../auth.js';
import { queryContext } from '../context.js';
import { Customer, Workspace } from '../models.js';
import { customerView, latestConsents } from './shared.js';

export function registerTodayRoutes(router: Router, config: AppConfig): void {
  router.get('/today', requireSession(config), async (req, res, next) => {
    try {
      const query = queryContext(req);
      const workspace = await Workspace.findById(query.workspaceId);
      if (!workspace) throw new AppError('RESOURCE_NOT_FOUND', 'Workspace not found.', 404);
      const customers = await Customer.find({
        workspaceId: query.workspaceId,
        lifecycle: { $in: ['enquiry', 'contacted', 'replied'] },
      })
        .sort({ lastInteractionAt: 1 })
        .limit(100)
        .lean();
      const consents = await latestConsents(
        query.workspaceId,
        customers.map((customer) => String(customer._id)),
      );
      const now = Date.now();
      const items = customers.map((customer) => {
        const consent = consents.get(String(customer._id));
        const overdue =
          now - new Date(customer.lastInteractionAt).getTime() > workspace.followUpDays * 86400000;
        const reasons = [
          overdue ? 'Follow-up overdue' : 'New enquiry',
          consent?.decision === 'granted' ? 'Consent recorded' : 'Contact permission needs review',
        ];
        return {
          ...customerView(customer, consent, workspace.currency),
          reasons,
          nextAction:
            consent?.decision === 'granted'
              ? 'Prepare a personal follow-up'
              : 'Review contact permission',
        };
      });
      res.json({ items, generatedAt: new Date().toISOString() });
    } catch (error: unknown) {
      next(error);
    }
  });
}
