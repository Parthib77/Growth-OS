'use client';

import { useEffect, useRef, useState } from 'react';
import {
  CampaignAuditResponseSchema,
  CampaignListResponseSchema,
  CampaignOutcomeResponseSchema,
  CampaignRecipientListResponseSchema,
  CampaignRecipientResponseSchema,
  CampaignResponseSchema,
  CreateCampaignRequestSchema,
  UpdateCampaignRequestSchema,
  WhatsAppLinkResponseSchema,
} from '@growthos/contracts';
import { request } from './api-client';
import { Field, StatusLine, type Status } from './ui';

type Campaign = ReturnType<typeof CampaignResponseSchema.parse>;
type Recipient = ReturnType<typeof CampaignRecipientListResponseSchema.parse>['items'][number];
type AuditItem = ReturnType<typeof CampaignAuditResponseSchema.parse>['items'][number];

type Props = {
  csrf: string;
  status: Status;
  setStatus: (status: Status) => void;
  onBack: () => void;
};

async function campaignRequest<T>(
  path: string,
  schema: { parse: (value: unknown) => T },
  init: RequestInit = {},
) {
  const response = await fetch(path, {
    credentials: 'include',
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  });
  const data: unknown = response.status === 204 ? null : await response.json();
  if (!response.ok)
    throw new Error(
      (data as { error?: { message?: string } })?.error?.message ?? 'Campaign request failed.',
    );
  return { data: schema.parse(data), etag: response.headers.get('etag') ?? '' };
}

