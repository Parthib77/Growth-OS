import mongoose from 'mongoose';
import { z } from 'zod';
import {
  changeReviewResponse,
  CreateReviewRequestSchema,
  DomainError,
  ReviewImportCommitRequestSchema,
  ReviewImportCommitResponseSchema,
  ReviewResponseActionSchema,
  reviewImportBatchId,
  reviewId,
  reviewRating,
  utcInstant,
  type ReviewResponseContractState,
  type ReviewResponseState,
} from '@growthos/contracts';
import { AppError } from '../errors.js';
import { newId } from '../ids.js';
import { Review, ReviewImportBatch } from '../models.js';
import { commandActorUserId, commandContext } from '../context.js';
import { appendEvent, dateValue } from '../routes/shared.js';
import { parseReviewCsv, reviewRows, REVIEW_IMPORT_LIMITS } from './domain.js';

type Command = ReturnType<typeof commandContext>;
const ReviewImportRowsSchema = z.array(
  z.object({
    rowNumber: z.number().int(),
    values: z.record(z.string(), z.string()),
    errors: z.array(z.string()),
  }),
);
type ReviewResponseKind = ReviewResponseState['kind'];

function responseView(review: {
  _id: unknown;
  reviewerName: string;
  rating: number;
  text: string;
  source: string;
  receivedAt: Date;
  responseState: string;
  responseText?: string | null;
  responseRevisedAt?: Date | null;
  responsePostedAt?: Date | null;
}) {
  const response: ReviewResponseContractState =
    review.responseState === 'unanswered'
      ? { kind: 'unanswered' }
      : review.responseState === 'drafted'
        ? {
            kind: 'drafted',
            text: review.responseText ?? '',
            revisedAt: dateValue(review.responseRevisedAt ?? undefined),
          }
        : {
            kind: 'posted_manually',
            text: review.responseText ?? '',
            postedAt: dateValue(review.responsePostedAt ?? undefined),
          };
  return {
    id: String(review._id),
    reviewerName: review.reviewerName,
    rating: review.rating,
    text: review.text,
    source: review.source,
    receivedAt: dateValue(review.receivedAt),
    response,
  };
}

function currentResponse(review: {
  responseState: string;
  responseText?: string | null;
  responseRevisedAt?: Date | null;
  responsePostedAt?: Date | null;
}): ReviewResponseState {
  if (review.responseState === 'unanswered') return { kind: 'unanswered' };
  if (review.responseState === 'drafted')
    return {
      kind: 'drafted',
      text: review.responseText ?? '',
      revisedAt: utcInstant(dateValue(review.responseRevisedAt ?? undefined)),
    };
  return {
    kind: 'posted_manually',
    text: review.responseText ?? '',
    postedAt: utcInstant(dateValue(review.responsePostedAt ?? undefined)),
  };
}

function responseKind(value: string): ReviewResponseKind {
  switch (value) {
    case 'unanswered':
    case 'drafted':
    case 'posted_manually':
      return value;
    default:
      throw new AppError('INTERNAL_ERROR', 'Stored review response state is invalid.', 500);
  }
}

export async function listReviews(input: {
  workspaceId: string;
  responseState?: 'unanswered' | 'drafted' | 'posted_manually';
  limit: number;
  cursor: number;
}) {
  const filter = {
    workspaceId: input.workspaceId,
    ...(input.responseState ? { responseState: input.responseState } : {}),
  };
  const items = await Review.find(filter)
    .sort({ receivedAt: -1, _id: -1 })
    .skip(input.cursor)
    .limit(input.limit + 1)
    .lean();
  const hasNext = items.length > input.limit;
  return {
    items: items.slice(0, input.limit).map(responseView),
    nextCursor: hasNext ? String(input.cursor + input.limit) : null,
  };
}

export async function createReview(input: {
  workspaceId: string;
  command: Command;
  body: unknown;
}) {
  const body = CreateReviewRequestSchema.parse(input.body);
  const id = newId();
  const receivedAt = body.receivedAt ? new Date(body.receivedAt) : new Date();
  const session = await mongoose.startSession();
  let created;
  try {
    await session.withTransaction(async () => {
      const rows = await Review.create(
        [
          {
            _id: id,
            workspaceId: input.workspaceId,
            ...body,
            receivedAt,
            responseState: 'unanswered',
          },
        ],
        { session },
      );
      created = rows[0];
      await appendEvent(
        {
          workspaceId: input.workspaceId,
          userId: commandActorUserId(input.command),
          requestId: String(input.command.requestId),
          commandId: String(input.command.commandId),
          subjectKind: 'review',
          subjectId: id,
          ordinal: 0,
          payload: {
            type: 'review.created',
            reviewId: reviewId(id),
            rating: body.rating,
            source: body.source,
          },
        },
        session,
      );
    });
  } finally {
    await session.endSession();
  }
  if (!created) throw new Error('Review transaction returned no review');
  return responseView(created);
}

