import type { ErrorRequestHandler, NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';

export type ErrorCode =
  | 'VALIDATION_FAILED'
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'RESOURCE_NOT_FOUND'
  | 'INVALID_TRANSITION'
  | 'IDEMPOTENCY_KEY_REUSED'
  | 'RATE_LIMITED'
  | 'CONFLICT'
  | 'INTERNAL_ERROR'
  | 'CSRF_FAILED'
  | 'DUPLICATE_CUSTOMER'
  | 'DUPLICATE_REVIEW_REQUIRED'
  | 'CONSENT_REQUIRED'
  | 'CAMPAIGN_VERSION_CONFLICT';

export class AppError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly status = 400,
    public readonly fieldErrors?: Record<string, string[]>,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function errorBody(error: unknown, requestId: string): { error: Record<string, unknown> } {
  if (error instanceof AppError) {
    return {
      error: {
        code: error.code,
        message: error.message,
        requestId,
        ...(error.fieldErrors ? { fieldErrors: error.fieldErrors } : {}),
      },
    };
  }
  if (error instanceof ZodError) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of error.issues) {
      const key = issue.path.join('.') || 'form';
      fieldErrors[key] = [...(fieldErrors[key] ?? []), issue.message];
    }
    return {
      error: {
        code: 'VALIDATION_FAILED',
        message: 'Check the highlighted fields.',
        requestId,
        fieldErrors,
      },
    };
  }
  return {
    error: { code: 'INTERNAL_ERROR', message: 'Something went wrong. Try again.', requestId },
  };
}

export const errorHandler: ErrorRequestHandler = (
  error: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
) => {
  const requestId = String(
    res.getHeader('x-request-id') ?? req.headers['x-request-id'] ?? 'unknown',
  );
  const status = error instanceof AppError ? error.status : error instanceof ZodError ? 400 : 500;
  if (status >= 500)
    console.error(
      JSON.stringify({
        level: 'error',
        requestId,
        error: error instanceof Error ? error.message : 'unknown',
      }),
    );
  res.status(status).json(errorBody(error, requestId));
};
