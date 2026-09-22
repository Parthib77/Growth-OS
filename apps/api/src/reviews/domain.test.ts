import { describe, expect, it } from 'vitest';
import { changeReviewResponse, utcInstant } from '@growthos/contracts';
import { parseReviewCsv, reviewRows, reviewCsv } from './domain.js';

describe('review domain', () => {
  it('keeps original response text in a separate state transition', () => {
    const drafted = changeReviewResponse(
      { kind: 'unanswered' },
      { action: 'save_draft', text: 'Thank you' },
      utcInstant('2026-09-22T00:00:00.000Z'),
    );
    expect(drafted).toEqual({
      kind: 'drafted',
      text: 'Thank you',
      revisedAt: '2026-09-22T00:00:00.000Z',
    });
    expect(
      changeReviewResponse(
        drafted,
        { action: 'mark_posted_manually' },
        utcInstant('2026-09-22T00:01:00.000Z'),
      ).kind,
    ).toBe('posted_manually');
    expect(() =>
      changeReviewResponse(
        { kind: 'unanswered' },
        { action: 'mark_posted_manually' },
        utcInstant('2026-09-22T00:00:00.000Z'),
      ),
    ).toThrow();
    expect(() =>
      changeReviewResponse(
        {
          kind: 'posted_manually',
          text: 'Posted',
          postedAt: utcInstant('2026-09-22T00:01:00.000Z'),
        },
        { action: 'save_draft', text: 'Overwrite' },
        utcInstant('2026-09-22T00:02:00.000Z'),
      ),
    ).toThrow();
  });

  it('bounds and validates review CSV rows', () => {
    const parsed = parseReviewCsv('reviewerName,rating,text,source\nMina,5,"Great",google');
    expect(reviewRows(parsed)[0]?.errors).toEqual([]);
    expect(
      reviewRows(parseReviewCsv('reviewerName,rating,text,source\nMina,8,,google'))[0]?.errors
        .length,
    ).toBe(2);
    expect(() =>
      parseReviewCsv(`reviewerName,rating,text,source\nMina,5,${'x'.repeat(5001)},google`),
    ).toThrow();
  });

  it('formula-protects review CSV exports', () => {
    const output = reviewCsv([
      {
        reviewerName: '=bad',
        rating: 5,
        text: 'ok',
        source: 'google',
        receivedAt: '2026-09-22T00:00:00.000Z',
        responseState: 'unanswered',
        responseText: '',
      },
    ]);
    expect(output).toContain("'=bad");
  });
});
