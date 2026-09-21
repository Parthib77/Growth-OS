'use client';

import { FormEvent, useEffect, useState } from 'react';

type Status = { kind: 'idle' | 'pending' | 'success' | 'error'; message?: string };
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
  businessName: string;
  category: string | null;
  timezone: string;
  currency: string;
  defaultCountryCode: string;
  followUpDays: number;
  onboardingComplete: boolean;
};
type Results = {
  newEnquiries: number;
  bookingsRecorded: number;
  recordedBookingValue: { currency: string; minorUnits: number };
};

async function api(path: string, init: RequestInit = {}) {
  const response = await fetch(path, {
    credentials: 'include',
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init.headers || {}) },
  });
  const data = (response.status === 204 ? null : await response.json()) as any;
  if (!response.ok) throw new Error(data?.error?.message || 'Something went wrong. Try again.');
  return data;
}

function Field({
  label,
  name,
  type = 'text',
  defaultValue = '',
  required = true,
}: {
  label: string;
  name: string;
  type?: string;
  defaultValue?: string;
  required?: boolean;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <input name={name} type={type} defaultValue={defaultValue} required={required} />
    </label>
  );
}

export default function Home() {
  const [csrf, setCsrf] = useState('');
  const [authMode, setAuthMode] = useState<'register' | 'sign-in'>('register');
  const [screen, setScreen] = useState<'auth' | 'onboarding' | 'today'>('auth');
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [today, setToday] = useState<Customer[]>([]);
  const [results, setResults] = useState<Results | null>(null);
  const [selected, setSelected] = useState<Customer | null>(null);
  const [showCustomer, setShowCustomer] = useState(false);
  const [showBooking, setShowBooking] = useState(false);

  async function refreshCsrf() {
    const value = await api('/api/v1/auth/csrf');
    setCsrf(value.csrfToken);
    return value.csrfToken as string;
  }
  async function refreshWorkspace() {
    const current = await api('/api/v1/workspace');
    setWorkspace(current);
    setScreen(current.onboardingComplete ? 'today' : 'onboarding');
  }
  async function refreshToday() {
    const [queue, report] = await Promise.all([api('/api/v1/today'), api('/api/v1/results')]);
    setToday(queue.items);
    setResults(report);
  }
  useEffect(() => {
    void refreshCsrf().then(() =>
      api('/api/v1/session')
        .then(refreshWorkspace)
        .catch(() => undefined),
    );
  }, []);
  useEffect(() => {
    if (screen === 'today')
      void refreshToday().catch((error) => setStatus({ kind: 'error', message: error.message }));
  }, [screen]);

  async function submitAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus({ kind: 'pending', message: 'Signing you in…' });
    const form = new FormData(event.currentTarget);
    try {
      const token = csrf || (await refreshCsrf());
      const result = await api(`/api/v1/auth/${authMode === 'register' ? 'register' : 'sign-in'}`, {
        method: 'POST',
        headers: { 'X-CSRF-Token': token },
        body: JSON.stringify(Object.fromEntries(form.entries())),
      });
      setCsrf(result.csrfToken || token);
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
  async function submitOnboarding(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus({ kind: 'pending', message: 'Saving business details…' });
    try {
      const result = await api('/api/v1/workspace', {
        method: 'PATCH',
        headers: { 'X-CSRF-Token': csrf },
        body: JSON.stringify({
          ...Object.fromEntries(new FormData(event.currentTarget).entries()),
          followUpDays: Number(new FormData(event.currentTarget).get('followUpDays')),
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
      const input = Object.fromEntries(new FormData(event.currentTarget).entries()) as Record<
        string,
        string
      >;
      await api('/api/v1/customers', {
        method: 'POST',
        headers: { 'X-CSRF-Token': csrf },
        body: JSON.stringify({
          ...input,
          quotedMinorUnits: input.quotedMinorUnits ? Number(input.quotedMinorUnits) : undefined,
        }),
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
      const input = Object.fromEntries(new FormData(event.currentTarget).entries()) as Record<
        string,
        string
      >;
      await api('/api/v1/bookings', {
        method: 'POST',
        headers: { 'X-CSRF-Token': csrf, 'Idempotency-Key': crypto.randomUUID() },
        body: JSON.stringify({
          ...input,
          customerId: selected.id,
          appointmentAt: new Date(input.appointmentAt).toISOString(),
          agreedMinorUnits: Number(input.agreedMinorUnits),
          currency: workspace?.currency || 'USD',
        }),
      });
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
      await api('/api/v1/auth/sign-out', { method: 'POST', headers: { 'X-CSRF-Token': csrf } });
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

  if (screen === 'auth')
    return (
      <main className="auth-shell">
        <section className="auth-context">
          <p className="eyebrow">Growth OS / daily operations</p>
          <h1>Turn enquiries into booked appointments with a clear next action.</h1>
          <p>
            Capture the original context, respect contact permission, and keep recorded outcomes
            connected to the work.
          </p>
        </section>
        <section className="panel auth-panel">
          <p className="eyebrow">{authMode === 'register' ? 'Create workspace' : 'Welcome back'}</p>
          <h2>
            {authMode === 'register' ? 'Start with one reliable register.' : 'Sign in to Today.'}
          </h2>
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
          <button
            className="text-button"
            onClick={() => setAuthMode(authMode === 'register' ? 'sign-in' : 'register')}
          >
            {authMode === 'register'
              ? 'Already have an account? Sign in.'
              : 'Need an account? Register.'}
          </button>
          <StatusLine status={status} />
        </section>
      </main>
    );
  if (screen === 'onboarding')
    return (
      <main className="app-shell">
        <header className="topbar">
          <div>
            <p className="eyebrow">Growth OS / setup</p>
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
  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">{workspace?.businessName || 'Growth OS'} / Today</p>
          <h1>Who needs attention?</h1>
        </div>
        <button className="button quiet" onClick={signOut}>
          Sign out
        </button>
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
      {selected && (
        <div className="dialog-backdrop" role="presentation">
          <section
            className="dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="customer-title"
          >
            <button
              className="close"
              onClick={() => setSelected(null)}
              aria-label="Close customer details"
            >
              Close
            </button>
            <p className="eyebrow">Enquiry detail</p>
            <h2 id="customer-title">
              {selected.firstName} {selected.lastName}
            </h2>
            <dl className="facts">
              <div>
                <dt>Service</dt>
                <dd>{selected.service}</dd>
              </div>
              <div>
                <dt>Source</dt>
                <dd>{selected.source}</dd>
              </div>
              <div>
                <dt>Consent</dt>
                <dd>
                  {selected.consent?.decision === 'granted'
                    ? `Granted for ${selected.consent.channel}`
                    : 'Needs review'}
                </dd>
              </div>
              <div>
                <dt>Quoted value</dt>
                <dd>
                  {selected.quotedMoney
                    ? `${selected.quotedMoney.currency} ${(selected.quotedMoney.minorUnits / 100).toFixed(2)}`
                    : 'Not provided'}
                </dd>
              </div>
            </dl>
            <p className="reason-box">
              <strong>Why this is here</strong>
              <br />
              {selected.reasons?.join(' · ')}
            </p>
            {selected.consent?.decision === 'granted' && (
              <button className="button primary" onClick={() => setShowBooking(true)}>
                Record booking
              </button>
            )}
            <p className="muted small">
              A booking is stored with an idempotency key and appears in Results.
            </p>
          </section>
        </div>
      )}
      {showCustomer && (
        <div className="dialog-backdrop">
          <section
            className="dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="customer-form-title"
          >
            <button
              className="close"
              onClick={() => setShowCustomer(false)}
              aria-label="Close add enquiry"
            >
              Close
            </button>
            <h2 id="customer-form-title">Add an enquiry</h2>
            <form onSubmit={submitCustomer}>
              <div className="form-grid">
                <Field label="First name" name="firstName" />
                <Field label="Last name" name="lastName" required={false} />
                <Field label="Phone" name="phone" />
                <Field label="Email" name="email" type="email" required={false} />
                <Field label="Service" name="service" defaultValue="Consultation" />
                <Field label="Source" name="source" defaultValue="Phone call" />
                <Field
                  label="Quoted value (cents)"
                  name="quotedMinorUnits"
                  type="number"
                  required={false}
                />
                <label className="field">
                  <span>Consent channel</span>
                  <select name="consentChannel" defaultValue="whatsapp">
                    <option value="whatsapp">WhatsApp</option>
                    <option value="phone">Phone</option>
                    <option value="sms">SMS</option>
                    <option value="email">Email</option>
                  </select>
                </label>
                <label className="field">
                  <span>Consent decision</span>
                  <select name="consentDecision" defaultValue="granted">
                    <option value="granted">Granted</option>
                    <option value="withdrawn">Withdrawn</option>
                  </select>
                </label>
              </div>
              <button className="button primary" disabled={status.kind === 'pending'}>
                {status.kind === 'pending' ? 'Saving…' : 'Save enquiry'}
              </button>
            </form>
          </section>
        </div>
      )}
      {showBooking && selected && (
        <div className="dialog-backdrop">
          <section
            className="dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="booking-title"
          >
            <button
              className="close"
              onClick={() => setShowBooking(false)}
              aria-label="Close booking form"
            >
              Close
            </button>
            <h2 id="booking-title">Record booking</h2>
            <form onSubmit={submitBooking}>
              <Field label="Service" name="service" defaultValue={selected.service} />
              <Field label="Appointment" name="appointmentAt" type="datetime-local" />
              <Field
                label="Agreed value (cents)"
                name="agreedMinorUnits"
                type="number"
                defaultValue={String(selected.quotedMoney?.minorUnits || 0)}
              />
              <label className="field">
                <span>Notes</span>
                <textarea name="notes" rows={3} />
              </label>
              <button className="button primary" disabled={status.kind === 'pending'}>
                {status.kind === 'pending' ? 'Recording…' : 'Record booking'}
              </button>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}

function StatusLine({ status }: { status: Status }) {
  return status.kind === 'idle' ? null : (
    <p className={`status ${status.kind}`} role={status.kind === 'error' ? 'alert' : 'status'}>
      {status.message}
    </p>
  );
}
