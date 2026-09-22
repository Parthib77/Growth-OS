import { describe, expect, it } from 'vitest';
import { readResults, resultsCsv } from './service.js';

describe('results CSV', () => {
  it('exports the inclusive through date instead of the exclusive query boundary', () => {
    const result: Awaited<ReturnType<typeof readResults>> = {
      range: {
        from: '2026-09-01T00:00:00.000Z',
        to: '2026-09-23T00:00:00.000Z',
        fromLocal: '2026-09-01',
        toLocal: '2026-09-23',
        throughLocal: '2026-09-22',
        timezone: 'UTC',
      },
      throughLocal: '2026-09-22',
      generatedAt: '2026-09-22T12:00:00.000Z',
      includedBookingStatuses: ['tentative', 'confirmed', 'completed', 'no_show'],
      newEnquiries: 1,
      bookingsRecorded: 2,
      bookingDefinition: 'Bookings created in the selected local range.',
      recordedValueDefinition: 'Recorded booking value, not collected revenue.',
      recordedBookingValue: { currency: 'USD', minorUnits: 12_500 },
      followUpsPrepared: 3,
      followUpsSent: 2,
      campaignReplies: 1,
      campaignConversions: 1,
    };

    expect(resultsCsv(result)).toContain('through_local,2026-09-22');
    expect(resultsCsv(result)).not.toContain('through_local,2026-09-23');
  });
});
