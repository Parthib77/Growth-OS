import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Privacy draft | Growth OS',
  description: 'Draft privacy information for the current Growth OS implementation.',
};

export default function PrivacyPage() {
  return (
    <main className="legal-shell">
      <nav className="legal-nav" aria-label="Legal pages">
        <Link href="/">Growth OS</Link>
        <Link href="/terms">Terms draft</Link>
      </nav>
      <article className="legal-document">
        <h1>How the current product handles data</h1>
        <div className="legal-warning" role="note">
          <strong>Draft for legal review.</strong> This page describes the current Growth OS
          implementation. It is not approved legal advice or a final launch policy.
        </div>

        <h2>Data stored by Growth OS</h2>
        <p>
          Growth OS stores the account email and business settings needed to operate a workspace. A
          workspace can contain customer contact details, enquiry context, service interests,
          consent history, internal notes, campaign records, bookings, and reviews.
        </p>
        <p>
          Growth OS also stores operational events for reporting and audit history. These events
          contain business metadata. They do not contain passwords, session tokens, full review
          text, customer notes, raw CSV rows, or message bodies.
        </p>

        <h2>Contact permission and WhatsApp</h2>
        <p>
          A recorded consent withdrawal suppresses later campaign contact until the owner records a
          new grant. The application rechecks consent and booking state before it prepares a
          WhatsApp link or records a sent outcome.
        </p>
        <p>
          WhatsApp click-to-chat opens an external service. Growth OS records only that the owner
          prepared the link unless the owner records another outcome. The application does not claim
          that WhatsApp delivered a message.
        </p>

        <h2>Exports and account deletion</h2>
        <p>
          The owner can download a workspace data export. The export excludes password hashes,
          sessions, security-token hashes, internal retry receipts, and server configuration.
        </p>
        <p>
          Account deletion requires the current password and the exact business name. A successful
          deletion removes the account, workspace records, and active sessions. The implementation
          keeps a minimal security receipt without raw account, workspace, or customer identifiers.
        </p>

        <h2>Retention and backups</h2>
        <p>
          Growth OS does not claim an automatic retention schedule for normal workspace data.
          Retention periods, backup deletion, and the security-receipt period require legal and
          operational approval before public launch.
        </p>

        <h2>Security and product use</h2>
        <p>
          The current application hashes passwords and session tokens, restricts records by
          workspace, checks cross-site requests, and keeps MongoDB off the public production
          network. These controls do not state or imply a security certification.
        </p>
        <p>
          The current product has no advertising or data-sale workflow. Legal review must confirm
          the final disclosure before launch.
        </p>

        <h2>Contact</h2>
        <p className="legal-placeholder">
          [Legal review required: provide a monitored privacy email and the product operator&apos;s
          identity before launch.]
        </p>
      </article>
    </main>
  );
}
