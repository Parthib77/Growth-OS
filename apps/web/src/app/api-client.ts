import { z } from 'zod';
import { ErrorResponseSchema } from '@growthos/contracts';

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
  const response = await fetch(path, {
    credentials: 'include',
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  });
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
