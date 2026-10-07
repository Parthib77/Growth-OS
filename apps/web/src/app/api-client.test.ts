import { afterEach, describe, expect, it, vi } from 'vitest';
import { localDateTimeToUtc, request } from './api-client';
import { z } from 'zod';

afterEach(() => vi.unstubAllGlobals());

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

describe('network recovery copy', () => {
  it('shows a readable error when the hosting proxy returns a non-JSON error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('Internal Server Error', { status: 502 })),
    );
    await expect(request('/api/v1/session', z.object({ id: z.string() }))).rejects.toMatchObject({
      name: 'ApiError',
      code: 'INTERNAL_ERROR',
      status: 502,
      message: 'The service is temporarily unavailable. Please try again.',
    });
  });
  it('turns an unreachable API into an actionable error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));

    await expect(request('/api/v1/session', z.object({ id: z.string() }))).rejects.toEqual(
      expect.objectContaining({
        name: 'ApiError',
        code: 'NETWORK_ERROR',
        status: 0,
        message: 'Connection lost. Check your internet connection and try again.',
      }),
    );
  });
});
