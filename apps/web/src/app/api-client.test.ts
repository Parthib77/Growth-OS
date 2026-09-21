import { describe, expect, it } from 'vitest';
import { localDateTimeToUtc } from './api-client';

describe('datetime-local conversion', () => {
  it('converts a workspace-local appointment across daylight saving time', () => {
    expect(localDateTimeToUtc('2026-03-08T01:30', 'America/Los_Angeles')).toBe(
      '2026-03-08T09:30:00.000Z',
    );
    expect(localDateTimeToUtc('2026-03-09T01:30', 'America/Los_Angeles')).toBe(
      '2026-03-09T08:30:00.000Z',
    );
  });
});
