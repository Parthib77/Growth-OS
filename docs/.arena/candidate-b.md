# Candidate B — Command services with an operational-event ledger

## Usage (caller's view)

The browser calls versioned REST resources through a generated, same-origin client. It never sends a `workspaceId`; the API derives tenancy from the server session. Mutations carry CSRF and, where replay would create a second business fact, an idempotency key.

```ts
const created = await api.customers.createEnquiry({
  csrfToken,
  body: {
    firstName: 'Maya',
    phone: '+1 415 555 0142',
    service: 'Balayage',
    source: 'instagram',
    quotedValue: { minorUnits: 18_500, currency: 'USD' },
    consent: { channel: 'whatsapp', decision: 'granted', recordedAt: now },
  },
});

if (created.kind === 'duplicate_review_required') {
  showDuplicateReview(created.candidates, created.confirmationToken);
}
```

```ts
const booking = await api.bookings.create({
  csrfToken,
  idempotencyKey: actionId,
  body: {
    customerId,
    service: 'Balayage',
    appointmentLocal: '2026-10-02T14:30',
    agreedValue: { minorUnits: 18_500, currency: 'USD' },
    sourceCampaignId,
  },
});

// A retry with the same key and body returns the same booking response.
// The same key with a different body returns IDEMPOTENCY_KEY_REUSED.
```

Campaign editing is an explicit compare-and-swap. The client retains the returned ETag and sends it on the next edit.

```ts
const draft = await api.campaigns.get(campaignId);
const updated = await api.campaigns.updateDraft({
  campaignId,
  ifMatch: draft.etag, // `"campaign:<id>:v7"`
  csrfToken,
  body: { name: 'October colour follow-up', template },
});

if (updated.kind === 'version_conflict') {
  showReloadOrCompare(updated.currentVersion);
}
```

An Express route is a boundary adapter, not a second business layer. It parses wire input, establishes `CommandContext`, and invokes one explicit command service. The service completes policy, state change, idempotency, and event append in one MongoDB transaction.

```ts
const input = CreateBookingRequestSchema.parse(req.body);
const context = requireCommandContext(req); // actor, workspace, request, CSRF
const result = await bookingCommands.record(context, {
  ...toRecordBookingCommand(input),
  idempotencyKey: parseIdempotencyKey(req),
});
return presentBookingCommandResult(res, result);
```

Read callers use purpose-built query services. They do not replay events. Today reads current operational documents plus recent ledger entries; Results aggregates persisted operational events and bookings.

```ts
const today = await todayQueries.get(session.queryContext, { at: clock.now(), limit: 30 });
const results = await resultQueries.summarize(session.queryContext, {
  range: businessDateRange,
  groupBy: 'day',
});
```

## Problem

Growth OS needs trustworthy state changes across customers, consent, campaigns, bookings, reviews, and account settings, while also producing an honest audit trail and period reporting. A plain CRUD design makes the current document easy to update but tends to reconstruct history from mutable rows. Full event sourcing would make ordinary screens, corrections, retention, and MongoDB operations unnecessarily difficult. This candidate keeps normal MongoDB documents as the operational read model and makes every material command append a typed, immutable operational fact in the same transaction. It stays one Express modular monolith and one MongoDB deployment: there is no broker, stream processor, projector service, or inter-service protocol.

## Shape

### Core types and state machines

External JSON, Mongoose documents, and Express objects remain private to their boundaries. IDs and semantically different primitives are branded after parsing; money is integer minor units paired with an ISO currency; UTC instants are distinct from user-entered local date-times.

