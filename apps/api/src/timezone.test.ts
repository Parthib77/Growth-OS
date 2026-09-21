import { describe, expect, it } from 'vitest';
import { localDateToUtc, resultsBounds } from './timezone.js';

describe('workspace timezone boundaries', () => {
  it('converts local midnight across daylight-saving boundaries', () => {
    expect(localDateToUtc('2026-03-08', 'America/Los_Angeles').toISOString()).toBe(
      '2026-03-08T08:00:00.000Z',
    );
    expect(localDateToUtc('2026-03-09', 'America/Los_Angeles').toISOString()).toBe(
      '2026-03-09T07:00:00.000Z',
    );
  });

  it('returns an exclusive upper bound for local dates', () => {
    const bounds = resultsBounds({ from: '2026-03-08', to: '2026-03-09' }, 'America/Los_Angeles');
    expect(bounds.to.getTime() - bounds.from.getTime()).toBe(23 * 60 * 60 * 1000);
  });
});
