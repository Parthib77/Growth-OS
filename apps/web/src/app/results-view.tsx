'use client';

import { FormEvent, useEffect, useState } from 'react';
import {
  BarChart3,
  CalendarDays,
  CornerUpLeft,
  Database,
  Download,
  Link2,
  Mail,
  Send,
} from 'lucide-react';
import { ResultsResponseSchema } from '@growthos/contracts';
import { download, request } from './api-client';
import { AppNav, type AppScreen } from './app-nav';
import { Field, StatusLine, type Status } from './ui';
import { IconWell, TodayBadge } from './workspace-ui';

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
  return `${currency} ${new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(minorUnits / 100)}`;
}

export function ResultsView({
  businessName,
  isDemo,
  timezone,
  status,
  setStatus,
  onNavigate,
  onSignOut,
}: {
  businessName: string;
  isDemo: boolean;
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
        { label: 'New enquiries', value: results.newEnquiries, icon: Mail },
        { label: 'Follow-ups prepared', value: results.followUpsPrepared, icon: Send },
        { label: 'Marked as sent', value: results.followUpsSent, icon: Mail },
        { label: 'Replies recorded', value: results.campaignReplies, icon: CornerUpLeft },
        { label: 'Bookings recorded', value: results.bookingsRecorded, icon: BarChart3 },
        { label: 'Campaign-attributed bookings', value: results.campaignConversions, icon: Link2 },
      ]
    : [];
  const chartMaximum = Math.max(4, ...measures.map((measure) => measure.value));

  return (
    <main className="app-shell">
      <AppNav
        active="results"
        businessName={businessName}
        isDemo={isDemo}
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
        <TodayBadge />
      </header>

      <section className="panel results-filter" aria-labelledby="results-range-title">
        <div className="workspace-panel-heading">
          <IconWell>
            <CalendarDays size={25} />
          </IconWell>
          <div>
            <h2 id="results-range-title">Reporting period</h2>
            <p>Both dates are included in the report.</p>
          </div>
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
            <Download size={19} aria-hidden="true" />
            Download CSV
          </button>
        </form>
      </section>

      {results ? (
        <>
          <section className="results-metrics" aria-label="Activity totals">
            {measures.map((measure) => (
              <div className="result-metric-card" key={measure.label}>
                <IconWell>
                  <measure.icon size={23} />
                </IconWell>
                <span>{measure.label}</span>
                <strong>{measure.value}</strong>
              </div>
            ))}
          </section>
          <div className="results-workspace">
            <section className="results-ledger" aria-labelledby="activity-results-title">
              <div className="section-heading workspace-panel-heading">
                <IconWell>
                  <BarChart3 size={25} />
                </IconWell>
                <h2 id="activity-results-title">Activity overview</h2>
                <p>
                  {results.range.fromLocal} through {results.throughLocal}
                </p>
              </div>
              <div
                className="results-chart"
                role="img"
                aria-label={measures
                  .map((measure) => `${measure.label}: ${measure.value}`)
                  .join(', ')}
              >
                <div className="results-chart-y-axis" aria-hidden="true">
                  {Array.from({ length: 5 }, (_, index) => (
                    <span key={index}>{Math.round((chartMaximum * (4 - index)) / 4)}</span>
                  ))}
                </div>
                {measures.map((measure) => (
                  <div className="results-chart-column" key={measure.label}>
                    <div className="results-chart-bar-area">
                      <strong>{measure.value}</strong>
                      <span
                        className="results-chart-bar"
                        style={{ height: `${Math.max(3, (measure.value / chartMaximum) * 100)}%` }}
                      />
                    </div>
                    <span className="results-chart-label">{measure.label}</span>
                  </div>
                ))}
              </div>
            </section>
            <section className="recorded-value" aria-labelledby="recorded-value-title">
              <div className="workspace-panel-heading">
                <IconWell>
                  <Database size={25} />
                </IconWell>
                <h2 id="recorded-value-title">Recorded booking value</h2>
              </div>
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
        </>
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