```ts
type Brand<T, Name extends string> = T & { readonly __brand: Name };
type WorkspaceId = Brand<string, 'WorkspaceId'>;
type UserId = Brand<string, 'UserId'>;
type CustomerId = Brand<string, 'CustomerId'>;
type CampaignId = Brand<string, 'CampaignId'>;
type CampaignRecipientId = Brand<string, 'CampaignRecipientId'>;
type BookingId = Brand<string, 'BookingId'>;
type ReviewId = Brand<string, 'ReviewId'>;
type EventId = Brand<string, 'EventId'>;
type CommandId = Brand<string, 'CommandId'>;
type RequestId = Brand<string, 'RequestId'>;
type UtcInstant = Brand<string, 'UtcInstant'>;
type LocalDateTime = Brand<string, 'LocalDateTime'>;
type IdempotencyKey = Brand<string, 'IdempotencyKey'>;
type Version = Brand<number, 'Version'>;

type CurrencyCode = Brand<string, 'CurrencyCode'>;
type Money = Readonly<{ minorUnits: number; currency: CurrencyCode }>;
type Actor =
  | { kind: 'user'; userId: UserId }
  | { kind: 'system'; reason: 'retention' | 'account_deletion' };

type CommandContext = Readonly<{
  workspaceId: WorkspaceId;
  actor: Actor;
  commandId: CommandId;
  requestId: RequestId;
  now: UtcInstant;
}>;
type QueryContext = Readonly<{ workspaceId: WorkspaceId; actorUserId: UserId }>;
```

The principal lifecycle types are closed unions and transition functions are exhaustive (per `model-the-domain` and `type-system-discipline`). Persistence may store strings, but only boundary mappers can construct these values.

```ts
type ConsentDecision = 'unknown' | 'granted' | 'withdrawn';
type CustomerLifecycle = 'enquiry' | 'active' | 'dormant' | 'booked' | 'archived';
type CampaignState =
  | { kind: 'draft'; version: Version; editable: true }
  | { kind: 'ready'; version: Version; finalizedAt: UtcInstant }
  | { kind: 'closed'; version: Version; closedAt: UtcInstant };
type RecipientState =
  | { kind: 'prepared'; preparedAt: UtcInstant }
  | { kind: 'skipped'; skippedAt: UtcInstant; reason: string }
  | { kind: 'sent'; markedAt: UtcInstant } // owner assertion, never provider delivery
  | { kind: 'replied'; markedAt: UtcInstant }
  | { kind: 'booked'; bookingId: BookingId; markedAt: UtcInstant };
type BookingState =
  | { kind: 'confirmed' }
  | { kind: 'completed'; at: UtcInstant }
  | { kind: 'cancelled'; at: UtcInstant; reason?: string }
  | { kind: 'no_show'; at: UtcInstant };
type ReviewResponseState =
  | { kind: 'unanswered' }
  | { kind: 'drafted'; revisedAt: UtcInstant }
  | { kind: 'posted_manually'; postedAt: UtcInstant };
```

`Campaign` can be edited only in `draft`; finalization creates the reviewed recipient snapshot. Recipient transitions are `prepared -> skipped|sent`, `sent -> replied|booked`, and `replied -> booked`. A campaign-attributed booking is accepted only when the customer is a recipient whose outcome is `sent` or `replied`; otherwise the booking can still be recorded without attribution. Booking transitions are `confirmed -> completed|cancelled|no_show`. A later correction is a separate command requiring a reason and produces a correction event rather than rewriting history silently. Consent `withdrawn -> granted` requires new provenance and a new timestamp.

The ledger is an envelope plus a discriminated payload. It stores operational facts and audit-safe metadata, not message bodies, password material, session tokens, raw imported rows, review response text, or customer notes.

```ts
type OperationalEvent = Readonly<{
  eventId: EventId;
  schemaVersion: 1;
  workspaceId: WorkspaceId;
  commandId: CommandId;
  ordinal: number;
  occurredAt: UtcInstant;
  actor: Actor;
  requestId: RequestId;
  subject: {
    kind: 'customer' | 'campaign' | 'recipient' | 'booking' | 'review' | 'workspace';
    id: string;
  };
  payload: OperationalEventPayload;
}>;

type OperationalEventPayload =
  | { type: 'enquiry.created'; source: ContactSource; quotedMinorUnits?: number }
  | {
      type: 'consent.recorded';
      channel: ContactChannel;
      decision: Exclude<ConsentDecision, 'unknown'>;
      consentRecordId: string;
    }
  | { type: 'follow_up.prepared'; campaignId: CampaignId; recipientId: CampaignRecipientId }
  | { type: 'follow_up.marked_sent'; campaignId: CampaignId; recipientId: CampaignRecipientId }
  | { type: 'reply.recorded'; campaignId?: CampaignId; customerId: CustomerId }
  | {
      type: 'campaign.draft_changed';
      campaignId: CampaignId;
      fromVersion: Version;
      toVersion: Version;
      changedFields: readonly string[];
    }
  | { type: 'campaign.finalized'; campaignId: CampaignId; recipientCount: number }
  | {
      type: 'campaign.outcome_changed';
      campaignId: CampaignId;
      recipientId: CampaignRecipientId;
      outcome: RecipientState['kind'];
    }
  | {
      type: 'booking.recorded';
      bookingId: BookingId;
      customerId: CustomerId;
      agreedMinorUnits: number;
      currency: CurrencyCode;
      sourceCampaignId?: CampaignId;
    }
  | {
      type: 'booking.status_changed';
      bookingId: BookingId;
      from: BookingState['kind'];
      to: BookingState['kind'];
    }
  | { type: 'review.response_prepared'; reviewId: ReviewId }
  | { type: 'review.marked_posted'; reviewId: ReviewId }
  | { type: 'workspace.settings_changed'; changedFields: readonly string[] }
  | { type: 'account.deletion_requested' };
```

