'use client';

import { FormEvent, useEffect, useState } from 'react';
import { Ellipsis, FileUp, PlusCircle, Search, UsersRound } from 'lucide-react';
import { z } from 'zod';
import {
  CreateCustomerRequestSchema,
  CreateInteractionRequestSchema,
  CustomerDetailResponseSchema,
  CustomerImportCommitResponseSchema,
  CustomerImportPreviewResponseSchema,
  CustomerListResponseSchema,
  CustomerResponseSchema,
  InteractionResponseSchema,
  RecordConsentRequestSchema,
  UpdateCustomerRequestSchema,
} from '@growthos/contracts';
import { formValues, request } from './api-client';
import { AppNav, type AppScreen } from './app-nav';
import { Field, StatusLine, type Status } from './ui';
import { IconWell, TodayBadge } from './workspace-ui';

type Customer = ReturnType<typeof CustomerResponseSchema.parse>;
type Detail = ReturnType<typeof CustomerDetailResponseSchema.parse>;
type Preview = ReturnType<typeof CustomerImportPreviewResponseSchema.parse>;

export function CustomersView({
  csrf,
  businessName,
  isDemo,
  status,
  setStatus,
  onNavigate,
  onSignOut,
}: {
  csrf: string;
  businessName: string;
  isDemo: boolean;
  status: Status;
  setStatus: (status: Status) => void;
  onNavigate: (screen: AppScreen) => void;
  onSignOut: () => void;
}) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState('');
  const [lifecycle, setLifecycle] = useState('');
  const [selected, setSelected] = useState<Detail | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(true);
  const [csv, setCsv] = useState('');
  const [preview, setPreview] = useState<Preview | null>(null);
  const [mapping, setMapping] = useState<Record<string, string | null>>({});
  const [resolutions, setResolutions] = useState<Record<string, 'create' | 'skip'>>({});
  const [interaction, setInteraction] = useState('');

  async function loadCustomers() {
    const params = new URLSearchParams({ limit: '50' });
    if (search.trim()) params.set('q', search.trim());
    if (lifecycle) params.set('lifecycle', lifecycle);
    const result = await request(`/api/v1/customers?${params}`, CustomerListResponseSchema);
    setCustomers(result.items);
  }
  async function loadDetail(id: string) {
    setSelected(await request(`/api/v1/customers/${id}/detail`, CustomerDetailResponseSchema));
  }
  useEffect(() => {
    void loadCustomers().catch((error: unknown) =>
      setStatus({
        kind: 'error',
        message: error instanceof Error ? error.message : 'Unable to load customers.',
      }),
    );
  }, [search, lifecycle]);

  async function addCustomer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus({ kind: 'pending', message: 'Saving customer…' });
    try {
      const values = formValues(event.currentTarget);
      const input = CreateCustomerRequestSchema.parse({
        ...values,
        quotedMinorUnits: values.quotedMinorUnits ? Number(values.quotedMinorUnits) : undefined,
        serviceInterests: values.serviceInterests
          ? values.serviceInterests
              .split(',')
              .map((value) => value.trim())
              .filter(Boolean)
          : [],
      });
      const customer = await request('/api/v1/customers', CustomerResponseSchema, {
        method: 'POST',
        headers: { 'X-CSRF-Token': csrf },
        body: JSON.stringify(input),
      });
      setShowAdd(false);
      setStatus({ kind: 'success', message: `Saved ${customer.firstName} ${customer.lastName}.` });
      await loadCustomers();
    } catch (error: unknown) {
      setStatus({
        kind: 'error',
        message: error instanceof Error ? error.message : 'Unable to save customer.',
      });
    }
  }

  async function previewImport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus({ kind: 'pending', message: 'Checking import…' });
    try {
      const result = await request(
        '/api/v1/customer-imports/preview',
        CustomerImportPreviewResponseSchema,
        { method: 'POST', headers: { 'X-CSRF-Token': csrf }, body: JSON.stringify({ csv }) },
      );
      setPreview(result);
      setMapping(result.mapping);
      setResolutions({});
      setStatus({ kind: 'success', message: 'Preview ready. Resolve duplicates before creating.' });
    } catch (error: unknown) {
      setStatus({
        kind: 'error',
        message: error instanceof Error ? error.message : 'Unable to preview import.',
      });
    }
  }
  async function remapImport() {
    if (!preview) return;
    setStatus({ kind: 'pending', message: 'Rechecking mapping…' });
    try {
      const result = await request(
        '/api/v1/customer-imports/preview',
        CustomerImportPreviewResponseSchema,
        {
          method: 'POST',
          headers: { 'X-CSRF-Token': csrf },
          body: JSON.stringify({ csv, mapping }),
        },
      );
      setPreview(result);
      setMapping(result.mapping);
      setResolutions({});
      setStatus({
        kind: 'success',
        message: 'Mapping applied. Review duplicates before creating.',
      });
    } catch (error: unknown) {
      setStatus({
        kind: 'error',
        message: error instanceof Error ? error.message : 'Unable to apply mapping.',
      });
    }
  }
  async function commitImport() {
    if (!preview) return;
    setStatus({ kind: 'pending', message: 'Creating customers…' });
    try {
      const result = await request(
        `/api/v1/customer-imports/${preview.importId}/commit`,
        CustomerImportCommitResponseSchema,
        {
          method: 'POST',
          headers: { 'X-CSRF-Token': csrf },
          body: JSON.stringify({ resolutions }),
        },
      );
      setPreview(null);
      setCsv('');
      setShowImport(false);
      setStatus({
        kind: 'success',
        message: `Created ${result.created.length} customer${result.created.length === 1 ? '' : 's'}.`,
      });
      await loadCustomers();
    } catch (error: unknown) {
      setStatus({
        kind: 'error',
        message: error instanceof Error ? error.message : 'Unable to commit import.',
      });
    }
  }
  async function withdrawConsent() {
    if (!selected) return;
    const channel = selected.consent?.channel ?? 'email';
    try {
      const input = RecordConsentRequestSchema.parse({ channel, decision: 'withdrawn' });
      await request(
        `/api/v1/customers/${selected.id}/consents`,
        z.object({
          id: z.string(),
          channel: z.string(),
          decision: z.string(),
          capturedAt: z.string(),
        }),
        { method: 'POST', headers: { 'X-CSRF-Token': csrf }, body: JSON.stringify(input) },
      );
      await loadDetail(selected.id);
      setStatus({
        kind: 'success',
        message: 'Consent withdrawn. Contact eligibility is now suppressed.',
      });
    } catch (error: unknown) {
      setStatus({
        kind: 'error',
        message: error instanceof Error ? error.message : 'Unable to withdraw consent.',
      });
    }
  }
  async function saveLifecycle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    try {
      const values = formValues(event.currentTarget);
      const input = UpdateCustomerRequestSchema.parse({ lifecycle: values.lifecycle });
      await request(`/api/v1/customers/${selected.id}`, CustomerResponseSchema, {
        method: 'PATCH',
        headers: { 'X-CSRF-Token': csrf },
        body: JSON.stringify(input),
      });
      await loadDetail(selected.id);
      await loadCustomers();
      setStatus({ kind: 'success', message: 'Lifecycle updated.' });
    } catch (error: unknown) {
      setStatus({
        kind: 'error',
        message: error instanceof Error ? error.message : 'Unable to update lifecycle.',
      });
    }
  }
  async function addInteraction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    try {
      const input = CreateInteractionRequestSchema.parse({ kind: 'note', body: interaction });
      await request(`/api/v1/customers/${selected.id}/interactions`, InteractionResponseSchema, {
        method: 'POST',
        headers: { 'X-CSRF-Token': csrf },
        body: JSON.stringify(input),
      });
      setInteraction('');
      await loadDetail(selected.id);
      setStatus({ kind: 'success', message: 'Interaction added.' });
    } catch (error: unknown) {
      setStatus({
        kind: 'error',
        message: error instanceof Error ? error.message : 'Unable to add interaction.',
      });
    }
  }

  return (
    <main className="app-shell">
      <AppNav
        active="customers"
        businessName={businessName}
        isDemo={isDemo}
        onNavigate={onNavigate}
        onSignOut={onSignOut}
        signOutPending={status.kind === 'pending'}
      />
      <header className="topbar">
        <div>
          <h1 id="screen-title" tabIndex={-1}>
            Customers
          </h1>
          <p className="screen-intro">
            Manage your customers, view their status, and take the next best action.
          </p>
        </div>
        <TodayBadge />
      </header>
      <div className="toolbar">
        <div className="customer-filters">
          <label className="field customer-search">
            <span className="sr-only">Search</span>
            <Search aria-hidden="true" size={21} />
            <input
              aria-label="Search customers"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Name, phone, or email"
            />
          </label>
          <label className="field">
            <span>Lifecycle</span>
            <select
              aria-label="Filter lifecycle"
              value={lifecycle}
              onChange={(event) => setLifecycle(event.target.value)}
            >
              <option value="">All stages</option>
              {['enquiry', 'contacted', 'replied', 'booked', 'completed', 'lost'].map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div>
          <button className="button secondary" onClick={() => setShowAdd(!showAdd)}>
            <PlusCircle aria-hidden="true" size={20} />
            Add customer
          </button>{' '}
          <button
            className="button primary"
            onClick={() => {
              setShowImport(true);
              setPreview(null);
              requestAnimationFrame(() =>
                document.getElementById('customer-import')?.scrollIntoView(),
              );
            }}
          >
            <FileUp aria-hidden="true" size={20} />
            Import CSV
          </button>
        </div>
      </div>
      {showAdd && (
        <section className="panel customer-form">
          <h2>Add customer</h2>
          <form onSubmit={addCustomer}>
            <div className="form-grid">
              <Field label="First name" name="firstName" />
              <Field label="Last name" name="lastName" required={false} />
              <Field label="Phone" name="phone" inputMode="tel" />
              <Field label="Email" name="email" type="email" required={false} />
              <Field label="Source" name="source" defaultValue="manual" />
              <Field label="Service" name="service" />
              <Field
                label="Service interests (comma separated)"
                name="serviceInterests"
                required={false}
              />
            </div>
            <label className="field">
              <span>Internal notes</span>
              <textarea name="internalNotes" />
            </label>
            <div className="form-grid">
              <label className="field">
                <span>Consent channel</span>
                <select name="consentChannel" defaultValue="email">
                  <option value="email">Email</option>
                  <option value="phone">Phone</option>
                  <option value="sms">SMS</option>
                  <option value="whatsapp">WhatsApp</option>
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
            <button className="button primary">Save customer</button>
          </form>
        </section>
      )}
      <section className="customer-layout">
        <div className="panel customer-list">
          <div className="workspace-panel-heading">
            <IconWell>
              <UsersRound size={25} />
            </IconWell>
            <div>
              <h2>Customer register</h2>
              <p>
                Each customer's status is based on their activity and consent. No hidden scores.
              </p>
            </div>
            <span className="customer-count">
              {customers.length} customer{customers.length === 1 ? '' : 's'}
            </span>
          </div>
          {customers.length === 0 ? (
            <p className="muted">No customers match this search.</p>
          ) : (
            <div className="customer-table">
              <div className="customer-table-head" aria-hidden="true">
                <span>Customer</span>
                <span>Contact</span>
                <span>Service / Source</span>
                <span>Lifecycle</span>
                <span>Status</span>
                <span>Last activity</span>
                <span>Actions</span>
              </div>
              {customers.map((customer) => (
                <button
                  className="customer-row"
                  key={customer.id}
                  onClick={() => void loadDetail(customer.id)}
                  aria-label={`Open ${customer.firstName} ${customer.lastName}`}
                >
                  <span className="customer-name">
                    <span className="customer-avatar">
                      {customer.firstName.slice(0, 1)}
                      {customer.lastName.slice(0, 1)}
                    </span>
                    <strong>
                      {customer.firstName} {customer.lastName}
                    </strong>
                  </span>
                  <span>
                    {customer.phone}
                    <small>{customer.email || 'No email'}</small>
                  </span>
                  <span>
                    {customer.service}
                    <small>{customer.source}</small>
                  </span>
                  <span>
                    <span className={`lifecycle-pill ${customer.lifecycle}`}>
                      {customer.lifecycle}
                    </span>
                  </span>
                  <span>
                    <span
                      className={`eligibility-pill ${customer.contactEligible ? 'eligible' : 'suppressed'}`}
                    >
                      {customer.contactEligible ? 'Contact eligible' : 'Contact suppressed'}
                    </span>
                  </span>
                  <span>
                    {new Date(customer.lastInteractionAt).toLocaleDateString()}
                    <small>
                      {new Date(customer.lastInteractionAt).toLocaleTimeString([], {
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </small>
                  </span>
                  <span className="customer-more" aria-hidden="true">
                    <Ellipsis size={20} />
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
        {selected && (
          <section className="panel customer-detail">
            <div className="toolbar compact">
              <div>
                <h2>
                  {selected.firstName} {selected.lastName}
                </h2>
                <p className="muted">
                  {selected.phone} · {selected.email || 'No email'}
                </p>
                <p>
                  <strong>Contact eligibility:</strong>{' '}
                  {selected.contactEligible ? 'eligible' : 'suppressed'}
                </p>
              </div>
              <button className="button quiet" onClick={() => setSelected(null)}>
                Close
              </button>
            </div>
            <p>
              <strong>Service interests:</strong>{' '}
              {selected.serviceInterests.join(', ') || 'None recorded'}
            </p>
            <p>
              <strong>Internal notes:</strong> {selected.internalNotes || 'None recorded'}
            </p>
            <form onSubmit={saveLifecycle} className="inline-form">
              <label className="field">
                <span>Lifecycle</span>
                <select name="lifecycle" defaultValue={selected.lifecycle}>
                  {['enquiry', 'contacted', 'replied', 'booked', 'completed', 'lost'].map(
                    (value) => (
                      <option key={value}>{value}</option>
                    ),
                  )}
                </select>
              </label>
              <button className="button secondary">Update lifecycle</button>
            </form>
            <button className="button secondary" onClick={() => void withdrawConsent()}>
              Withdraw consent
            </button>
            <h3>Interaction history</h3>
            <form onSubmit={addInteraction}>
              <label className="field">
                <span>Add internal note</span>
                <textarea
                  value={interaction}
                  onChange={(event) => setInteraction(event.target.value)}
                  required
                />
              </label>
              <button className="button secondary">Add note</button>
            </form>
            {selected.interactions.map((item) => (
              <div className="history-item" key={item.id}>
                <strong>{item.kind}</strong>
                <span>{item.body}</span>
                <small>{new Date(item.occurredAt).toLocaleString()}</small>
              </div>
            ))}
            <h3>Consent history</h3>
            {selected.consentHistory.map((consent) => (
              <div className="history-item" key={consent.id}>
                <strong>{consent.channel}</strong>
                <span>{consent.decision}</span>
                <small>{new Date(consent.capturedAt).toLocaleString()}</small>
              </div>
            ))}
          </section>
        )}
      </section>
      {showImport && !preview?.importId && (
        <section id="customer-import" className="panel customer-form customer-import-form">
          <div className="workspace-panel-heading">
            <IconWell>
              <FileUp size={24} />
            </IconWell>
            <div>
              <h2>Import CSV</h2>
              <p>
                Import customers from a CSV file by pasting the contents below. Required columns:
                first name, phone, source, and service. Duplicate rows require a deliberate choice.
              </p>
            </div>
          </div>
          <form onSubmit={previewImport}>
            <label className="field">
              <span>CSV contents</span>
              <textarea
                aria-label="CSV contents"
                rows={4}
                value={csv}
                onChange={(event) => setCsv(event.target.value)}
                placeholder="first name,phone,source,service\nAda,+15551212,website,Consultation"
              />
            </label>
            <button className="button primary">
              <FileUp size={19} aria-hidden="true" />
              Preview import
            </button>
          </form>
        </section>
      )}
      {preview?.importId && (
        <section className="panel customer-form">
          <h2>Review import</h2>
          <div className="form-grid import-mapping">
            {Object.keys(mapping).map((field) => (
              <label className="field" key={field}>
                <span>{field} column</span>
                <select
                  value={mapping[field] ?? ''}
                  onChange={(event) =>
                    setMapping({ ...mapping, [field]: event.target.value || null })
                  }
                >
                  <option value="">Not mapped</option>
                  {preview.headers.map((header) => (
                    <option key={header} value={header}>
                      {header}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          <button className="button secondary" type="button" onClick={() => void remapImport()}>
            Apply column mapping
          </button>
          <div className="import-review">
            {preview.rows.map((row) => (
              <div className="import-row" key={row.rowNumber}>
                <strong>Row {row.rowNumber}</strong>
                <span>
                  {row.values.firstName} {row.values.lastName}
                </span>
                <span>{row.values.phone}</span>
                <span>
                  {row.errors.join(', ') ||
                    (row.duplicates.length
                      ? `Possible duplicate: ${row.duplicates.map((duplicate) => duplicate.matchedOn.join(' + ')).join(', ')}`
                      : 'Ready')}
                </span>
                {row.duplicates.length > 0 && (
                  <span>
                    <button
                      className="button quiet"
                      type="button"
                      onClick={() => setResolutions({ ...resolutions, [row.rowNumber]: 'create' })}
                    >
                      Create separately
                    </button>{' '}
                    <button
                      className="button quiet"
                      type="button"
                      onClick={() => setResolutions({ ...resolutions, [row.rowNumber]: 'skip' })}
                    >
                      Skip
                    </button>{' '}
                    <b>{resolutions[String(row.rowNumber)] ?? 'Choose'}</b>
                  </span>
                )}
              </div>
            ))}
          </div>
          <button className="button primary" onClick={commitImport}>
            Confirm import
          </button>
        </section>
      )}
      <StatusLine status={status} />
    </main>
  );
}
