import type { Router } from 'express';
import mongoose from 'mongoose';
import { verifyIndexes, supportsTransactions } from '../models.js';

export function registerHealthRoutes(router: Router): void {
  router.get('/health/live', (_req, res) => res.json({ status: 'ok' }));
  router.get('/health/ready', async (_req, res) => {
    try {
      if (mongoose.connection.readyState !== 1) throw new Error('database not connected');
      await verifyIndexes();
      if (!(await supportsTransactions())) throw new Error('replica set transactions unavailable');
      res.json({ status: 'ready' });
    } catch {
      res.status(503).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Database is not ready.',
          requestId: String(res.getHeader('x-request-id')),
        },
      });
    }
  });
}
