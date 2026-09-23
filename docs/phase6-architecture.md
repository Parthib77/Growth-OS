# Phase 6 architecture

## Status

- Ground: complete. The current request, session, workspace, event, Results, and browser flows were traced.
- Sketch: complete. Two designs were compared against the original brief and current architecture.
- Agree: complete. Candidate A is the base, with the selected additions below.
- Implement: backend, authenticated web workspace, legal drafts, export, and account deletion complete. The guarded demo seed/reset remains pending.
- Scrap: use only if implementation needs repeated casts, partial-state fields, or caller-managed transactions.

## Caller usage

The browser calls one typed operation for each user action. Routes own transport checks. Domain services own authorization, state transitions, transactions, and events.

```ts
const reviews = await reviews.list({ responseState: 'unanswered', limit: 50 });
const review = await reviews.create(input);
await reviews.changeResponse(review.id, { action: 'save_draft', text });
await reviews.changeResponse(review.id, { action: 'mark_posted_manually' });

const results = await results.read({ from: '2026-09-01', through: '2026-09-30' });
await workspace.updateSettings(settingsPatch);
await workspace.deleteAccount({ password, businessNameConfirmation });
```

Results CSV and the full data export are authenticated downloads. The web app does not reconstruct metrics, export projections, or deletion order.

## Review model

Original review content and mutable response state are separate values.

```ts
type ReviewOriginal = Readonly<{
  reviewerName: string;
  rating: 1 | 2 | 3 | 4 | 5;
  text: string;
  source: string;
  receivedAt: UtcInstant;
}>;

type ReviewResponseState =
  | { kind: 'unanswered' }
  | { kind: 'drafted'; text: string; revisedAt: UtcInstant }
  | { kind: 'posted_manually'; text: string; postedAt: UtcInstant };

type ChangeReviewResponse =
  | { action: 'save_draft'; text: string }
  | { action: 'mark_posted_manually' }
  | { action: 'reopen_draft'; text: string };
```

No update schema or repository method accepts fields from `ReviewOriginal`. Review events contain IDs, state names, ratings, and sources only. They never contain the original text or response text.

`Review` uses these indexes:

```text
{ workspaceId: 1, responseState: 1, receivedAt: -1, _id: -1 }
{ workspaceId: 1, receivedAt: -1, _id: -1 }
```

`ReviewImportBatch` is separate from the verified customer import model. It has bounded staged rows, a TTL, and a stored commit response for retries.

## Public routes

```text
GET    /api/v1/reviews
POST   /api/v1/reviews
PATCH  /api/v1/reviews/{reviewId}/response
POST   /api/v1/review-imports/preview
POST   /api/v1/review-imports/{importId}/commit

GET    /api/v1/results?from=YYYY-MM-DD&through=YYYY-MM-DD
GET    /api/v1/results.csv?from=YYYY-MM-DD&through=YYYY-MM-DD

PATCH  /api/v1/workspace
GET    /api/v1/workspace/export
DELETE /api/v1/workspace/account
```

`from` and `through` are inclusive civil dates in the workspace timezone. The server converts `through` to the next local midnight and keeps the database range half-open.

The settings schema is partial and separate from onboarding. It allows business name, category, timezone, currency, default country code, booking link, follow-up days, and the review response template. A currency change fails after any customer quote or booking exists.

## Transaction boundaries

Manual review creation writes the review and `review.created` event together. Each response action updates only response fields and appends its event in one transaction. Review import commit inserts every approved review, appends safe events, and stores the retry response in one bounded transaction.

Results JSON and CSV call the same query function. This prevents count or definition drift.

The data export runs in a read-only snapshot transaction. Explicit projectors build a versioned document that includes the account email, workspace settings, customers, consent records, interactions, campaigns, campaign revisions, campaign recipients, bookings, reviews, and redacted operational events. The response is validated before the API sends bytes.

The export omits password hashes, sessions, CSRF data, command receipts, lookup-only normalized fields, raw import staging, internal locks, MongoDB metadata, logs, and configuration.

## Account deletion

The command requires the current password and an exact business-name confirmation. Password verification happens before the transaction. The transaction re-reads both the user and workspace before deleting anything.

A single tenant-ownership manifest defines the deletion order and powers the completeness test:

1. Review import batches and customer import batches.
2. Command receipts.
3. Campaign recipients and campaign revisions.
4. Campaigns.
5. Reviews.
6. Bookings.
7. Consent records and interactions.
8. Customers.
9. Operational events.
10. Every session for the user or workspace.
11. The workspace.
12. The user.

The same transaction inserts a system-owned `AccountDeletionReceipt`. It stores the request ID, occurrence time, schema version, and an HMAC of the deleted user and workspace IDs. It stores no raw identifier, email, business name, record count, or customer data. Its retention period remains marked for legal and security review.

The API clears the cookie and emits a metadata-only security log after the transaction commits. Any failed check or database write leaves the account unchanged.

## Web modules

```text
apps/web/src/app/
  app-nav.tsx
  reviews-view.tsx
  results-view.tsx
  settings-view.tsx
  privacy/page.tsx
  terms/page.tsx
```

The existing authenticated screen switch remains. A shared navigation control keeps every feature reachable on a phone and moves focus to the destination heading.

The Reviews view supports manual creation, CSV preview and commit, unanswered filtering, response drafting, copying the persisted draft, manual-posted marking, and an audited reopen action. The Results view supports local-date filtering and CSV download. The Settings view contains profile, follow-up, review-template, data-export, and deletion sections.

Privacy and Terms are public App Router pages. Both start with `Draft for legal review`. They describe current storage, consent suppression, WhatsApp handoff, export, deletion, and the lack of an approved automatic retention policy. Operator identity, contact details, jurisdiction, backup deletion, and liability text remain marked fields for legal review.

## Demo workspace

A guarded, idempotent operator command seeds one `isDemo: true` workspace through the normal domain services and MongoDB models. The seed contains fictional customers, consent history, campaigns, a booking, reviews, and operational events. The application displays `Demo workspace` on every authenticated view.

The seed command is disabled unless an explicit environment guard is set. It does not overwrite later demo changes. A reset command may run only in local or test environments with a second explicit guard. A public endpoint that creates demo accounts was rejected because it permits unauthenticated database growth before an approved cleanup policy exists.

## Verification

Unit tests cover review transitions, immutable original fields, CSV bounds, template variables, local date conversion, formula-safe exports, currency locking, export projectors, and the deletion manifest.

Replica-set integration tests cover tenant isolation, review import retry, response events without text, original-text immutability, Results and CSV agreement, settings persistence, export inclusion and secret exclusion, deletion refusal, atomic deletion, session revocation, and the deletion receipt.

Playwright covers review drafting and manual posting, date-filtered Results, both downloads, settings reload, deletion cancellation and completion, and legal pages on desktop Chromium and iPhone/WebKit. The latest gate passed 10 tests; the two deterministic visual-capture tests are skipped by default and passed separately against a production build. The database-backed demo remains pending and is not included in that evidence.

## Synthesis record

Candidate A scored 24 of 25 and is the base. Candidate B scored 16 of 25.

The synthesis adds Candidate B's nested immutable review value, a declarative deletion manifest, and a post-commit security log. It rejects a public demo-creation endpoint, a generalized customer/review import document, response streaming before export validation, terminal posted reviews, and logs as the only deletion proof.

The synchronous export and deletion transaction are bounded first-release choices. If measured workspace size exceeds the HTTP or transaction budget, the replacement must add asynchronous jobs, protected artifact storage, expiry, and recovery as one reviewed design.
