import { z } from 'zod';
import { ErrorResponseSchema } from '@growthos/contracts';

let pendingRequests = 0;
const requestListeners = new Set<() => void>();

export function subscribeToRequestActivity(listener: () => void): () => void {
  requestListeners.add(listener);
  return () => requestListeners.delete(listener);
}

export function hasPendingRequests(): boolean {
  return pendingRequests > 0;
}

async function trackedFetch(path: string, init: RequestInit): Promise<Response> {
  pendingRequests += 1;
  requestListeners.forEach((listener) => listener());
  try {
    return await fetch(path, init);
  } finally {
    pendingRequests -= 1;
    requestListeners.forEach((listener) => listener());
  }
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function request<T>(
  path: string,
  schema: z.ZodType<T>,
  init: RequestInit = {},
): Promise<T> {
  let response: Response;
  try {
    response = await trackedFetch(path, {
      credentials: 'include',
      ...init,
      headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) },
    });
  } catch {
    throw new ApiError(
      'Connection lost. Check your internet connection and try again.',
      'NETWORK_ERROR',
      0,
    );
  }
  if (response.status === 204) return schema.parse(null);
  const data: unknown = await response.json();
  if (!response.ok) {
    const parsed = ErrorResponseSchema.safeParse(data);
    if (parsed.success)
      throw new ApiError(parsed.data.error.message, parsed.data.error.code, response.status);
    throw new ApiError('Something went wrong. Try again.', 'INTERNAL_ERROR', response.status);
  }
  return schema.parse(data);
}

export async function download(path: string, fallbackName: string): Promise<void> {
  let response: Response;
  try {
    response = await trackedFetch(path, { credentials: 'include' });
  } catch {
    throw new ApiError(
      'Connection lost. Check your internet connection and try again.',
      'NETWORK_ERROR',
      0,
    );
  }
  if (!response.ok) {
    const data: unknown = await response.json().catch(() => null);
    const parsed = ErrorResponseSchema.safeParse(data);
    if (parsed.success)
      throw new ApiError(parsed.data.error.message, parsed.data.error.code, response.status);
    throw new ApiError(
      'The download could not be prepared. Try again.',
      'DOWNLOAD_FAILED',
      response.status,
    );
  }
  const blob = await response.blob();
  const disposition = response.headers.get('content-disposition') ?? '';
  const match = /filename="?([^";]+)"?/i.exec(disposition);
  const name = match?.[1] ?? fallbackName;
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = href;
  anchor.download = name;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(href);
}

export function formValues(form: HTMLFormElement): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of new FormData(form).entries())
    if (typeof value === 'string') result[key] = value;
  return result;
}

export function commandIdFor(input: unknown): string {
  return JSON.stringify(input);
}

export function localDateTimeToUtc(value: string, timezone: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) throw new Error('Choose a valid appointment time.');
  const [, year, month, day, hour, minute] = match;
  const approximate = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
  );
  const offsetAt = (instant: number): number => {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(new Date(instant));
    const fields = Object.fromEntries(
      parts
        .filter((part) => part.type !== 'literal')
        .map((part) => [part.type, Number(part.value)]),
    );
    const interpreted = Date.UTC(
      fields.year,
      fields.month - 1,
      fields.day,
      fields.hour,
      fields.minute,
      fields.second,
    );
    return Math.round((interpreted - instant) / 60_000);
  };
  const first = approximate - offsetAt(approximate) * 60_000;
  return new Date(approximate - offsetAt(first) * 60_000).toISOString();
}
