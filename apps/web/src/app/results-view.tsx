'use client';

import { FormEvent, useEffect, useState } from 'react';
import { ResultsResponseSchema } from '@growthos/contracts';
import { download, request } from './api-client';
import { AppNav, type AppScreen } from './app-nav';
import { Field, StatusLine, type Status } from './ui';

type Results = ReturnType<typeof ResultsResponseSchema.parse>;

function localDateIn(timezone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const values = Object.fromEntries(
    parts.filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]),
  );
  return `${values.year}-${values.month}-${values.day}`;
}

function money(currency: string, minorUnits: number): string {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
  }).format(minorUnits / 100);
}

export function ResultsView({
  businessName,
  timezone,
  status,
  setStatus,
  onNavigate,
  onSignOut,
}: {
  businessName: string;
  timezone: string;
  status: Status;
  setStatus: (status: Status) => void;
  onNavigate: (screen: AppScreen) => void;
  onSignOut: () => void;
}) {
  const today = localDateIn(timezone);
  const [from, setFrom] = useState(`${today.slice(0, 7)}-01`);
  const [through, setThrough] = useState(today);
  const [results, setResults] = useState<Results | null>(null);

  async function loadReport(nextFrom = from, nextThrough = through) {
    setStatus({ kind: 'pending', message: 'Calculating stored results…' });
    try {
      const query = new URLSearchParams({ from: nextFrom, through: nextThrough });
      const report = await request(`/api/v1/results?${query}`, ResultsResponseSchema);
      setResults(report);
      setStatus({ kind: 'success', message: 'Results updated from stored records.' });
    } catch (error: unknown) {
      setStatus({
        kind: 'error',
        message: error instanceof Error ? error.message : 'Unable to load results.',
      });
    }
  }

  useEffect(() => {
    void loadReport();
  }, []);

  function submitDates(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void loadReport();
  }

  async function exportCsv() {
    setStatus({ kind: 'pending', message: 'Preparing results CSV…' });
    try {
      const query = new URLSearchParams({ from, through });
      await download(`/api/v1/results.csv?${query}`, `growthos-results-${from}-${through}.csv`);
      setStatus({ kind: 'success', message: 'Results CSV downloaded.' });
    } catch (error: unknown) {
      setStatus({
        kind: 'error',
        message: error instanceof Error ? error.message : 'Unable to download results.',
      });
    }
  }

  const pending = status.kind === 'pending';
  const measures = results
    ? [
        ['New enquiries', results.newEnquiries],
        ['Follow-ups prepared', results.followUpsPrepared],
        ['Marked as sent', results.followUpsSent],
        ['Replies recorded', results.campaignReplies],
        ['Bookings recorded', results.bookingsRecorded],
        ['Campaign-attributed bookings', results.campaignConversions],
      ]
    : [];

  return (
    <main className="app-shell">
      <AppNav
        active="results"
        businessName={businessName}
        onNavigate={onNavigate}
        onSignOut={onSignOut}
        signOutPending={pending}
      />
      <header className="topbar screen-heading">
        <div>
          <h1 id="screen-title" tabIndex={-1}>
            Results
          </h1>
          <p className="screen-intro">Counts come from stored events and bookings in {timezone}.</p>
        </div>
      </header>

      <section className="panel results-filter" aria-labelledby="results-range-title">
        <div>
          <h2 id="results-range-title">Reporting period</h2>
          <p className="muted">Both dates are included in the report.</p>
        </div>
        <form className="results-filter-form" onSubmit={submitDates}>
          <Field
            label="From"
            name="from"
            type="date"
            value={from}
            onChange={(event) => setFrom(event.target.value)}
          />
          <Field
            label="Through"
            name="through"
            type="date"
            value={through}
            onChange={(event) => setThrough(event.target.value)}
          />
          <button className="button primary" disabled={pending || !from || !through}>
            Update results
          </button>
          <button
            type="button"
            className="button secondary"
            onClick={exportCsv}
            disabled={pending || !results}
          >
            Download CSV
          </button>
        </form>
      </section>

      {results ? (
        <div className="results-workspace">
          <section className="results-ledger" aria-labelledby="activity-results-title">
            <div className="section-heading">
              <h2 id="activity-results-title">Activity recorded</h2>
              <p>
                {results.range.fromLocal} through {results.throughLocal}
              </p>
            </div>
            <dl className="metric-ledger">
              {measures.map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          </section>
          <section className="recorded-value" aria-labelledby="recorded-value-title">
            <h2 id="recorded-value-title">Recorded booking value</h2>
            <strong>
              {money(
                results.recordedBookingValue.currency,
                results.recordedBookingValue.minorUnits,
              )}
            </strong>
            <p>{results.recordedValueDefinition}</p>
            <p>{results.bookingDefinition}</p>
            <p className="muted">
              Included booking statuses: {results.includedBookingStatuses.join(', ')}.
            </p>
          </section>
        </div>
      ) : (
        <div className="empty">
          <h2>Choose a reporting period</h2>
          <p>The report will show only stored operational records.</p>
        </div>
      )}
      <StatusLine status={status} />
    </main>
  );
}
