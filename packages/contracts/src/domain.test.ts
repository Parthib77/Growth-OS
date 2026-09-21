import { describe, expect, it } from 'vitest';
import {
  addMoney,
  assertCustomerTransition,
  canTransitionBooking,
  currencyCode,
  minorUnits,
  money,
} from './domain.js';

describe('domain primitives', () => {
  it('keeps money in integer minor units and rejects mixed currencies', () => {
    expect(
      addMoney(
        money({ currency: 'USD', minorUnits: 1250 }),
        money({ currency: 'USD', minorUnits: 375 }),
      ),
    ).toEqual({ currency: 'USD', minorUnits: 1625 });
    expect(() =>
      addMoney(
        money({ currency: 'USD', minorUnits: 1 }),
        money({ currency: 'GBP', minorUnits: 1 }),
      ),
    ).toThrow('currencies differ');
    expect(() => minorUnits(1.2)).toThrow();
    expect(currencyCode('USD')).toBe('USD');
  });

  it('enforces state transitions at the domain boundary', () => {
    expect(() => assertCustomerTransition('enquiry', 'booked')).not.toThrow();
    expect(() => assertCustomerTransition('completed', 'booked')).toThrow('Cannot move');
    expect(canTransitionBooking('confirmed', 'completed')).toBe(true);
    expect(canTransitionBooking('completed', 'confirmed')).toBe(false);
  });
});