The event union is the required `AuditEvent` concept in a stronger form: `AuditEventView` is a redacted presentation derived through an exhaustive registry. Reports also map event types exhaustively. Normal application code receives no update/delete ledger method. Account deletion and an approved retention purge are the documented exceptions to append-only storage.

### Command and query signatures

There is no generic command bus. Each public command method names a business operation and hides its state checks, transaction, current-document write, ledger append, and receipt handling.

```ts
interface CustomerCommands {
  createEnquiry(ctx: CommandContext, command: CreateEnquiry): Promise<CreateEnquiryResult>;
  update(ctx: CommandContext, command: UpdateCustomer): Promise<Customer>;
  recordInteraction(ctx: CommandContext, command: RecordInteraction): Promise<Interaction>;
  recordConsent(ctx: CommandContext, command: RecordConsent): Promise<ConsentRecord>;
}

interface CampaignCommands {
  createDraft(ctx: CommandContext, command: CreateCampaignDraft): Promise<Campaign>;
  updateDraft(
    ctx: CommandContext,
    command: UpdateCampaignDraft & { expectedVersion: Version },
  ): Promise<Campaign>;
  removeRecipient(
    ctx: CommandContext,
    command: RemoveRecipient & { expectedVersion: Version },
  ): Promise<Campaign>;
  finalize(
    ctx: CommandContext,
    command: FinalizeCampaign & { expectedVersion: Version },
  ): Promise<Campaign>;
  recordOutcome(
    ctx: CommandContext,
    command: RecordRecipientOutcome & { idempotencyKey: IdempotencyKey },
  ): Promise<CampaignRecipient>;
}

interface BookingCommands {
  record(
    ctx: CommandContext,
    command: RecordBooking & { idempotencyKey: IdempotencyKey },
  ): Promise<Booking>;
  changeStatus(ctx: CommandContext, command: ChangeBookingStatus): Promise<Booking>;
  correct(ctx: CommandContext, command: CorrectBooking & { reason: string }): Promise<Booking>;
}

interface ReviewCommands {
  create(ctx: CommandContext, command: CreateReview): Promise<Review>;
  prepareResponse(ctx: CommandContext, command: PrepareReviewResponse): Promise<Review>;
  markPosted(ctx: CommandContext, command: MarkReviewPosted): Promise<Review>;
}

interface TodayQueries {
  get(ctx: QueryContext, query: TodayQuery): Promise<TodayView>;
}
interface ResultQueries {
  summarize(ctx: QueryContext, query: ResultsQuery): Promise<ResultsView>;
  exportCsv(ctx: QueryContext, query: ResultsQuery): Promise<SafeCsvStream>;
}
interface AuditQueries {
  list(ctx: QueryContext, query: AuditQuery): Promise<CursorPage<AuditEventView>>;
}
```

Pure policy functions sit beside their owning feature, for example `evaluateEligibility(customer, latestConsent, bookings, at)`, `rankFollowUp(candidate, rules, at)`, `transitionRecipient(state, outcome)`, and `personalize(template, allowedVariables)`. They accept domain values and return decisions or typed domain errors; they know nothing about Mongoose, Express, or Zod. Boundary schemas parse once and internal functions trust those types (per `boundary-discipline`).

