import type { Router } from 'express';
import type { AppConfig } from '../config.js';
import { AppError } from '../errors.js';
import { requireSession } from '../auth.js';
import { queryContext } from '../context.js';
import { Booking, OperationalEvent, Workspace } from '../models.js';
import { resultsBounds } from '../timezone.js';

export function registerResultsRoutes(router: Router, config: AppConfig): void {
  router.get('/results', requireSession(config), async (req, res, next) => {
    try {
      const query = queryContext(req);
      const workspace = await Workspace.findById(query.workspaceId);
      if (!workspace) throw new AppError('RESOURCE_NOT_FOUND', 'Workspace not found.', 404);
      const bounds = resultsBounds(
        {
          from: typeof req.query.from === 'string' ? req.query.from : undefined,
          to: typeof req.query.to === 'string' ? req.query.to : undefined,
        },
        workspace.timezone,
      );
      const eventFilter = {
        workspaceId: query.workspaceId,
        occurredAt: { $gte: bounds.from, $lt: bounds.to },
      };
      const [newEnquiries, bookings] = await Promise.all([
        OperationalEvent.countDocuments({ ...eventFilter, type: 'enquiry.created' }),
        Booking.find({
          workspaceId: query.workspaceId,
          createdAt: { $gte: bounds.from, $lt: bounds.to },
          state: { $in: ['tentative', 'confirmed', 'completed', 'no_show'] },
        }).lean(),
      ]);
      res.json({
        range: {
          from: bounds.from.toISOString(),
          to: bounds.to.toISOString(),
          fromLocal: bounds.fromLocal,
          toLocal: bounds.toLocal,
          timezone: workspace.timezone,
        },
        newEnquiries,
        bookingsRecorded: bookings.length,
        bookingDefinition:
          'Bookings created in this workspace-local range; includes tentative, confirmed, completed, and no-show records.',
        recordedValueDefinition:
          'Sum of agreed booking value for those records, not collected revenue.',
        recordedBookingValue: {
          currency: workspace.currency,
          minorUnits: bookings.reduce((sum, item) => sum + item.agreedMinorUnits, 0),
        },
      });
    } catch (error: unknown) {
      next(error);
    }
  });
}
