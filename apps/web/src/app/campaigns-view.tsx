'use client';

import { useEffect, useRef, useState } from 'react';
import { Ellipsis, Eye, Layers3, PlusCircle, Search, Send } from 'lucide-react';
import {
  CampaignAuditResponseSchema,
  CampaignListResponseSchema,
  CampaignOutcomeResponseSchema,
  CampaignRecipientListResponseSchema,
  CampaignRecipientResponseSchema,
  CampaignResponseSchema,
  CreateCampaignRequestSchema,
  ErrorResponseSchema,
  UpdateCampaignRequestSchema,
  WhatsAppLinkResponseSchema,
} from '@growthos/contracts';
import { request } from './api-client';
import { AppNav, type AppScreen } from './app-nav';
import { Field, StatusLine, type Status } from './ui';
import { IconWell, TodayBadge } from './workspace-ui';

type Campaign = ReturnType<typeof CampaignResponseSchema.parse>;
type Recipient = ReturnType<typeof CampaignRecipientListResponseSchema.parse>['items'][number];
type AuditItem = ReturnType<typeof CampaignAuditResponseSchema.parse>['items'][number];

type Props = {
  csrf: string;
  businessName: string;
  isDemo: boolean;
  status: Status;
  setStatus: (status: Status) => void;
  onNavigate: (screen: AppScreen) => void;
  onSignOut: () => void;
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
  if (!response.ok) {
    const parsed = ErrorResponseSchema.safeParse(data);
    throw new Error(parsed.success ? parsed.data.error.message : 'Campaign request failed.');
  }
  return { data: schema.parse(data), etag: response.headers.get('etag') ?? '' };
}

export function CampaignsView({
  csrf,
  businessName,
  isDemo,
  status,
  setStatus,
  onNavigate,
  onSignOut,
}: Props) {
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
  const [listFilter, setListFilter] = useState<'all' | 'active' | 'draft' | 'ready' | 'completed'>(
    'all',
  );
  const [listSearch, setListSearch] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [bookingIdByRecipient, setBookingIdByRecipient] = useState<Record<string, string>>({});
  const outcomeSubmission = useRef<Record<string, { fingerprint: string; key: string }>>({});
  const visibleCampaigns = campaigns.filter(
    (campaign) =>
      (listFilter === 'all' || campaign.status === listFilter) &&
      campaign.name.toLowerCase().includes(listSearch.trim().toLowerCase()),
  );

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
      <AppNav
        active="campaigns"
        businessName={businessName}
        isDemo={isDemo}
        onNavigate={onNavigate}
        onSignOut={onSignOut}
        signOutPending={status.kind === 'pending'}
      />
      <header className="topbar screen-heading">
        <div>
          <h1 id="screen-title" tabIndex={-1}>
            Permission-aware follow-up
          </h1>
          <p className="screen-intro">
            Create and manage follow-up campaigns for customers who have given permission.
            <br />
            Send personalised messages at the right time to drive more bookings and revenue.
          </p>
        </div>
        <TodayBadge />
      </header>
      <div className="campaign-layout">
        <section className="panel campaign-composer" aria-labelledby="campaign-composer-title">
          <div className="workspace-panel-heading">
            <IconWell>
              <Send size={25} />
            </IconWell>
            <div>
              <h2 id="campaign-composer-title">Create a campaign draft</h2>
              <p>
                Set up a permission-aware follow-up campaign. Save it as a draft and launch when
                you're ready.
              </p>
            </div>
          </div>
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
            <div className="button-row campaign-compose-actions">
              <button className="button primary" disabled={status.kind === 'pending'}>
                <Send aria-hidden="true" size={18} />
                Save draft
              </button>
              <button
                type="button"
                className="button secondary"
                onClick={() => setShowPreview((open) => !open)}
                aria-expanded={showPreview}
                disabled={!template.trim()}
              >
                <Eye aria-hidden="true" size={18} />
                Preview message
              </button>
            </div>
            {showPreview && (
              <div className="campaign-message-preview" role="status">
                <strong>Message preview</strong>
                <p>{template}</p>
                <small>
                  Variables are filled only after you review recipients. This does not send a
                  message.
                </small>
              </div>
            )}
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
          <div className="workspace-panel-heading campaign-list-heading">
            <IconWell>
              <Layers3 size={25} />
            </IconWell>
            <div>
              <h2 id="campaign-list-title">Campaigns</h2>
              <p>Manage your permission-aware follow-up campaigns.</p>
            </div>
            <button
              className="button primary"
              onClick={() => {
                setSelected(null);
                setName('');
                setTemplate('Hi {first_name}, your {service} at {business_name} is ready.');
                setLifecycle('');
                setService('');
                setSource('');
                document.getElementById('campaign-composer-title')?.scrollIntoView();
              }}
            >
              <PlusCircle size={18} />
              Create campaign
            </button>
          </div>
          <div className="campaign-list-controls">
            <div className="campaign-filter-tabs" aria-label="Filter campaigns">
              {(['all', 'active', 'draft', 'ready', 'completed'] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  className={listFilter === value ? 'active' : ''}
                  aria-pressed={listFilter === value}
                  onClick={() => setListFilter(value)}
                >
                  {value === 'all'
                    ? 'All'
                    : value === 'draft'
                      ? 'Drafts'
                      : value[0].toUpperCase() + value.slice(1)}
                </button>
              ))}
            </div>
            <label className="campaign-search">
              <Search size={18} aria-hidden="true" />
              <span className="sr-only">Search campaigns</span>
              <input
                value={listSearch}
                onChange={(event) => setListSearch(event.target.value)}
                placeholder="Search campaigns..."
              />
            </label>
          </div>
          <div className="campaign-table-head" aria-hidden="true">
            <span>Campaign</span>
            <span>Status</span>
            <span>Audience</span>
            <span>Created</span>
            <span>Recipients</span>
            <span>Actions</span>
          </div>
          {visibleCampaigns.length === 0 ? (
            <p className="muted campaign-empty">No campaigns match this view.</p>
          ) : (
            <div className="campaign-items">
              {visibleCampaigns.map((campaign) => (
                <button
                  className={`campaign-item ${selected?.id === campaign.id ? 'selected' : ''}`}
                  key={campaign.id}
                  onClick={() => void openCampaign(campaign.id)}
                >
                  <span className="campaign-item-name">
                    <IconWell>
                      <Send size={18} />
                    </IconWell>
                    <strong>{campaign.name}</strong>
                  </span>
                  <span className={`campaign-state ${campaign.status}`}>{campaign.status}</span>
                  <span>
                    {campaign.audience.lifecycle || 'Any lifecycle'}
                    <small>{campaign.audience.service || 'No service filter'}</small>
                  </span>
                  <time className="campaign-created" dateTime={campaign.createdAt}>
                    {new Date(campaign.createdAt).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                    <small>
                      {new Date(campaign.createdAt).toLocaleTimeString([], {
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </small>
                  </time>
                  <span>
                    <strong>{campaign.recipientCount}</strong>
                    <small>eligible</small>
                  </span>
                  <span className="customer-more" aria-hidden="true">
                    <Ellipsis size={20} />
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
              <p className="muted">Version {selected.version}</p>
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
