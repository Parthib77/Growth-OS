'use client';

import { FormEvent, useState } from 'react';
import {
  Building2,
  Check,
  Database,
  Download,
  ExternalLink,
  FileText,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { z } from 'zod';
import {
  DeleteAccountRequestSchema,
  WorkspaceResponseSchema,
  WorkspaceSettingsPatchSchema,
} from '@growthos/contracts';
import { download, formValues, request } from './api-client';
import { AppNav, type AppScreen } from './app-nav';
import { Field, StatusLine, type Status } from './ui';
import { IconWell } from './workspace-ui';

type Workspace = ReturnType<typeof WorkspaceResponseSchema.parse>;

export function SettingsView({
  csrf,
  workspace,
  status,
  setStatus,
  onNavigate,
  onSignOut,
  onWorkspaceUpdated,
  onDeleted,
}: {
  csrf: string;
  workspace: Workspace;
  status: Status;
  setStatus: (status: Status) => void;
  onNavigate: (screen: AppScreen) => void;
  onSignOut: () => void;
  onWorkspaceUpdated: (workspace: Workspace) => void;
  onDeleted: () => void;
}) {
  const [showDeletion, setShowDeletion] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');

  async function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus({ kind: 'pending', message: 'Saving workspace settings…' });
    try {
      const values = formValues(event.currentTarget);
      const input = WorkspaceSettingsPatchSchema.parse({
        businessName: values.businessName,
        category: values.category,
        timezone: values.timezone,
        currency: values.currency.toUpperCase(),
        defaultCountryCode: values.defaultCountryCode,
        bookingLink: values.bookingLink,
        followUpDays: Number(values.followUpDays),
        reviewResponseTemplate: values.reviewResponseTemplate,
      });
      const updated = await request('/api/v1/workspace', WorkspaceResponseSchema, {
        method: 'PATCH',
        headers: { 'X-CSRF-Token': csrf },
        body: JSON.stringify(input),
      });
      onWorkspaceUpdated(updated);
      setStatus({ kind: 'success', message: 'Workspace settings saved.' });
    } catch (error: unknown) {
      setStatus({
        kind: 'error',
        message: error instanceof Error ? error.message : 'Unable to save settings.',
      });
    }
  }

  async function exportData() {
    setStatus({ kind: 'pending', message: 'Preparing your workspace export…' });
    try {
      await download('/api/v1/workspace/export', 'growthos-export.json');
      setStatus({ kind: 'success', message: 'Workspace export downloaded.' });
    } catch (error: unknown) {
      setStatus({
        kind: 'error',
        message: error instanceof Error ? error.message : 'Unable to prepare the export.',
      });
    }
  }

  async function deleteAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus({ kind: 'pending', message: 'Deleting the account and workspace…' });
    try {
      const input = DeleteAccountRequestSchema.parse({
        password,
        businessNameConfirmation: confirmation,
      });
      await request('/api/v1/workspace/account', z.null(), {
        method: 'DELETE',
        headers: { 'X-CSRF-Token': csrf },
        body: JSON.stringify(input),
      });
      onDeleted();
    } catch (error: unknown) {
      setStatus({
        kind: 'error',
        message: error instanceof Error ? error.message : 'Unable to delete the account.',
      });
    }
  }

  const pending = status.kind === 'pending';

  return (
    <main className="app-shell">
      <AppNav
        active="settings"
        businessName={workspace.businessName}
        isDemo={workspace.isDemo}
        onNavigate={onNavigate}
        onSignOut={onSignOut}
        signOutPending={pending}
      />
      <header className="topbar screen-heading">
        <div>
          <h1 id="screen-title" tabIndex={-1}>
            Settings
          </h1>
          <p className="screen-intro">
            Business defaults, response language, data access, and account control.
          </p>
        </div>
      </header>

      <div className="settings-layout">
        <section className="panel settings-primary" aria-labelledby="business-settings-title">
          <div className="workspace-panel-heading">
            <IconWell>
              <Building2 size={25} />
            </IconWell>
            <div>
              <h2 id="business-settings-title">Business and follow-up defaults</h2>
              <p>
                These settings are used across your workspace for bookings, follow-ups and customer
                communications.
              </p>
            </div>
          </div>
          <form onSubmit={saveSettings}>
            <div className="form-grid">
              <Field
                label="Business name"
                name="businessName"
                defaultValue={workspace.businessName}
              />
              <Field
                label="Business category"
                name="category"
                defaultValue={workspace.category ?? ''}
              />
              <Field label="Timezone" name="timezone" defaultValue={workspace.timezone} />
              <Field label="Currency" name="currency" defaultValue={workspace.currency} />
              <Field
                label="Default country code"
                name="defaultCountryCode"
                defaultValue={workspace.defaultCountryCode}
              />
              <Field
                label="Booking link"
                name="bookingLink"
                type="url"
                required={false}
                defaultValue={workspace.bookingLink ?? ''}
              />
              <Field
                label="Follow-up after (days)"
                name="followUpDays"
                type="number"
                defaultValue={String(workspace.followUpDays)}
              />
            </div>
            <label className="field">
              <span>Review response template</span>
              <textarea
                name="reviewResponseTemplate"
                rows={5}
                defaultValue={workspace.reviewResponseTemplate}
              />
              <small>Use {'{reviewer_name}'} to insert the reviewer name.</small>
            </label>
            <p className="settings-note">
              Currency becomes locked after the first quoted value or booking is stored.
            </p>
            <button className="button primary" disabled={pending}>
              <Check aria-hidden="true" size={19} />
              Save settings
            </button>
          </form>
        </section>

        <aside className="settings-secondary">
          <section className="settings-section" aria-labelledby="data-export-title">
            <div className="workspace-panel-heading">
              <IconWell>
                <Database size={25} />
              </IconWell>
              <div>
                <h2 id="data-export-title">Data export</h2>
                <p>
                  Download a validated JSON copy of workspace settings and business records.
                  Passwords, sessions, and internal lookup fields are excluded.
                </p>
              </div>
            </div>
            <button
              type="button"
              className="button secondary"
              onClick={exportData}
              disabled={pending}
            >
              <Download aria-hidden="true" size={19} />
              Download workspace data
            </button>
          </section>

          <section className="settings-section" aria-labelledby="privacy-settings-title">
            <div className="workspace-panel-heading">
              <IconWell>
                <FileText size={25} />
              </IconWell>
              <div>
                <h2 id="privacy-settings-title">Privacy and legal drafts</h2>
                <p>
                  The current policy and terms describe implemented behavior and remain marked for
                  legal review.
                </p>
              </div>
            </div>
            <div className="legal-links">
              <a href="/privacy">
                <ShieldCheck size={19} aria-hidden="true" />
                Privacy policy
                <ExternalLink size={16} aria-hidden="true" />
              </a>
              <a href="/terms">
                <FileText size={19} aria-hidden="true" />
                Terms of service
                <ExternalLink size={16} aria-hidden="true" />
              </a>
            </div>
          </section>

          <section
            className="settings-section danger-section"
            aria-labelledby="delete-account-title"
          >
            <div className="workspace-panel-heading">
              <IconWell tone="red">
                <Trash2 size={25} />
              </IconWell>
              <div>
                <h2 id="delete-account-title">Delete account</h2>
                <p>
                  This permanently removes the account, workspace, sessions, and business records.
                  This action cannot be undone.
                </p>
              </div>
            </div>
            {!showDeletion ? (
              <button type="button" className="button danger" onClick={() => setShowDeletion(true)}>
                <Trash2 aria-hidden="true" size={19} />
                Start account deletion
              </button>
            ) : (
              <form className="deletion-confirmation" onSubmit={deleteAccount}>
                <p>
                  Type <strong>{workspace.businessName}</strong> and enter your current password to
                  confirm.
                </p>
                <Field
                  label="Business name confirmation"
                  name="businessNameConfirmation"
                  value={confirmation}
                  onChange={(event) => setConfirmation(event.target.value)}
                />
                <Field
                  label="Current password"
                  name="password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
                <div className="button-row">
                  <button
                    className="button danger"
                    disabled={pending || confirmation !== workspace.businessName || !password}
                  >
                    Delete account permanently
                  </button>
                  <button
                    type="button"
                    className="button quiet"
                    onClick={() => {
                      setShowDeletion(false);
                      setPassword('');
                      setConfirmation('');
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </section>
        </aside>
      </div>
      <StatusLine status={status} />
    </main>
  );
}
