'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import { z } from 'zod';
import {
  BookingListResponseSchema,
  BookingResponseSchema,
  CreateBookingRequestSchema,
  CreateCustomerRequestSchema,
  CsrfResponseSchema,
  CustomerResponseSchema,
  ResultsResponseSchema,
  PasswordResetCompleteRequestSchema,
  PasswordResetCompleteResponseSchema,
  PasswordResetRequestResponseSchema,
  SessionResponseSchema,
  SignInResponseSchema,
  TodayResponseSchema,
  WorkspaceResponseSchema,
  RegisterResponseSchema,
} from '@growthos/contracts';
import { commandIdFor, formValues, localDateTimeToUtc, request } from './api-client';
import { Field, StatusLine, type Status } from './ui';
import { TodayDialogs } from './dialogs';
import { CustomersView } from './customers-view';
import { CampaignsView } from './campaigns-view';
import { AppNav, type AppScreen } from './app-nav';
import { ReviewsView } from './reviews-view';
import { ResultsView } from './results-view';
import { SettingsView } from './settings-view';

type Customer = {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  service: string;
  source: string;
  quotedMoney: { currency: string; minorUnits: number } | null;
  consent: { channel: string; decision: string } | null;
  lifecycle: string;
  lastInteractionAt: string;
  reasons?: string[];
  nextAction?: string;
};
type Workspace = {
  id: string;
  businessName: string;
  category: string | null;
  timezone: string;
  currency: string;
  defaultCountryCode: string;
  bookingLink: string | null;
  followUpDays: number;
  onboardingComplete: boolean;
  reviewResponseTemplate: string;
  isDemo: boolean;
};
type Results = {
  newEnquiries: number;
  bookingsRecorded: number;
  recordedBookingValue: { currency: string; minorUnits: number };
  followUpsPrepared: number;
  followUpsSent: number;
  campaignReplies: number;
  campaignConversions: number;
};
type Booking = {
  id: string;
  customerId: string;
  service: string;
  appointmentAt: string;
  agreedMoney: { currency: string; minorUnits: number };
  state: string;
};

type Screen = 'auth' | 'onboarding' | AppScreen;
type AuthMode = 'register' | 'sign-in' | 'request-reset' | 'complete-reset';

