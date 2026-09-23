'use client';

import { FormEvent, useEffect, useState } from 'react';
import {
  CreateReviewRequestSchema,
  ReviewImportCommitResponseSchema,
  ReviewImportPreviewResponseSchema,
  ReviewListResponseSchema,
  ReviewResponseActionSchema,
  ReviewResponseSchema,
} from '@growthos/contracts';
import { formValues, request } from './api-client';
import { AppNav, type AppScreen } from './app-nav';
import { Field, StatusLine, type Status } from './ui';

type Review = ReturnType<typeof ReviewResponseSchema.parse>;
type ImportPreview = ReturnType<typeof ReviewImportPreviewResponseSchema.parse>;
type ReviewFilter = '' | 'unanswered' | 'drafted' | 'posted_manually';

function isReviewFilter(value: string): value is ReviewFilter {
  return (
    value === '' || value === 'unanswered' || value === 'drafted' || value === 'posted_manually'
  );
}

function responseLabel(review: Review): string {
  switch (review.response.kind) {
    case 'unanswered':
      return 'Needs response';
    case 'drafted':
      return 'Draft saved';
    case 'posted_manually':
      return 'Posted manually';
  }
}

export function ReviewsView({
  csrf,
  businessName,
  isDemo,
  responseTemplate,
  status,
  setStatus,
  onNavigate,
  onSignOut,
}: {
  csrf: string;
  businessName: string;
  isDemo: boolean;
  responseTemplate: string;
  status: Status;
  setStatus: (status: Status) => void;
  onNavigate: (screen: AppScreen) => void;
  onSignOut: () => void;
}) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [filter, setFilter] = useState<ReviewFilter>('');
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [csv, setCsv] = useState('');
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [intakeOpen, setIntakeOpen] = useState(true);

  useEffect(() => {
    setIntakeOpen(!window.matchMedia('(max-width: 760px)').matches);
  }, []);

  useEffect(() => {
    let current = true;
    const query = filter ? `?responseState=${encodeURIComponent(filter)}` : '';
    setStatus({ kind: 'pending', message: 'Loading reviews…' });
    void request(`/api/v1/reviews${query}`, ReviewListResponseSchema)
      .then((result) => {
        if (!current) return;
        setReviews(result.items);
        setDrafts((existing) => {
          const next = { ...existing };
          for (const review of result.items) {
            if (next[review.id] === undefined)
              next[review.id] =
                review.response.kind === 'unanswered'
                  ? responseTemplate.replaceAll('{reviewer_name}', review.reviewerName)
                  : review.response.text;
          }
          return next;
        });
        setStatus({ kind: 'idle' });
      })
      .catch((error: unknown) => {
        if (!current) return;
        setStatus({
          kind: 'error',
          message: error instanceof Error ? error.message : 'Unable to load reviews.',
        });
      });
    return () => {
      current = false;
    };
  }, [filter, responseTemplate, setStatus]);

  function replaceReview(updated: Review): void {
    setReviews((items) => items.map((review) => (review.id === updated.id ? updated : review)));
    setDrafts((items) => ({
      ...items,
      [updated.id]: updated.response.kind === 'unanswered' ? '' : updated.response.text,
    }));
  }

  async function createReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus({ kind: 'pending', message: 'Saving review…' });
    try {
      const values = formValues(event.currentTarget);
      const input = CreateReviewRequestSchema.parse({
        reviewerName: values.reviewerName,
        rating: Number(values.rating),
        text: values.text,
        source: values.source,
      });
      const created = await request('/api/v1/reviews', ReviewResponseSchema, {
        method: 'POST',
        headers: { 'X-CSRF-Token': csrf },
        body: JSON.stringify(input),
      });
      setReviews((items) => [created, ...items]);
      setDrafts((items) => ({
        ...items,
        [created.id]: responseTemplate.replaceAll('{reviewer_name}', created.reviewerName),
      }));
      event.currentTarget.reset();
      setStatus({ kind: 'success', message: 'Review added. The original text is now read-only.' });
    } catch (error: unknown) {
      setStatus({
        kind: 'error',
        message: error instanceof Error ? error.message : 'Unable to save the review.',
      });
    }
  }

  async function changeResponse(
    review: Review,
    action: 'save_draft' | 'mark_posted_manually' | 'reopen_draft',
  ) {
    setStatus({ kind: 'pending', message: 'Saving response state…' });
    try {
      const body = ReviewResponseActionSchema.parse(
        action === 'mark_posted_manually' ? { action } : { action, text: drafts[review.id] ?? '' },
      );
      const updated = await request(`/api/v1/reviews/${review.id}/response`, ReviewResponseSchema, {
        method: 'PATCH',
        headers: { 'X-CSRF-Token': csrf },
        body: JSON.stringify(body),
      });
      replaceReview(updated);
      setStatus({
        kind: 'success',
        message:
          updated.response.kind === 'posted_manually'
            ? 'Response marked as posted manually.'
            : 'Response draft saved.',
      });
    } catch (error: unknown) {
      setStatus({
        kind: 'error',
        message: error instanceof Error ? error.message : 'Unable to update the response.',
      });
    }
  }

  async function copyResponse(review: Review) {
    const text = review.response.kind === 'unanswered' ? drafts[review.id] : review.response.text;
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setStatus({ kind: 'success', message: `Response for ${review.reviewerName} copied.` });
    } catch {
      setStatus({ kind: 'error', message: 'Clipboard access failed. Select and copy the draft.' });
    }
  }

  async function previewImport() {
    setStatus({ kind: 'pending', message: 'Checking review CSV…' });
    try {
      const result = await request(
        '/api/v1/review-imports/preview',
        ReviewImportPreviewResponseSchema,
        {
          method: 'POST',
          headers: { 'X-CSRF-Token': csrf },
          body: JSON.stringify({ csv }),
        },
      );
      setPreview(result);
      setStatus({
        kind: 'success',
        message: `${result.rows.length} row${result.rows.length === 1 ? '' : 's'} ready for review.`,
      });
    } catch (error: unknown) {
      setStatus({
        kind: 'error',
        message: error instanceof Error ? error.message : 'Unable to preview the file.',
      });
    }
  }

  async function commitImport() {
    if (!preview) return;
    setStatus({ kind: 'pending', message: 'Importing valid review rows…' });
    try {
      const resolutions = Object.fromEntries(
        preview.rows.map((row) => [String(row.rowNumber), row.errors.length ? 'skip' : 'create']),
      );
      const result = await request(
        `/api/v1/review-imports/${preview.importId}/commit`,
        ReviewImportCommitResponseSchema,
        {
          method: 'POST',
          headers: { 'X-CSRF-Token': csrf },
          body: JSON.stringify({ resolutions }),
        },
      );
      setReviews((items) => [...result.created, ...items]);
      setPreview(null);
      setCsv('');
      setStatus({
        kind: 'success',
        message: `${result.created.length} review${result.created.length === 1 ? '' : 's'} imported.`,
      });
    } catch (error: unknown) {
      setStatus({
        kind: 'error',
        message: error instanceof Error ? error.message : 'Unable to commit the import.',
      });
    }
  }

  const pending = status.kind === 'pending';

  return (
    <main className="app-shell">
      <AppNav
        active="reviews"
        businessName={businessName}
        isDemo={isDemo}
        onNavigate={onNavigate}
        onSignOut={onSignOut}
        signOutPending={pending}
      />
      <header className="topbar screen-heading">
        <div>
          <h1 id="screen-title" tabIndex={-1}>
            Reviews
          </h1>
          <p className="screen-intro">
            Keep the original review intact while you prepare and track a manual response.
          </p>
        </div>
        <label className="field compact-field">
          <span>Show</span>
          <select
            value={filter}
            onChange={(event) => {
              if (isReviewFilter(event.target.value)) setFilter(event.target.value);
            }}
          >
            <option value="">All reviews</option>
            <option value="unanswered">Needs response</option>
            <option value="drafted">Draft saved</option>
            <option value="posted_manually">Posted manually</option>
          </select>
        </label>
      </header>

      <div className="review-workspace">
        <section className="panel review-entry" aria-label="Review intake">
          <details className="review-add-disclosure" open={intakeOpen}>
            <summary
              onClick={(event) => {
                event.preventDefault();
                setIntakeOpen((open) => !open);
              }}
            >
              Add or import reviews
            </summary>
            <div className="review-add-content">
              <h2 id="add-review-title">Add a review</h2>
              <p className="muted">
                Use this for feedback received outside a connected review provider.
              </p>
              <form onSubmit={createReview}>
                <div className="form-grid">
                  <Field label="Reviewer name" name="reviewerName" />
                  <label className="field">
                    <span>Rating</span>
                    <select name="rating" defaultValue="5">
                      <option value="5">5 / 5</option>
                      <option value="4">4 / 5</option>
                      <option value="3">3 / 5</option>
                      <option value="2">2 / 5</option>
                      <option value="1">1 / 5</option>
                    </select>
                  </label>
                  <Field label="Source" name="source" defaultValue="manual" />
                </div>
                <label className="field">
                  <span>Original review</span>
                  <textarea name="text" rows={5} required />
                </label>
                <button className="button primary" disabled={pending}>
                  Save review
                </button>
              </form>

              <details className="import-disclosure">
                <summary>Import review CSV</summary>
                <p className="muted">
                  Required columns: reviewerName, rating, text, source. receivedAt is optional.
                </p>
                <label className="field">
                  <span>CSV content</span>
                  <textarea value={csv} onChange={(event) => setCsv(event.target.value)} rows={6} />
                </label>
                <button
                  type="button"
                  className="button secondary"
                  onClick={previewImport}
                  disabled={pending || !csv.trim()}
                >
                  Preview rows
                </button>
                {preview ? (
                  <div className="import-preview" aria-label="Review import preview">
                    {preview.rows.map((row) => (
                      <div className="import-row review-import-row" key={row.rowNumber}>
                        <strong>Row {row.rowNumber}</strong>
                        <span>{row.values.reviewerName || 'Missing reviewer'}</span>
                        <span>{row.values.rating || 'No rating'} / 5</span>
                        <span className={row.errors.length ? 'validation-copy' : 'muted'}>
                          {row.errors.length ? row.errors.join('; ') : 'Ready to import'}
                        </span>
                      </div>
                    ))}
                    <button
                      type="button"
                      className="button primary"
                      onClick={commitImport}
                      disabled={pending}
                    >
                      Import valid rows
                    </button>
                  </div>
                ) : null}
              </details>
            </div>
          </details>
        </section>

        <section className="review-ledger" aria-label="Reviews">
          {reviews.length === 0 && !pending ? (
            <div className="empty">
              <h2>No reviews in this view</h2>
              <p>Add a review or change the filter.</p>
            </div>
          ) : (
            reviews.map((review) => {
              const responseText = drafts[review.id] ?? '';
              return (
                <article className="review-record" key={review.id}>
                  <div className="review-original">
                    <div className="review-meta">
                      <strong>{review.reviewerName}</strong>
                      <span>{review.rating} / 5</span>
                      <span>{review.source}</span>
                      <time dateTime={review.receivedAt}>
                        {new Date(review.receivedAt).toLocaleDateString()}
                      </time>
                    </div>
                    <blockquote>{review.text}</blockquote>
                  </div>
                  <div className="review-response">
                    <div className="review-response-heading">
                      <h2>Response</h2>
                      <span className={`state-label ${review.response.kind}`}>
                        {responseLabel(review)}
                      </span>
                    </div>
                    <label className="field">
                      <span>Response text</span>
                      <textarea
                        rows={5}
                        value={responseText}
                        readOnly={review.response.kind === 'posted_manually'}
                        onChange={(event) =>
                          setDrafts((items) => ({ ...items, [review.id]: event.target.value }))
                        }
                      />
                    </label>
                    <div className="button-row">
                      {review.response.kind === 'posted_manually' ? (
                        <button
                          type="button"
                          className="button secondary"
                          onClick={() => changeResponse(review, 'reopen_draft')}
                          disabled={pending}
                        >
                          Reopen draft
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="button primary"
                          onClick={() => changeResponse(review, 'save_draft')}
                          disabled={pending || !responseText.trim()}
                        >
                          Save draft
                        </button>
                      )}
                      <button
                        type="button"
                        className="button secondary"
                        onClick={() => copyResponse(review)}
                        disabled={!responseText.trim()}
                      >
                        Copy response
                      </button>
                      {review.response.kind === 'drafted' ? (
                        <button
                          type="button"
                          className="button quiet"
                          onClick={() => changeResponse(review, 'mark_posted_manually')}
                          disabled={pending}
                        >
                          Mark posted manually
                        </button>
                      ) : null}
                    </div>
                  </div>
                </article>
              );
            })
          )}
        </section>
      </div>
      <StatusLine status={status} />
    </main>
  );
}
