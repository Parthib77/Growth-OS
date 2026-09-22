import type { Router } from 'express';
import {
  CreateReviewRequestSchema,
  ReviewImportCommitRequestSchema,
  ReviewImportPreviewRequestSchema,
  ReviewListQuerySchema,
} from '@growthos/contracts';
import type { AppConfig } from '../config.js';
import { requireSession } from '../auth.js';
import { commandContext, queryContext } from '../context.js';
import {
  changeReviewResponseFor,
  commitReviewImport,
  createReview,
  listReviews,
  previewReviewImport,
} from '../reviews/service.js';

export function registerReviewRoutes(router: Router, config: AppConfig): void {
  router.get('/reviews', requireSession(config), async (req, res, next) => {
    try {
      const query = ReviewListQuerySchema.parse(req.query);
      const context = queryContext(req);
      res.json(await listReviews({ workspaceId: String(context.workspaceId), ...query }));
    } catch (error: unknown) {
      next(error);
    }
  });

  router.post('/reviews', requireSession(config), async (req, res, next) => {
    try {
      CreateReviewRequestSchema.parse(req.body);
      const command = commandContext(req);
      res
        .status(201)
        .json(
          await createReview({ workspaceId: String(command.workspaceId), command, body: req.body }),
        );
    } catch (error: unknown) {
      next(error);
    }
  });

  router.patch('/reviews/:reviewId/response', requireSession(config), async (req, res, next) => {
    try {
      const command = commandContext(req);
      res.json(
        await changeReviewResponseFor(
          String(command.workspaceId),
          String(req.params.reviewId),
          command,
          req.body,
        ),
      );
    } catch (error: unknown) {
      next(error);
    }
  });

  router.post('/review-imports/preview', requireSession(config), async (req, res, next) => {
    try {
      const input = ReviewImportPreviewRequestSchema.parse(req.body);
      const context = queryContext(req);
      res.json(
        await previewReviewImport(
          String(context.workspaceId),
          String(context.actorUserId),
          input.csv,
        ),
      );
    } catch (error: unknown) {
      next(error);
    }
  });

  router.post(
    '/review-imports/:importId/commit',
    requireSession(config),
    async (req, res, next) => {
      try {
        ReviewImportCommitRequestSchema.parse(req.body);
        const command = commandContext(req);
        res.json(
          await commitReviewImport(
            String(command.workspaceId),
            String(req.params.importId),
            command,
            req.body,
          ),
        );
      } catch (error: unknown) {
        next(error);
      }
    },
  );
}