The small future-provider boundary returns truthful capabilities:

```ts
type PreparedContactAction =
  | { kind: 'owner_initiated_link'; url: URL; canClaimDelivery: false }
  | {
      kind: 'provider_submission';
      provider: string;
      dispatchToken: string;
      canClaimDelivery: false;
    };

interface FollowUpProvider {
  prepare(input: PreparedMessage): Promise<PreparedContactAction>;
}
```

V1 supplies `WhatsAppClickToChatProvider`; opening a link records no delivery. A future Cloud API adapter may return a dispatch token, but provider acceptance/delivery must enter through separately authenticated provider-receipt commands before the UI can claim it.

### Module map

```text
packages/contracts/src/
  auth.ts, customers.ts, campaigns.ts, bookings.ts, reviews.ts, results.ts
  errors.ts, pagination.ts, openapi.ts

apps/api/src/
  app/                  Express composition, middleware order, route registration
  platform/
    config/             environment parsing
    mongo/              connection, transaction runner, health/readiness
    http/               request IDs, errors, limits, rate limits, secure headers
    auth/               passwords, sessions, CSRF, password-reset tokens
    idempotency/        atomic command receipts
    events/             event append-only store, redaction registry, audit queries
    csv/                bounded parsing and formula-safe export
  customers/            routes, commands, model/policy, queries, Mongoose store
  campaigns/            routes, commands, model/policy, queries, provider adapter, store
  bookings/             routes, commands, model/policy, queries, store
  reviews/              routes, commands, model/policy, queries, store
  today/                composed read query and transparent ranking reasons
  results/              ledger/booking aggregations and CSV export
  workspace/            onboarding, settings, export, deletion

apps/web/src/
  app/                   App Router pages and route layouts
  features/              screen-owned view models, forms, query/mutation hooks
  api/                   generated contract client and error mapping
  ui/                    small accessible primitives and custom icon set
```

A route adds transport policy; a command service adds domain and transaction policy; a feature-local store adds Mongo representation and atomic write semantics. None merely forwards an unchanged call. A mutation is traceable through at most route, command, and store/model files.

### Data access and transaction paths

For a normal command, the command service starts a Mongo session, checks any receipt, loads workspace-scoped current state, runs pure policy, writes documents using compare-and-swap where relevant, appends one or more `OperationalEvent` records, and commits the receipt/result reference. Those writes commit together. A process crash leaves either all facts or none. Transient transaction errors are retried by the transaction runner; pure decision code can be re-run safely.

Dominant reads are direct, not event replay:

- **Today:** indexed customer candidates by workspace, lifecycle, and last interaction; latest consent records and active bookings in bounded bulk queries; pure ranking emits both score and human-readable reason codes. Recent activity reads the ledger by `(workspaceId, occurredAt, _id)`. Period booking totals read bookings.
- **Customer detail:** one customer plus independently paginated interactions, consent history, bookings, and campaign recipients by customer ID.
- **Campaign review:** campaign plus recipients by campaign ID and stable cursor. Finalization re-checks eligibility in bulk and records exclusion reasons; the preview is never trusted as authorization.
- **Results:** counts enquiry/prepared/sent/reply facts from `operational_events`; booking count, status, agreed value, and valid attribution from `bookings`. Recorded booking value is labeled separately from quoted value, and collected revenue is absent until the product stores a real payment fact.
- **Audit:** the ledger is cursor-paginated and redacted by event type. Full sensitive before/after documents are deliberately absent.
- **CSV import:** a bounded `ImportBatch` stores parsed, normalized staging rows and duplicate candidates. Confirmed rows call the same customer command policy in chunks; raw uploads expire and never bypass duplicate or consent rules.

`ConsentRecord` is immutable history and the latest record per customer/channel is authoritative for eligibility. The corresponding ledger event references that record rather than duplicating its evidence. Interactions and reviews preserve original text in their protected operational collections; the ledger carries only safe facts and references.

### API and resource boundaries

All endpoints live under `/api/v1`; health endpoints are `/api/v1/health/live` and `/api/v1/health/ready`. Representative resources are:

