# Growth OS threat model

## Scope

This threat model covers the browser, the Next.js web application, the Express API, MongoDB, CSV import and export, Docker images, logs, and the future messaging-provider boundary. It covers one owner account and one business workspace per account. It does not claim compliance with a specific privacy or security standard.

## Protected assets

- Account credentials, password-reset tokens, session tokens, and CSRF tokens.
- Customer identity, contact details, enquiry text, notes, consent evidence, reviews, and bookings.
- Campaign message content and recipient lists.
- Workspace settings, exports, deletion controls, and audit history.
- Integrity of consent, message outcomes, booking attribution, and Results.
- Availability of the Today workflow and stored business data.

## Trust boundaries

```text
untrusted browser and imported files
  -> public web origin
    -> same-origin API boundary
      -> typed domain commands and queries
        -> private MongoDB network

future provider callback
  -> separately authenticated provider-receipt boundary
```

The API treats browser values, CSV files, provider data, environment values, and MongoDB documents as untrusted. Boundary parsers convert them to domain values. Internal functions trust only constructed types.

## Threats and controls

| Threat                     | Attack or failure                                                                        | Required controls                                                                                                                                                                      | Verification                                                                                   |
| -------------------------- | ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Cross-workspace access     | An authenticated owner changes an ID to read or mutate another workspace.                | Derive `workspaceId` from the session. Require workspace criteria in every business repository. Return non-enumerating `404` responses.                                                | API tests create two workspaces and attempt every resource class across the boundary.          |
| Session theft              | A script or log obtains a reusable session value.                                        | Use a 256-bit opaque token, store only its hash, set `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`, and a `__Host-` name. Redact tokens from logs.                                    | Cookie assertions, log scans, and sign-in browser tests.                                       |
| Session fixation           | An attacker supplies a session before authentication.                                    | Rotate the session and CSRF token after sign-in, reset, and sensitive changes.                                                                                                         | Integration tests prove old tokens stop working.                                               |
| CSRF                       | Another origin submits an unsafe request with the user's cookie.                         | Require a session-bound CSRF token, allowlisted `Origin`, and Fetch Metadata for every unsafe request.                                                                                 | Missing, wrong, stale, and cross-origin cases return 403.                                      |
| Credential attacks         | An attacker enumerates accounts or brute-forces passwords.                               | Use Argon2id, generic responses, per-identifier and network rate limits, password-reset token hashing, single use, short expiry, and session-generation revocation.                    | Rate-limit and enumeration integration tests.                                                  |
| Injection                  | A request injects MongoDB operators, HTML, headers, or spreadsheet formulas.             | Parse allowlisted fields with Zod, reject unknown Mongo operators, escape rendered content, sanitize filenames, and prefix formula-leading CSV cells.                                  | Malicious payload corpus tests and exported-file assertions.                                   |
| Malicious or oversized CSV | A file exhausts memory, supplies invalid encodings, or smuggles dangerous cells.         | Enforce byte, row, column, and cell limits before allocation grows. Accept only UTF-8 and UTF-8 with BOM in the first release. Stage parsed rows with TTL. Never execute file content. | Boundary tests at and above every limit.                                                       |
| Duplicate command          | A lost response causes a second booking or outcome.                                      | Require idempotency keys. Store normalized request hash and result reference in the same transaction as the business facts.                                                            | Retry, key-reuse, concurrent-first-attempt, and crash tests.                                   |
| Lost update                | Two tabs overwrite a campaign draft or recipient set.                                    | Require ETags and `If-Match`. Atomically match the expected version.                                                                                                                   | Concurrent PATCH tests prove one succeeds and one receives 412.                                |
| Consent bypass             | A stale campaign preview contacts a withdrawn or booked customer.                        | Store immutable consent history. Recheck current consent and booking facts at activation and handoff. Never trust the preview as authorization.                                        | Withdraw after preview, then activate and hand off. The customer remains excluded.             |
| False delivery claim       | Opening WhatsApp is reported as delivered.                                               | Model owner handoff separately from provider acceptance and delivery. The click-to-chat adapter cannot emit a delivery fact.                                                           | Contract and UI copy tests reject a delivered state without an authenticated provider receipt. |
| Audit data leak            | The event ledger copies message bodies, notes, tokens, or raw uploads.                   | Use a closed event payload union and exhaustive redaction registry. Forbid arbitrary before and after documents.                                                                       | Schema tests and a denylist scan over event fixtures and logs.                                 |
| Tampered attribution       | A booking links to another customer, campaign, or workspace.                             | Resolve the recipient inside the transaction. Require the same workspace and customer. Accept attribution only from an allowed recipient state.                                        | Integration tests cover cross-workspace, wrong-customer, and uncontacted-recipient links.      |
| Account deletion abuse     | A stolen session deletes the workspace or deletion leaves active access.                 | Require recent authentication, CSRF, exact business-name confirmation, a server-side deletion command, session revocation, and an audit-safe deletion fact.                            | Browser and integration tests cover cancellation, wrong confirmation, and post-delete access.  |
| Secret exposure            | Builds, logs, errors, or browser bundles contain server secrets.                         | Validate server-only environment variables, separate public variables, redact logs, omit `.env` files from images, and scan artifacts.                                                 | Secret-pattern scans and container inspection.                                                 |
| Database exposure          | MongoDB accepts public traffic or unauthenticated access.                                | Keep MongoDB on an internal network, publish no production port, enable authentication, and use separate application credentials.                                                      | Compose inspection and external connection failure test.                                       |
| Dependency compromise      | A direct or transitive package or image contains a known severe flaw.                    | Commit the lockfile, use `npm ci`, pin production images, generate an SBOM, run dependency and container scans, and review exceptions.                                                 | CI scan reports have no unresolved high-severity finding.                                      |
| Denial of service          | Large bodies, expensive filters, login attempts, or unbounded exports exhaust resources. | Apply request-size limits, route rate limits, allowlisted indexed queries, maximum pages, bounded export jobs, and timeouts.                                                           | Load smoke tests and query explain checks.                                                     |
| Sensitive log content      | Request logging captures credentials, notes, messages, or imported rows.                 | Log request IDs, operation names, safe resource IDs, duration, and result codes only. Apply structured redaction at the logger.                                                        | Automated log capture for sensitive flows contains no forbidden values.                        |

