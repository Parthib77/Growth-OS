import type { Router } from 'express';
import { ResultsQuerySchema } from '@growthos/contracts';
import type { AppConfig } from '../config.js';
import { requireSession } from '../auth.js';
import { queryContext } from '../context.js';
import { readResults, resultsCsv } from '../results/service.js';

export function registerResultsRoutes(router: Router, config: AppConfig): void {
  router.get('/results', requireSession(config), async (req, res, next) => {
    try {
      const input = ResultsQuerySchema.parse(req.query);
      const query = queryContext(req);
      res.json(await readResults({ workspaceId: String(query.workspaceId), ...input }));
    } catch (error: unknown) {
      next(error);
    }
  });

  router.get('/results.csv', requireSession(config), async (req, res, next) => {
    try {
      const input = ResultsQuerySchema.parse(req.query);
      const query = queryContext(req);
      const result = await readResults({ workspaceId: String(query.workspaceId), ...input });
      res
        .type('text/csv')
        .setHeader('content-disposition', 'attachment; filename="results.csv"')
        .send(resultsCsv(result));
    } catch (error: unknown) {
      next(error);
    }
  });
}