```text
GET    /auth/csrf
POST   /auth/register, /auth/sign-in, /auth/sign-out
POST   /auth/password-reset-requests, /auth/password-resets
GET    /session
POST   /workspaces; PATCH /workspace/settings
POST   /workspace/exports; DELETE /workspace/account
GET/POST/PATCH /customers, /customers/:customerId
GET/POST /customers/:customerId/interactions
GET/POST /customers/:customerId/consents
POST   /customer-imports; POST /customer-imports/:importId/confirm
GET/POST /campaigns; GET/PATCH /campaigns/:campaignId
POST   /campaigns/:campaignId/finalize
DELETE /campaigns/:campaignId/recipients/:recipientId
POST   /campaigns/:campaignId/recipients/:recipientId/outcomes
GET/POST/PATCH /bookings, /bookings/:bookingId
GET/POST /reviews; PATCH /reviews/:reviewId/response
POST   /reviews/:reviewId/mark-posted
GET    /today, /results, /results.csv, /audit-events
GET    /openapi.json
```

Collection and item endpoints use validated filters, allowlisted sorts, maximum page sizes, and opaque cursors. Responses are DTOs, never raw Mongoose documents. Errors use one envelope: `{ error: { code, message, requestId, fieldErrors?, details? } }`; stable codes include `VALIDATION_FAILED`, `UNAUTHENTICATED`, `FORBIDDEN`, `DUPLICATE_REVIEW_REQUIRED`, `CONSENT_REQUIRED`, `INVALID_TRANSITION`, `IDEMPOTENCY_KEY_REUSED`, and `CAMPAIGN_VERSION_CONFLICT`.

Every repository method requires `workspaceId` in its criteria. The request cannot override it. Object-level authorization returns a non-enumerating `404` for another workspace, while authenticated actions forbidden at a known workspace boundary return `403`.

### Authentication, sessions, and CSRF

Passwords use Argon2id with centrally configured parameters. Session identifiers are 256-bit random values; only a hash is stored in the `sessions` collection. The cookie is `__Host-growthos_session`, `HttpOnly`, `Secure` in production, `SameSite=Lax`, and `Path=/`. Session IDs rotate at sign-in, password reset, and privilege-bearing account changes. Sessions have idle and absolute expiry, TTL cleanup, explicit revocation, and a user session-version check so password reset or account deletion can revoke all sessions.

`GET /auth/csrf` creates or refreshes a short-lived anonymous session and returns a one-time raw token whose hash is stored server-side. Registration or sign-in validates the token plus an allowlisted `Origin`, then rotates both session and CSRF token. Authenticated unsafe requests send the latest raw token in `X-CSRF-Token`; the API compares its hash to the session and also validates `Origin`. A reload obtains a fresh token through the safe session endpoint. Sign-out and account deletion are CSRF protected. Authentication routes have tighter IP-plus-identifier limits and generic responses that do not enumerate accounts. Password-reset tokens are random, stored hashed, single-use, and TTL indexed.

### Idempotency and concurrency

Booking creation and campaign outcome changes require `Idempotency-Key`. The scope is `(workspaceId, operation, key)`. A canonical request hash and the stable result reference are stored in `command_receipts` inside the same transaction as domain documents and ledger entries. Same key plus same hash replays the original DTO; same key plus different hash fails with `IDEMPOTENCY_KEY_REUSED`. A unique index resolves concurrent first attempts: the loser waits for the winning transaction and then replays. Receipts are retained until workspace deletion because expiring a booking key could silently permit a second booking.

Editable campaigns carry an integer `version`. `PATCH`, recipient removal, and finalization require `If-Match`; the store updates with `{ _id, workspaceId, version: expectedVersion }` and increments version atomically. A miss returns `412` with `CAMPAIGN_VERSION_CONFLICT` and the current ETag, without leaking draft content. Outcome commands are idempotent recipient operations after finalization and do not mutate the draft version. Customer consent decisions serialize by customer document version so two concurrent decisions cannot both believe they were latest.

### Contracts and OpenAPI

`packages/contracts` owns request, query, response, and error Zod schemas. TypeScript wire types are inferred from those schemas. The API converts them to domain commands at the route boundary; domain modules never import transport DTOs. The OpenAPI registry is generated from those same route schemas and route metadata during build, served at `/api/v1/openapi.json`, and committed for review. CI regenerates it and fails on drift. Integration tests validate representative responses and every error envelope against the registered schemas. This makes the real route schemas authoritative without leaking wire types into the domain.