## Authorization policy

Authentication establishes the user. The session establishes the workspace. Each command or query authorizes the action within that workspace. The request cannot select another workspace.

The first release has one owner role. This does not justify skipping authorization. Every business resource still requires authentication and a matching workspace. Team roles require a new authorization design before implementation.

## Data minimization and retention

The event ledger records business facts, not full content. Application logs exclude message bodies, review text, notes, tokens, and CSV rows. Export jobs and import batches expire after an approved period. Consent evidence, event retention, backup deletion, and any surviving security record require legal review before production.

The implementation must not advertise automatic retention or deletion behavior until the policy exists and tests prove the job behavior.

## Security gates

The release cannot pass while any of these conditions remains:

- A high-severity finding is unresolved without an approved, time-bounded exception.
- A cross-workspace test can read, infer, or mutate another workspace.
- A state-changing endpoint works without CSRF protection.
- A production container exposes MongoDB or embeds a secret.
- An event or log contains a forbidden sensitive field.
- A duplicate request creates a second booking or business outcome.
- Consent withdrawal can be bypassed through a stale preview.

## Incident evidence

Every API response includes a request ID. Security-relevant events include the actor, workspace, request ID, command ID, subject, safe change summary, and timestamp. Operators can correlate a browser failure, structured log, and redacted audit event without storing the sensitive payload.

## Open decisions

- Legal review must define retention and deletion policy.
- Production operations must define credential rotation, backup encryption, restore testing, and incident notification.
- A future provider integration must define signature verification, replay windows, provider-event idempotency, and delivery-state semantics before it is enabled.
- Deployment review must decide whether single-host availability is acceptable for the first users.