export default function Home() {
  const [csrf, setCsrf] = useState('');
  const [authMode, setAuthMode] = useState<AuthMode>('register');
  const [resetToken, setResetToken] = useState('');
  const [screen, setScreen] = useState<Screen>('auth');
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [today, setToday] = useState<Customer[]>([]);
  const [results, setResults] = useState<Results | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [selected, setSelected] = useState<Customer | null>(null);
  const [showCustomer, setShowCustomer] = useState(false);
  const [showBooking, setShowBooking] = useState(false);
  const bookingSubmission = useRef<{ fingerprint: string; key: string } | null>(null);

  async function refreshCsrf() {
    const value = await request('/api/v1/auth/csrf', CsrfResponseSchema);
    setCsrf(value.csrfToken);
    return value.csrfToken;
  }
  async function refreshWorkspace() {
    const current = await request('/api/v1/workspace', WorkspaceResponseSchema);
    setWorkspace(current);
    setScreen(current.onboardingComplete ? 'today' : 'onboarding');
  }
  async function refreshToday() {
    const [queue, report, bookingList] = await Promise.all([
      request('/api/v1/today', TodayResponseSchema),
      request('/api/v1/results', ResultsResponseSchema),
      request('/api/v1/bookings', BookingListResponseSchema),
    ]);
    setToday(queue.items);
    setResults(report);
    setBookings(bookingList.items);
  }
  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get('reset_token');
    if (token) {
      setResetToken(token);
      setAuthMode('complete-reset');
      void refreshCsrf();
      return;
    }
    void refreshCsrf().then(() =>
      request('/api/v1/session', SessionResponseSchema)
        .then(refreshWorkspace)
        .catch(() => undefined),
    );
  }, []);
  useEffect(() => {
    if (screen === 'today')
      void refreshToday().catch((error) => setStatus({ kind: 'error', message: error.message }));
  }, [screen]);
  useEffect(() => {
    if (screen === 'auth' || screen === 'onboarding') return;
    requestAnimationFrame(() => document.getElementById('screen-title')?.focus());
  }, [screen]);

  function navigate(destination: AppScreen) {
    setStatus({ kind: 'idle' });
    setScreen(destination);
  }

  async function submitAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus({ kind: 'pending', message: 'Signing you in…' });
    const values = formValues(event.currentTarget);
    try {
      const token = await refreshCsrf();
      const result = await request(
        `/api/v1/auth/${authMode === 'register' ? 'register' : 'sign-in'}`,
        authMode === 'register' ? RegisterResponseSchema : SignInResponseSchema,
        {
          method: 'POST',
          headers: { 'X-CSRF-Token': token },
          body: JSON.stringify(values),
        },
      );
      setCsrf(result.csrfToken);
      await refreshWorkspace();
      setStatus({
        kind: 'success',
        message: authMode === 'register' ? 'Account created.' : 'Signed in.',
      });
    } catch (error) {
      setStatus({
        kind: 'error',
        message: error instanceof Error ? error.message : 'Unable to continue.',
      });
    }
  }
  async function submitPasswordResetRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus({ kind: 'pending', message: 'Preparing password reset instructions…' });
    const values = formValues(event.currentTarget);
    try {
      const token = await refreshCsrf();
      const result = await request(
        '/api/v1/auth/password-reset-requests',
        PasswordResetRequestResponseSchema,
        {
          method: 'POST',
          headers: { 'X-CSRF-Token': token },
          body: JSON.stringify({ email: values.email }),
        },
      );
      if (result.developmentResetToken) {
        setResetToken(result.developmentResetToken);
        setAuthMode('complete-reset');
      }
      setStatus({ kind: 'success', message: result.message });
    } catch (error: unknown) {
      setStatus({
        kind: 'error',
        message: error instanceof Error ? error.message : 'Unable to request a password reset.',
      });
    }
  }
  async function submitPasswordReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus({ kind: 'pending', message: 'Updating your password…' });
    const values = formValues(event.currentTarget);
    try {
      if (values.password !== values.confirmPassword)
        throw new Error('The password confirmation does not match.');
      const input = PasswordResetCompleteRequestSchema.parse({
        token: resetToken,
        password: values.password,
      });
      const token = await refreshCsrf();
      const result = await request(
        '/api/v1/auth/password-resets',
        PasswordResetCompleteResponseSchema,
        {
          method: 'POST',
          headers: { 'X-CSRF-Token': token },
          body: JSON.stringify(input),
        },
      );
      setCsrf(result.csrfToken);
      window.history.replaceState({}, '', window.location.pathname);
      await refreshWorkspace();
      setStatus({ kind: 'success', message: 'Password updated. You are signed in.' });
    } catch (error: unknown) {
      setStatus({
        kind: 'error',
        message: error instanceof Error ? error.message : 'Unable to update the password.',
      });
    }
  }
  async function submitOnboarding(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus({ kind: 'pending', message: 'Saving business details…' });
    try {
      const values = formValues(event.currentTarget);
      const result = await request('/api/v1/workspace', WorkspaceResponseSchema, {
        method: 'PATCH',
        headers: { 'X-CSRF-Token': csrf },
        body: JSON.stringify({
          ...values,
          followUpDays: Number(values.followUpDays),
        }),
      });
      setWorkspace(result);
      setScreen('today');
      setStatus({ kind: 'success', message: 'Business setup saved.' });
    } catch (error) {
      setStatus({
        kind: 'error',
        message: error instanceof Error ? error.message : 'Unable to save setup.',
      });
    }
  }
  async function submitCustomer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus({ kind: 'pending', message: 'Saving enquiry…' });
    try {
      const values = formValues(event.currentTarget);
      const input = CreateCustomerRequestSchema.parse({
        ...values,
        quotedMinorUnits: values.quotedMinorUnits ? Number(values.quotedMinorUnits) : undefined,
      });
      await request('/api/v1/customers', CustomerResponseSchema, {
        method: 'POST',
        headers: { 'X-CSRF-Token': csrf },
        body: JSON.stringify(input),
      });
      setShowCustomer(false);
      setStatus({ kind: 'success', message: 'Enquiry saved to Today.' });
      await refreshToday();
    } catch (error) {
      setStatus({
        kind: 'error',
        message: error instanceof Error ? error.message : 'Unable to save enquiry.',
      });
    }
  }
  async function submitBooking(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    setStatus({ kind: 'pending', message: 'Recording booking…' });
    try {
      const values = formValues(event.currentTarget);
      const command = {
        customerId: selected.id,
        service: values.service,
        appointmentAt: localDateTimeToUtc(values.appointmentAt, workspace?.timezone || 'UTC'),
        agreedMinorUnits: Number(values.agreedMinorUnits),
        currency: workspace?.currency || 'USD',
        notes: values.notes || '',
      };
      const validated = CreateBookingRequestSchema.parse(command);
      const fingerprint = commandIdFor(validated);
      if (!bookingSubmission.current || bookingSubmission.current.fingerprint !== fingerprint)
        bookingSubmission.current = { fingerprint, key: crypto.randomUUID() };
      await request('/api/v1/bookings', BookingResponseSchema, {
        method: 'POST',
        headers: {
          'X-CSRF-Token': csrf,
          'Idempotency-Key': bookingSubmission.current.key,
        },
        body: JSON.stringify(validated),
      });
      bookingSubmission.current = null;
      setShowBooking(false);
      setSelected(null);
      setStatus({ kind: 'success', message: 'Booking recorded. The enquiry moved out of Today.' });
      await refreshToday();
    } catch (error) {
      setStatus({
        kind: 'error',
        message: error instanceof Error ? error.message : 'Unable to record booking.',
      });
    }
  }
  async function signOut() {
    setStatus({ kind: 'pending', message: 'Signing out…' });
    try {
      await request('/api/v1/auth/sign-out', z.null(), {
        method: 'POST',
        headers: { 'X-CSRF-Token': csrf },
      });
      setScreen('auth');
      setWorkspace(null);
      setToday([]);
      setResults(null);
      await refreshCsrf();
      setStatus({ kind: 'success', message: 'Signed out.' });
    } catch (error) {
      setStatus({
        kind: 'error',
        message: error instanceof Error ? error.message : 'Unable to sign out.',
      });
    }
  }

  function finishDeletion() {
    setScreen('auth');
    setWorkspace(null);
    setToday([]);
    setResults(null);
    setBookings([]);
    setStatus({ kind: 'success', message: 'Account and workspace deleted.' });
    void refreshCsrf();
  }

  if (screen === 'auth')
    return (
      <main className="auth-shell">
        <section className="auth-context">
          <h1>Turn enquiries into booked appointments with a clear next action.</h1>
          <p>
            Capture the original context, respect contact permission, and keep recorded outcomes
            connected to the work.
          </p>
        </section>
        <section className="panel auth-panel">
          <h2>
            {authMode === 'register'
              ? 'Start with one reliable register.'
              : authMode === 'sign-in'
                ? 'Sign in to Today.'
                : authMode === 'request-reset'
                  ? 'Reset your password.'
                  : 'Choose a new password.'}
          </h2>
          {authMode === 'request-reset' ? (
            <form onSubmit={submitPasswordResetRequest}>
              <p className="intro">
                Enter the account email. We will send a single-use link if it matches an account.
              </p>
              <Field label="Email" name="email" type="email" />
              <button className="button primary" disabled={status.kind === 'pending'}>
                {status.kind === 'pending' ? 'Preparing…' : 'Send reset instructions'}
              </button>
            </form>
          ) : authMode === 'complete-reset' ? (
            <form onSubmit={submitPasswordReset}>
              <p className="intro">Use at least 12 characters. This link works once.</p>
              <Field label="New password" name="password" type="password" />
              <Field label="Confirm new password" name="confirmPassword" type="password" />
              <button className="button primary" disabled={status.kind === 'pending'}>
                {status.kind === 'pending' ? 'Updating…' : 'Update password'}
              </button>
            </form>
          ) : (
            <form onSubmit={submitAuth}>
              {authMode === 'register' && <Field label="Business name" name="businessName" />}
              <Field label="Email" name="email" type="email" />
              <Field label="Password" name="password" type="password" />
              <button className="button primary" disabled={status.kind === 'pending'}>
                {status.kind === 'pending'
                  ? 'Working…'
                  : authMode === 'register'
                    ? 'Create account'
                    : 'Sign in'}
              </button>
            </form>
          )}
          <div className="auth-links">
            <button
              type="button"
              className="text-button"
              onClick={() => {
                setStatus({ kind: 'idle' });
                setAuthMode(authMode === 'register' ? 'sign-in' : 'register');
              }}
            >
              {authMode === 'register'
                ? 'Already have an account? Sign in.'
                : 'Need an account? Register.'}
            </button>
            {authMode === 'sign-in' ? (
              <button
                type="button"
                className="text-button"
                onClick={() => {
                  setStatus({ kind: 'idle' });
                  setAuthMode('request-reset');
                }}
              >
                Forgot password?
              </button>
            ) : null}
            {authMode === 'request-reset' || authMode === 'complete-reset' ? (
              <button
                type="button"
                className="text-button"
                onClick={() => {
                  setStatus({ kind: 'idle' });
                  setResetToken('');
                  setAuthMode('sign-in');
                }}
              >
                Back to sign in
              </button>
            ) : null}
          </div>
          <StatusLine status={status} />
        </section>
      </main>
    );
  if (screen === 'onboarding')
    return (
      <main className="app-shell">
        <header className="topbar">
          <div>
            <h1>Make the workspace useful today.</h1>
          </div>
        </header>
        <section className="panel form-panel">
          <p className="intro">These defaults shape your daily queue. You can change them later.</p>
          <form onSubmit={submitOnboarding}>
            <div className="form-grid">
              <Field
                label="Business name"
                name="businessName"
                defaultValue={workspace?.businessName || ''}
              />
              <Field label="Business category" name="category" defaultValue="Salon" />
              <Field label="Timezone" name="timezone" defaultValue="America/Los_Angeles" />
              <Field label="Currency" name="currency" defaultValue="USD" />
              <Field label="Default country code" name="defaultCountryCode" defaultValue="+1" />
              <Field
                label="Booking link (optional)"
                name="bookingLink"
                defaultValue=""
                required={false}
              />
              <Field
                label="Follow-up after (days)"
                name="followUpDays"
                type="number"
                defaultValue="3"
              />
            </div>
            <button className="button primary" disabled={status.kind === 'pending'}>
              {status.kind === 'pending' ? 'Saving…' : 'Save and open Today'}
            </button>
          </form>
          <StatusLine status={status} />
        </section>
      </main>
    );
  if (screen === 'customers')
    return (
      <CustomersView
        csrf={csrf}
        businessName={workspace?.businessName ?? 'Growth OS'}
        isDemo={workspace?.isDemo ?? false}
        status={status}
        setStatus={setStatus}
        onNavigate={navigate}
        onSignOut={signOut}
      />
    );
  if (screen === 'campaigns')
    return (
      <CampaignsView
        csrf={csrf}
        businessName={workspace?.businessName ?? 'Growth OS'}
        isDemo={workspace?.isDemo ?? false}
        status={status}
        setStatus={setStatus}
        onNavigate={navigate}
        onSignOut={signOut}
      />
    );
  if (screen === 'reviews' && workspace)
    return (
      <ReviewsView
        csrf={csrf}
        businessName={workspace.businessName}
        isDemo={workspace.isDemo}
        responseTemplate={workspace.reviewResponseTemplate}
        status={status}
        setStatus={setStatus}
        onNavigate={navigate}
        onSignOut={signOut}
      />
    );
  if (screen === 'results' && workspace)
    return (
      <ResultsView
        businessName={workspace.businessName}
        isDemo={workspace.isDemo}
        timezone={workspace.timezone}
        status={status}
        setStatus={setStatus}
        onNavigate={navigate}
        onSignOut={signOut}
      />
    );
  if (screen === 'settings' && workspace)
    return (
      <SettingsView
        csrf={csrf}
        workspace={workspace}
        status={status}
        setStatus={setStatus}
        onNavigate={navigate}
        onSignOut={signOut}
        onWorkspaceUpdated={setWorkspace}
        onDeleted={finishDeletion}
      />
    );
  return (
    <main className="app-shell">
      <AppNav
        active="today"
        businessName={workspace?.businessName ?? 'Growth OS'}
        isDemo={workspace?.isDemo ?? false}
        onNavigate={navigate}
        onSignOut={signOut}
        signOutPending={status.kind === 'pending'}
      />
      <header className="topbar">
        <div>
          <h1 id="screen-title" tabIndex={-1}>
            Who needs attention?
          </h1>
        </div>
      </header>
      <section className="summary-row">
        <div>
          <span>New enquiries</span>
          <strong>{results?.newEnquiries ?? 0}</strong>
        </div>
        <div>
          <span>Bookings recorded</span>
          <strong>{results?.bookingsRecorded ?? 0}</strong>
        </div>
        <div>
          <span>Recorded value</span>
          <strong>
            {results
              ? `${results.recordedBookingValue.currency} ${(results.recordedBookingValue.minorUnits / 100).toFixed(2)}`
              : '—'}
          </strong>
        </div>
      </section>
      <section className="panel results-panel" aria-labelledby="results-title">
        <div className="toolbar compact">
          <div>
            <h2 id="results-title">Results</h2>
            <p className="muted">Stored bookings and recorded value from the current workspace.</p>
          </div>
        </div>
        <div className="summary-row campaign-results" aria-label="Campaign results">
          <div>
            <span>Follow-ups prepared</span>
            <strong>{results?.followUpsPrepared ?? 0}</strong>
          </div>
          <div>
            <span>Marked sent</span>
            <strong>{results?.followUpsSent ?? 0}</strong>
          </div>
          <div>
            <span>Replies recorded</span>
            <strong>{results?.campaignReplies ?? 0}</strong>
          </div>
          <div>
            <span>Attributed bookings</span>
            <strong>{results?.campaignConversions ?? 0}</strong>
          </div>
        </div>
        {bookings.length === 0 ? (
          <p className="muted">No bookings recorded in this workspace yet.</p>
        ) : (
          <div className="booking-register">
            {bookings.map((booking) => (
              <div className="booking-record" key={booking.id}>
                <strong>{booking.service}</strong>
                <span>{new Date(booking.appointmentAt).toLocaleString()}</span>
                <span>
                  {booking.agreedMoney.currency} {(booking.agreedMoney.minorUnits / 100).toFixed(2)}
                </span>
                <span>{booking.state}</span>
              </div>
            ))}
          </div>
        )}
      </section>
      <div className="toolbar">
        <div>
          <h2>Priority register</h2>
          <p className="muted">
            Each reason is based on stored activity and consent. No hidden score.
          </p>
        </div>
        <button className="button primary" onClick={() => setShowCustomer(true)}>
          Add enquiry
        </button>
      </div>
      <section className="register">
        {today.length === 0 ? (
          <div className="empty">
            <h3>Nothing needs attention.</h3>
            <p>Add an enquiry to see the real workflow here.</p>
            <button className="button secondary" onClick={() => setShowCustomer(true)}>
              Add first enquiry
            </button>
          </div>
        ) : (
          today.map((customer) => (
            <button className="record" key={customer.id} onClick={() => setSelected(customer)}>
              <span className="record-main">
                <strong>
                  {customer.firstName} {customer.lastName}
                </strong>
                <span>
                  {customer.service} · {customer.source}
                </span>
              </span>
              <span className="record-reason">{customer.reasons?.join(' · ')}</span>
              <span className="record-next">{customer.nextAction}</span>
              <span className="record-value">
                {customer.quotedMoney
                  ? `${customer.quotedMoney.currency} ${(customer.quotedMoney.minorUnits / 100).toFixed(2)}`
                  : 'No quote'}
              </span>
            </button>
          ))
        )}
      </section>
      <StatusLine status={status} />
      <TodayDialogs
        selected={selected}
        showCustomer={showCustomer}
        showBooking={showBooking}
        status={status}
        onCloseCustomer={() => {
          setSelected(null);
          setShowCustomer(false);
        }}
        onOpenBooking={() => setShowBooking(true)}
        onCloseBooking={() => setShowBooking(false)}
        onCustomerSubmit={submitCustomer}
        onBookingSubmit={submitBooking}
      />
    </main>
  );
}