export async function changeReviewResponseFor(
  workspaceId: string,
  reviewIdValue: string,
  command: Command,
  body: unknown,
) {
  const change = ReviewResponseActionSchema.parse(body);
  const session = await mongoose.startSession();
  let updated;
  try {
    await session.withTransaction(async () => {
      const review = await Review.findOne({ _id: reviewIdValue, workspaceId }).session(session);
      if (!review) throw new AppError('RESOURCE_NOT_FOUND', 'Review not found.', 404);
      const before = responseKind(review.responseState);
      let next: ReviewResponseState;
      try {
        next = changeReviewResponse(
          currentResponse(review),
          change,
          utcInstant(new Date().toISOString()),
        );
      } catch (error: unknown) {
        if (error instanceof DomainError && error.code === 'INVALID_TRANSITION')
          throw new AppError('INVALID_TRANSITION', error.message, 409);
        throw error;
      }
      await Review.updateOne(
        { _id: reviewIdValue, workspaceId },
        {
          $set: {
            responseState: next.kind,
            responseText: next.kind === 'unanswered' ? null : next.text,
            responseRevisedAt: next.kind === 'drafted' ? new Date(next.revisedAt) : null,
            responsePostedAt: next.kind === 'posted_manually' ? new Date(next.postedAt) : null,
          },
        },
        { session },
      );
      updated = await Review.findOne({ _id: reviewIdValue, workspaceId }).session(session);
      await appendEvent(
        {
          workspaceId,
          userId: commandActorUserId(command),
          requestId: String(command.requestId),
          commandId: String(command.commandId),
          subjectKind: 'review',
          subjectId: reviewIdValue,
          ordinal: 0,
          payload: {
            type: 'review.response_changed',
            reviewId: reviewId(reviewIdValue),
            from: before,
            to: next.kind,
          },
        },
        session,
      );
    });
  } finally {
    await session.endSession();
  }
  if (!updated) throw new Error('Review response transaction returned no review');
  return responseView(updated);
}

export async function previewReviewImport(workspaceId: string, createdBy: string, csv: string) {
  const parsed = parseReviewCsv(csv);
  const rows = reviewRows(parsed);
  const id = newId();
  await ReviewImportBatch.create({
    _id: id,
    workspaceId,
    createdBy,
    headers: parsed.headers,
    rows,
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
  });
  return { importId: id, headers: parsed.headers, rows, limits: REVIEW_IMPORT_LIMITS };
}

export async function commitReviewImport(
  workspaceId: string,
  importId: string,
  command: Command,
  body: unknown,
) {
  const input = ReviewImportCommitRequestSchema.parse(body);
  const session = await mongoose.startSession();
  let response: z.infer<typeof ReviewImportCommitResponseSchema> | undefined;
  try {
    await session.withTransaction(async () => {
      const batch = await ReviewImportBatch.findOne({ _id: importId, workspaceId }).session(
        session,
      );
      if (!batch) throw new AppError('RESOURCE_NOT_FOUND', 'Review import not found.', 404);
      if (batch.commitResponse) {
        response = ReviewImportCommitResponseSchema.parse(batch.commitResponse);
        return;
      }
      const rows = ReviewImportRowsSchema.parse(batch.rows);
      const created: ReturnType<typeof responseView>[] = [];
      const skippedRows: number[] = [];
      for (const row of rows) {
        const resolution =
          input.resolutions?.[String(row.rowNumber)] ?? (row.errors.length ? 'skip' : 'create');
        if (resolution === 'skip' || row.errors.length) {
          skippedRows.push(row.rowNumber);
          continue;
        }
        const value = row.values;
        const ordinal = created.length;
        const review = await Review.create(
          [
            {
              _id: newId(),
              workspaceId,
              reviewerName: value.reviewerName.trim(),
              rating: reviewRating(Number(value.rating)),
              text: value.text.trim(),
              source: value.source.trim(),
              receivedAt: value.receivedAt ? new Date(value.receivedAt) : new Date(),
              responseState: 'unanswered',
            },
          ],
          { session },
        );
        const item = review[0];
        created.push(responseView(item));
        await appendEvent(
          {
            workspaceId,
            userId: commandActorUserId(command),
            requestId: String(command.requestId),
            commandId: String(command.commandId),
            subjectKind: 'review',
            subjectId: String(item._id),
            ordinal,
            payload: {
              type: 'review.imported',
              reviewId: reviewId(String(item._id)),
              reviewImportBatchId: reviewImportBatchId(importId),
            },
          },
          session,
        );
      }
      response = { created, skippedRows };
      await ReviewImportBatch.updateOne(
        { _id: importId, workspaceId },
        { $set: { committedAt: new Date(), commitResponse: response } },
        { session },
      );
    });
  } finally {
    await session.endSession();
  }
  if (!response) throw new Error('Review import transaction returned no response');
  return response;
}