export function CampaignsView({ csrf, status, setStatus, onBack }: Props) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selected, setSelected] = useState<Campaign | null>(null);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [auditItems, setAuditItems] = useState<AuditItem[]>([]);
  const [etag, setEtag] = useState('');
  const [name, setName] = useState('');
  const [template, setTemplate] = useState(
    'Hi {first_name}, your {service} at {business_name} is ready.',
  );
  const [lifecycle, setLifecycle] = useState('');
  const [service, setService] = useState('');
  const [source, setSource] = useState('');
  const [bookingIdByRecipient, setBookingIdByRecipient] = useState<Record<string, string>>({});
  const outcomeSubmission = useRef<Record<string, { fingerprint: string; key: string }>>({});

  async function loadCampaigns() {
    const result = await request('/api/v1/campaigns', CampaignListResponseSchema);
    setCampaigns(result.items);
  }
  async function loadAudit(campaignId: string) {
    const audit = await request(
      `/api/v1/campaigns/${campaignId}/audit`,
      CampaignAuditResponseSchema,
    );
    setAuditItems(audit.items);
  }
  async function openCampaign(id: string) {
    const [detail, list, audit] = await Promise.all([
      campaignRequest(`/api/v1/campaigns/${id}`, CampaignResponseSchema),
      request(`/api/v1/campaigns/${id}/recipients?limit=100`, CampaignRecipientListResponseSchema),
      request(`/api/v1/campaigns/${id}/audit`, CampaignAuditResponseSchema),
    ]);
    setSelected(detail.data);
    setEtag(detail.etag);
    setName(detail.data.name);
    setTemplate(detail.data.template);
    setLifecycle(detail.data.audience.lifecycle ?? '');
    setService(detail.data.audience.service ?? '');
    setSource(detail.data.audience.source ?? '');
    setRecipients(list.items);
    setAuditItems(audit.items);
  }
  useEffect(() => {
    void loadCampaigns().catch((error: unknown) =>
      setStatus({
        kind: 'error',
        message: error instanceof Error ? error.message : 'Unable to load campaigns.',
      }),
    );
  }, [setStatus]);

  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus({ kind: 'pending', message: 'Saving campaign draft…' });
    try {
      const input = CreateCampaignRequestSchema.parse({
        name,
        channel: 'whatsapp',
        template,
        audience: {
          consentChannel: 'whatsapp',
          ...(lifecycle ? { lifecycle } : {}),
          ...(service ? { service } : {}),
          ...(source ? { source } : {}),
        },
      });
      const result = await campaignRequest('/api/v1/campaigns', CampaignResponseSchema, {
        method: 'POST',
        headers: { 'X-CSRF-Token': csrf },
        body: JSON.stringify(input),
      });
      setSelected(result.data);
      setEtag(result.etag);
      setRecipients([]);
      await Promise.all([loadCampaigns(), loadAudit(result.data.id)]);
      setStatus({ kind: 'success', message: 'Draft saved. Review recipients when ready.' });
    } catch (error: unknown) {
      setStatus({
        kind: 'error',
        message: error instanceof Error ? error.message : 'Unable to save draft.',
      });
    }
  }
  async function saveDraft() {
    if (!selected || !etag) return;
    setStatus({ kind: 'pending', message: 'Updating campaign draft…' });
    try {
      const input = UpdateCampaignRequestSchema.parse({
        version: selected.version,
        name,
        template,
        audience: {
          consentChannel: 'whatsapp',
          ...(lifecycle ? { lifecycle } : {}),
          ...(service ? { service } : {}),
          ...(source ? { source } : {}),
        },
      });
      const result = await campaignRequest(
        `/api/v1/campaigns/${selected.id}`,
        CampaignResponseSchema,
        {
          method: 'PATCH',
          headers: { 'X-CSRF-Token': csrf, 'If-Match': etag },
          body: JSON.stringify(input),
        },
      );
      setSelected(result.data);
      setEtag(result.etag);
      await Promise.all([loadCampaigns(), loadAudit(result.data.id)]);
      setStatus({ kind: 'success', message: 'Draft updated; review is required again.' });
    } catch (error: unknown) {
      setStatus({
        kind: 'error',
        message: error instanceof Error ? error.message : 'Unable to update draft.',
      });
    }
  }
  async function refresh() {
    if (!selected || !etag) return;
    setStatus({ kind: 'pending', message: 'Checking consent and preparing recipients…' });
    try {
      const result = await campaignRequest(
        `/api/v1/campaigns/${selected.id}/recipients/refresh`,
        CampaignRecipientListResponseSchema,
        {
          method: 'POST',
          headers: { 'X-CSRF-Token': csrf, 'If-Match': etag },
          body: JSON.stringify({ version: selected.version }),
        },
      );
      setRecipients(result.data.items);
      const [detail] = await Promise.all([
        campaignRequest(`/api/v1/campaigns/${selected.id}`, CampaignResponseSchema),
        loadAudit(selected.id),
      ]);
      setSelected(detail.data);
      setEtag(detail.etag);
      setStatus({
        kind: 'success',
        message: `${result.data.items.filter((item) => item.eligibility === 'eligible').length} eligible recipient(s) prepared.`,
      });
    } catch (error: unknown) {
      setStatus({
        kind: 'error',
        message: error instanceof Error ? error.message : 'Unable to prepare recipients.',
      });
    }
  }
  async function transition(to: 'ready' | 'active' | 'completed' | 'cancelled') {
    if (!selected || !etag) return;
    try {
      const result = await campaignRequest(
        `/api/v1/campaigns/${selected.id}/transition`,
        CampaignResponseSchema,
        {
          method: 'POST',
          headers: { 'X-CSRF-Token': csrf, 'If-Match': etag },
          body: JSON.stringify({ version: selected.version, to }),
        },
      );
      setSelected(result.data);
      setEtag(result.etag);
      await Promise.all([loadCampaigns(), loadAudit(result.data.id)]);
      setStatus({ kind: 'success', message: `Campaign marked ${to}.` });
    } catch (error: unknown) {
      setStatus({
        kind: 'error',
        message: error instanceof Error ? error.message : 'Unable to change campaign status.',
      });
    }
  }
  async function remove(recipient: Recipient) {
    if (!selected || !etag) return;
    try {
      await campaignRequest(
        `/api/v1/campaigns/${selected.id}/recipients/${recipient.id}/remove`,
        CampaignRecipientResponseSchema,
        {
          method: 'POST',
          headers: { 'X-CSRF-Token': csrf, 'If-Match': etag },
          body: JSON.stringify({ campaignVersion: selected.version }),
        },
      );
      await openCampaign(selected.id);
      setStatus({ kind: 'success', message: 'Recipient removed from this campaign.' });
    } catch (error: unknown) {
      setStatus({
        kind: 'error',
        message: error instanceof Error ? error.message : 'Unable to remove recipient.',
      });
    }
  }
  async function link(recipient: Recipient) {
    if (!selected) return;
    try {
      const result = await request(
        `/api/v1/campaigns/${selected.id}/recipients/${recipient.id}/whatsapp-link`,
        WhatsAppLinkResponseSchema,
      );
      window.open(result.href, '_blank', 'noopener,noreferrer');
    } catch (error: unknown) {
      setStatus({
        kind: 'error',
        message: error instanceof Error ? error.message : 'This recipient is no longer eligible.',
      });
    }
  }
  async function outcome(recipient: Recipient, value: 'sent' | 'skipped' | 'replied' | 'booked') {
    if (!selected) return;
    try {
      const recipientBookingId = bookingIdByRecipient[recipient.id] ?? '';
      const body =
        value === 'booked' ? { outcome: value, bookingId: recipientBookingId } : { outcome: value };
      const key = `${recipient.id}:${value}`;
      const fingerprint = JSON.stringify(body);
      if (outcomeSubmission.current[key]?.fingerprint !== fingerprint)
        outcomeSubmission.current[key] = { fingerprint, key: crypto.randomUUID() };
      await request(
        `/api/v1/campaigns/${selected.id}/recipients/${recipient.id}/outcome`,
        CampaignOutcomeResponseSchema,
        {
          method: 'POST',
          headers: { 'X-CSRF-Token': csrf, 'Idempotency-Key': outcomeSubmission.current[key].key },
          body: JSON.stringify(body),
        },
      );
      delete outcomeSubmission.current[key];
      await openCampaign(selected.id);
      setStatus({ kind: 'success', message: `Outcome recorded: ${value}.` });
    } catch (error: unknown) {
      setStatus({
        kind: 'error',
        message: error instanceof Error ? error.message : 'Unable to record outcome.',
      });
    }
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Growth OS / campaigns</p>
          <h1>Permission-aware follow-up</h1>
        </div>
        <button className="button quiet" onClick={onBack}>
          Back to Today
        </button>
      </header>
      <div className="campaign-layout">
        <section className="panel campaign-composer" aria-labelledby="campaign-composer-title">
          <p className="eyebrow">WhatsApp preparation</p>
          <h2 id="campaign-composer-title">Create a campaign draft</h2>
          <form onSubmit={create}>
            <Field
              label="Campaign name"
              name="campaign-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
            <label className="field">
              <span>Audience lifecycle (optional)</span>
              <select value={lifecycle} onChange={(event) => setLifecycle(event.target.value)}>
                <option value="">Any lifecycle</option>
                <option value="enquiry">Enquiry</option>
                <option value="contacted">Contacted</option>
                <option value="replied">Replied</option>
                <option value="booked">Booked</option>
                <option value="completed">Completed</option>
                <option value="lost">Lost</option>
              </select>
            </label>
            <Field
              label="Service interest (optional)"
              name="campaign-service"
              required={false}
              value={service}
              onChange={(event) => setService(event.target.value)}
            />
            <Field
              label="Source (optional)"
              name="campaign-source"
              required={false}
              value={source}
              onChange={(event) => setSource(event.target.value)}
            />
            <label className="field">
              <span>Message template</span>
              <textarea
                value={template}
                onChange={(event) => setTemplate(event.target.value)}
                rows={5}
                aria-describedby="campaign-help"
              />
            </label>
            <p id="campaign-help" className="muted">
              Supported variables: {'{first_name}'}, {'{service}'}, {'{business_name}'}. Links are
              prepared only; delivery is never claimed.
            </p>
            <button className="button primary" disabled={status.kind === 'pending'}>
              Save draft
            </button>
          </form>
          {selected && (
            <div className="campaign-edit">
              <h3>Selected draft</h3>
              <p className="muted">
                Version {selected.version} · {selected.status}
              </p>
              <button className="button secondary" onClick={() => void saveDraft()}>
                Save selected draft
              </button>
            </div>
          )}
        </section>
        <section className="panel campaign-list" aria-labelledby="campaign-list-title">
          <div className="toolbar compact">
            <h2 id="campaign-list-title">Campaigns</h2>
            <button className="button quiet" onClick={() => void loadCampaigns()}>
              Refresh
            </button>
          </div>
          {campaigns.length === 0 ? (
            <p className="muted">No campaigns yet.</p>
          ) : (
            <div className="campaign-items">
              {campaigns.map((campaign) => (
                <button
                  className={`campaign-item ${selected?.id === campaign.id ? 'selected' : ''}`}
                  key={campaign.id}
                  onClick={() => void openCampaign(campaign.id)}
                >
                  <strong>{campaign.name}</strong>
                  <span>
                    {campaign.status} · {campaign.recipientCount} eligible
                  </span>
                </button>
              ))}
            </div>
          )}
        </section>
      </div>
      {selected && (
        <section className="panel recipient-panel" aria-labelledby="recipient-title">
          <div className="toolbar">
            <div>
              <p className="eyebrow">Review / version {selected.version}</p>
              <h2 id="recipient-title">{selected.name}</h2>
              <p className="muted">
                Only the latest WhatsApp grant, valid current phone, and no active booking qualify.
              </p>
            </div>
            <div className="button-row">
              <a className="button quiet" href={`/api/v1/campaigns/${selected.id}/recipients.csv`}>
                Export CSV
              </a>
              <button
                className="button secondary"
                onClick={() => void refresh()}
                disabled={selected.status !== 'draft'}
              >
                Review recipients
              </button>
              {selected.status === 'draft' && (
                <button className="button secondary" onClick={() => void transition('ready')}>
                  Mark ready
                </button>
              )}
              {selected.status === 'ready' && (
                <button className="button primary" onClick={() => void transition('active')}>
                  Activate
                </button>
              )}
              {selected.status === 'active' && (
                <button className="button secondary" onClick={() => void transition('completed')}>
                  Complete
                </button>
              )}
            </div>
          </div>
          <div className="recipient-list">
            {recipients.length === 0 ? (
              <p className="muted">Review the draft to create its recipient snapshot.</p>
            ) : (
              recipients.map((recipient) => (
                <article className="recipient-card" key={recipient.id}>
                  <div>
                    <strong>
                      {recipient.firstName} {recipient.lastName}
                    </strong>
                    <span>
                      {recipient.phone || 'No valid phone'} · {recipient.eligibility}
                    </span>
                    <p>{recipient.personalizedPreview}</p>
                    {recipient.reason && <small>{recipient.reason}</small>}
                  </div>
                  <div className="button-row">
                    {recipient.eligibility === 'eligible' &&
                      selected.status === 'active' &&
                      !recipient.outcome && (
                        <button className="button secondary" onClick={() => void link(recipient)}>
                          Prepare WhatsApp
                        </button>
                      )}
                    {selected.status === 'active' &&
                      recipient.eligibility === 'eligible' &&
                      recipient.outcome === null && (
                        <>
                          <button
                            className="button quiet"
                            onClick={() => void outcome(recipient, 'sent')}
                          >
                            Mark sent
                          </button>
                          <button
                            className="button quiet"
                            onClick={() => void outcome(recipient, 'skipped')}
                          >
                            Skip
                          </button>
                        </>
                      )}
                    {selected.status === 'active' &&
                      recipient.eligibility === 'eligible' &&
                      (recipient.outcome === 'sent' || recipient.outcome === 'replied') && (
                        <>
                          <button
                            className="button quiet"
                            onClick={() => void outcome(recipient, 'replied')}
                            disabled={recipient.outcome === 'replied'}
                          >
                            Mark replied
                          </button>
                          <input
                            aria-label={`Booking ID for ${recipient.firstName}`}
                            placeholder="Booking ID for conversion"
                            value={bookingIdByRecipient[recipient.id] ?? ''}
                            onChange={(event) =>
                              setBookingIdByRecipient((current) => ({
                                ...current,
                                [recipient.id]: event.target.value,
                              }))
                            }
                          />
                          <button
                            className="button quiet"
                            disabled={!bookingIdByRecipient[recipient.id]}
                            onClick={() => void outcome(recipient, 'booked')}
                          >
                            Mark booked
                          </button>
                        </>
                      )}
                    {selected.status === 'draft' && !recipient.removed && (
                      <button className="button quiet" onClick={() => void remove(recipient)}>
                        Remove
                      </button>
                    )}
                  </div>
                </article>
              ))
            )}
          </div>
          <section className="campaign-audit" aria-labelledby="campaign-audit-title">
            <h3 id="campaign-audit-title">Campaign activity</h3>
            {auditItems.length === 0 ? (
              <p className="muted">No campaign activity recorded yet.</p>
            ) : (
              <ol className="activity-list">
                {auditItems.map((item) => (
                  <li key={item.id}>
                    <strong>{item.type.replaceAll('.', ' ')}</strong>
                    <span>{new Date(item.occurredAt).toLocaleString()}</span>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </section>
      )}
      <StatusLine status={status} />
    </main>
  );
}