### Collections and indexes

Every business-owned collection stores `workspaceId`. Proposed indexes match the traced access paths:

```text
users:                 unique(normalizedEmail)
business_workspaces:   unique(ownerUserId)
customers:             (workspaceId, normalizedPhone)
                       (workspaceId, normalizedEmail)
                       (workspaceId, lifecycleStatus, lastInteractionAt desc, _id)
interactions:          (workspaceId, customerId, occurredAt desc, _id)
consent_records:       (workspaceId, customerId, channel, recordedAt desc, _id desc)
campaigns:             (workspaceId, status, updatedAt desc, _id)
campaign_recipients:   unique(workspaceId, campaignId, customerId)
                       (workspaceId, campaignId, status, _id)
                       (workspaceId, customerId, createdAt desc)
bookings:              (workspaceId, appointmentAt desc, _id)
                       (workspaceId, customerId, appointmentAt desc)
                       (workspaceId, sourceCampaignId, appointmentAt desc)
reviews:               (workspaceId, responseStatus, reviewedAt desc, _id)
operational_events:    unique(workspaceId, commandId, ordinal)
                       (workspaceId, occurredAt desc, _id desc)
                       (workspaceId, payload.type, occurredAt desc, _id desc)
                       (workspaceId, subject.kind, subject.id, occurredAt desc, _id desc)
command_receipts:      unique(workspaceId, operation, idempotencyKeyHash)
sessions:              unique(sessionTokenHash), TTL(expiresAt)
password_reset_tokens: unique(tokenHash), TTL(expiresAt)
import_batches:        (workspaceId, createdAt desc), TTL(expiresAt)
```

Phone/email indexes are intentionally non-unique: duplicates must be reviewed, not silently merged or made impossible to represent. Creation returns possible matches and requires a short-lived confirmation token to proceed. Cursor pagination uses the indexed sort plus `_id` as a stable tie-breaker. Explain-plan tests cover seeded Today, customer search/detail, campaign recipients, results, bookings, and audit queries.

### Docker topology

The deployable topology is still three runtime containers on one private Compose network:

```text
browser -> web:3000 (Next.js; /api/v1/* rewrite) -> api:4000 (Express) -> mongo:27017
```

Only `web` is publicly exposed in production. `api` and MongoDB are network-internal; MongoDB has a persistent volume. Development may bind API diagnostics and MongoDB to loopback only. MongoDB runs as a single-node replica set in local Compose because command atomicity depends on transactions; a one-shot initialization step creates the replica set. Production documentation requires a replica-set-capable MongoDB deployment, even if it has one member in the portfolio environment. API readiness checks config, Mongo connectivity, replica-set transaction support, and indexes; liveness checks only the process. Web health verifies the Next.js process and the API rewrite path. Production web and API Dockerfiles use lockfile-backed `npm ci`, non-root users, build/runtime stages, and no development secrets.

The API process may run bounded, lease-based account-deletion and export jobs from MongoDB; these are modules inside the same service, not separate microservices or event consumers. Ledger reporting remains request-time aggregation and has no projection worker.

### UI composition direction

Use an **operations register with a detail inspector**. On laptop and wider screens, a narrow ink text-navigation rail frames a broad warm mineral-gray register. Today is a dense, single priority list with aligned columns for reason, service, source, elapsed time, consent, quoted value, and next action; selecting a row opens a fixed right inspector with customer context and the one available command. Recent activity is a chronological ledger below the queue, not a competing card grid. On phone, every row becomes a labeled record with the reason and next action first; the inspector becomes a full-height dialog with focus restoration, so no capability disappears.

Campaign composition uses a two-pane working surface: editable audience/template controls on the left and the currently selected recipient's exact preview and eligibility facts on the right. The Results screen is a compact measure table followed by a plain time series and attribution table. Use IBM Plex Sans, deep blue-green navigation, mineral-gray surfaces, restrained ochre for attention, high contrast, sharp 2–4px corners, dividers instead of shadows, visible focus rings, and short press/save/dialog motion disabled under reduced motion. Pending controls keep their label and add textual progress; errors preserve form input; saved and offline states are explicit. No gradients, bento cards, skeletons, hover motion, Lucide icons, testimonials, or decorative metrics.

