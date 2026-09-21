import { AppError } from './errors.js';

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

function partsFor(instant: Date, timezone: string): Record<string, number> {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(instant);
  return Object.fromEntries(
    parts.filter((part) => part.type !== 'literal').map((part) => [part.type, Number(part.value)]),
  );
}

function offsetMinutesAt(instant: Date, timezone: string): number {
  const actual = partsFor(instant, timezone);
  const asUtc = Date.UTC(
    actual.year,
    actual.month - 1,
    actual.day,
    actual.hour,
    actual.minute,
    actual.second,
  );
  return Math.round((asUtc - instant.valueOf()) / 60_000);
}

export function localDateToUtc(date: string, timezone: string): Date {
  if (!DATE_ONLY.test(date)) throw new AppError('VALIDATION_FAILED', 'Use YYYY-MM-DD dates.', 400);
  const [year, month, day] = date.split('-').map(Number);
  const approximate = new Date(Date.UTC(year, month - 1, day));
  const firstOffset = offsetMinutesAt(approximate, timezone);
  const first = new Date(approximate.valueOf() - firstOffset * 60_000);
  const secondOffset = offsetMinutesAt(first, timezone);
  return new Date(approximate.valueOf() - secondOffset * 60_000);
}

export function addLocalDays(date: string, days: number): string {
  const [year, month, day] = date.split('-').map(Number);
  const value = new Date(Date.UTC(year, month - 1, day + days));
  return value.toISOString().slice(0, 10);
}

export function localDateFor(instant: Date, timezone: string): string {
  const parts = partsFor(instant, timezone);
  return `${String(parts.year).padStart(4, '0')}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
}

export function monthStartLocal(date: string): string {
  return `${date.slice(0, 7)}-01`;
}

export function resultsBounds(
  input: { from?: string; to?: string },
  timezone: string,
  now = new Date(),
): {
  from: Date;
  to: Date;
  fromLocal: string;
  toLocal: string;
} {
  const today = localDateFor(now, timezone);
  const fromLocal = input.from ?? monthStartLocal(today);
  const toLocal = input.to ?? addLocalDays(today, 1);
  const from = localDateToUtc(fromLocal, timezone);
  const to = localDateToUtc(toLocal, timezone);
  if (from >= to) throw new AppError('VALIDATION_FAILED', 'Results range must be ordered.', 400);
  return { from, to, fromLocal, toLocal };
}
