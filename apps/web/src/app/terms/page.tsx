import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Terms draft | Growth OS',
  description: 'Draft terms for the current Growth OS implementation.',
};

export default function TermsPage() {
  return (
    <main className="legal-shell">
      <nav className="legal-nav" aria-label="Legal pages">
        <Link href="/">Growth OS</Link>
        <Link href="/privacy">Privacy draft</Link>
      </nav>
      <article className="legal-document">
        <h1>Terms for the current product</h1>
        <div className="legal-warning" role="note">
          <strong>Draft for legal review.</strong> This page describes the current Growth OS
          implementation. It is not approved legal advice or a final launch agreement.
        </div>

        <h2>Owner responsibilities</h2>
        <p>
          The workspace owner is responsible for entering accurate business information and using
          customer data lawfully. The owner must have a valid basis for each customer contact and
          must honor recorded consent withdrawals.
        </p>

        <h2>Messaging</h2>
        <p>
          Growth OS prepares individual WhatsApp click-to-chat links. The owner reviews the message
          and starts each conversation. The first release does not send bulk messages and does not
          claim provider delivery.
        </p>

        <h2>Results and money</h2>
        <p>
          Results come from stored operational events and bookings. Quoted value and recorded
          booking value are separate facts. Growth OS does not describe recorded booking value as
          collected revenue.
        </p>

        <h2>Account security</h2>
        <p>
          The owner is responsible for protecting account credentials and signing out from devices
          they no longer control. The owner must report suspected account access through the support
          contact that the operator approves before launch.
        </p>

        <h2>Acceptable use</h2>
        <p>
          The owner must not use Growth OS to send unlawful, deceptive, abusive, or unauthorized
          communications. The owner must not try to access another workspace or interfere with the
          application or its security controls.
        </p>

        <h2>Exports, deletion, and availability</h2>
        <p>
          The product provides a workspace data export and an explicit account-deletion flow. The
          operator must define backup deletion and security-receipt retention before public launch.
        </p>
        <p>
          No service-level commitment appears in this draft. Legal and operational review must set
          availability, support, maintenance, suspension, and termination terms.
        </p>

        <h2>Required legal fields</h2>
        <p className="legal-placeholder">
          [Legal review required: provide the operator name, registration details if applicable,
          address, support email, launch jurisdiction, governing law, liability terms, and dispute
          process before launch.]
        </p>
      </article>
    </main>
  );
}