### Interface depth

The command interfaces are small relative to what they hide: tenant enforcement, transition rules, eligibility, duplicate review, transactional writes, ledger facts, audit redaction, and replay safety. Callers supply business intent, not load/validate/save stages. Query services hide Mongo joins and event aggregation behind screen-shaped outputs without becoming a generic data-access API. The remaining exposed concerns—ETags, idempotency keys, and CSRF tokens—are real distributed-system/browser semantics that callers must participate in; hiding them would make failure behavior less honest.

## Red-flag screen

- **Shallow module — pass.** Each command method completes a business operation and hides several invariants and an atomic commit. Query methods return screen/report capabilities rather than repository fragments. Revise if callers begin coordinating `load`, `validate`, `append`, and `save` themselves.
- **Information leakage — pass with watch item.** Zod DTOs, Mongoose schemas, event persistence, and domain types are separate. Only explicit domain mappers cross boundaries. The event-type registry is a deliberate shared contract for reports and audit; exhaustive compilation and one owning `events` module prevent parallel string switches.
- **Temporal decomposition — pass.** Modules own customer, campaign, booking, review, auth, or ledger knowledge, not phases named parse/validate/transform/save. Transaction order exists inside command implementations, not as public workflow modules. Import staging is a resource lifecycle, not a generic processing pipeline.
- **Pass-through method — pass.** Routes add parsing/auth/HTTP semantics, commands add policy/transaction semantics, and stores add persistence/compare-and-swap semantics. A method that only forwards the same arguments should be deleted during implementation.

## Synthesis decision

Pending arena synthesis. Candidate B should be selected when the team values first-class audit/report facts and explicit mutation intent while retaining conventional operational documents and a single deployable API. If another candidate has a smaller mutation surface, graft this ledger envelope, same-transaction receipt pattern, and report provenance rather than importing a generic event bus.

## Tradeoffs accepted

- We accept transactional write fan-out to current documents, command receipts, and ledger entries in exchange for atomic replay safety and trustworthy reporting history.
- We accept a replica-set requirement in local and production MongoDB in exchange for all-or-nothing command facts.
- We accept request-time event aggregation in exchange for having no projection worker, broker, or eventually consistent report store in V1.
- We accept non-unique normalized contact indexes and an explicit duplicate-confirmation flow in exchange for preserving legitimate shared contact details and never silently merging people.
- We accept ledger payload curation and less forensic detail in exchange for avoiding durable copies of message bodies and sensitive notes.
- We accept ETags and idempotency keys in the web client in exchange for explicit, testable concurrent-edit and retry behavior.

## Alternatives considered

- **Full event sourcing with projections:** it makes the ledger authoritative and can rebuild all reads, but exposes replay/versioning/projection lag to every feature and adds large operational machinery. It hides less complexity from screen and correction callers than this current-state-plus-facts shape.
- **CRUD services with a generic audit middleware:** it is initially smaller, but middleware cannot know business meaning, valid attribution, or honest sent/delivered distinctions. Callers would still coordinate audit payloads, and reports would infer facts from mutable documents.
- **Generic command bus and handler registry:** it centralizes dispatch mechanics but adds a pass-through abstraction and weakens discoverability. Direct typed command services keep call chains shorter and make operation-specific idempotency and concurrency visible.

## Open questions and risks

- What legal retention period should apply to consent evidence, operational events, exports, and deleted-workspace backups in the first production policy?
- Should booking corrections permit reopening every terminal status, or only a documented subset approved after owner research?
- At what measured event volume should Results move from request-time aggregation to an in-process, transactionally maintained daily rollup?
- Does V1 need multiple simultaneous browser sessions per user, and what idle/absolute session durations match the target owners' real usage?
- Should deliberate creation after a duplicate warning require only confirmation, or also an owner-supplied reason stored in the audit fact?
- Can a campaign-attributed booking be valid after `prepared` when the owner forgot to mark `sent`, or should the strict `sent|replied` evidence rule remain?

## Next implementation step

After synthesis, define the authoritative domain unions, transition-table tests, event registry, and Zod boundary contracts for the Phase 3 vertical slice before creating Mongoose schemas or Express handlers.
