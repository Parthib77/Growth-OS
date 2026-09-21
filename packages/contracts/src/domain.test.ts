import { describe, expect, it } from 'vitest';
import {
  addMoney,
  assertCustomerTransition,
  canTransitionBooking,
  currencyCode,
  minorUnits,
  money,
  operationalEvent,
  redactEventPayload,
  userId,
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

  it('constructs complete operational facts with caller-supplied ordinals', () => {
    const event = operationalEvent({
      eventId: 'dead-beef',
      workspaceId: 'cafe-babe',
      commandId: 'face-feed',
      ordinal: 3,
      occurredAt: '2026-09-21T12:00:00.000Z',
      actor: { kind: 'user', userId: userId('bad-cafe1') },
      requestId: 'bead-feed',
      subject: { kind: 'workspace', id: 'cafe-babe' },
      payload: { type: 'workspace.settings_changed', changedFields: ['timezone'] },
    });
    expect(event.ordinal).toBe(3);
    expect(event.schemaVersion).toBe(1);
    expect(redactEventPayload(event.payload)).toEqual(event.payload);
  });
});
