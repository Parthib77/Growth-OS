import { describe, expect, it } from 'vitest';
import {
  findDuplicateMatches,
  parseCustomerCsv,
  safeCsvCell,
  assertLifecycleTransition,
} from './domain.js';

describe('customer domain policies', () => {
  it('parses quoted CSV and preserves commas', () => {
    expect(parseCustomerCsv('First Name,Phone,Service\n"Ada, Jr",+15551212,Hair')).toEqual({
      headers: ['First Name', 'Phone', 'Service'],
      rows: [['Ada, Jr', '+15551212', 'Hair']],
    });
  });

  it('rejects formula-like cells before they can be persisted', () => {
    expect(() => parseCustomerCsv('Name,Phone\n=HYPERLINK("x"),+15551212')).toThrow(/formula-like/);
  });

  it('returns every duplicate field for explicit review', () => {
    expect(
      findDuplicateMatches({ normalizedPhone: '+1555', normalizedEmail: 'ada@example.com' }, [
        { id: 'customer-1', normalizedPhone: '+1555', normalizedEmail: 'ada@example.com' },
      ]),
    ).toEqual([{ id: 'customer-1', matchedOn: ['phone', 'email'] }]);
  });

  it('uses the shared lifecycle transition policy', () => {
    expect(() => assertLifecycleTransition('enquiry', 'contacted')).not.toThrow();
    expect(() => assertLifecycleTransition('completed', 'booked')).toThrow(/Cannot move/);
  });

  it('escapes cells that would be formulas in an export', () => {
    expect(safeCsvCell('=SUM(A1:A2)')).toBe("'=SUM(A1:A2)");
    expect(safeCsvCell('Ada, Jr')).toBe('"Ada, Jr"');
  });
});
