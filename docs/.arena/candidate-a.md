# Candidate A: resource-oriented modular monolith

## Usage (caller's view)

The Next.js application talks to one same-origin REST API. Its local `growthApi` client owns cookies, CSRF headers, request IDs, error decoding, idempotency keys, and ETags. Screens deal only in contract inputs and view responses.

```ts
const customer = await growthApi.customers.create({
  firstName: 'Maya',
  phone: '+44 7700 900123',
  source: 'instagram',
  enquiry: {
    service: 'Balayage',
    quotedMoney: { currency: 'GBP', minorUnits: 16500 },
    receivedAt: '2026-09-21T16:30:00.000Z',
    originalText: 'Can I book balayage next month?',
  },
  consent: { channel: 'whatsapp', decision: 'granted', capturedAt: '2026-09-21T16:30:00.000Z' },
});
```

The customer screen receives possible duplicates as a review result. It never receives an implicit merge result.

```ts
const draft = await growthApi.campaigns.get(campaignId);

await growthApi.campaigns.update(
  campaignId,
  { name: 'October colour follow-up', template: 'Hi {first_name}, ...' },
  { expectedVersion: draft.version },
);

const review = await growthApi.campaigns.reviewRecipients(campaignId);
// review.items explains eligible and excluded recipients with stable reason codes.
```

Booking submission remains safe across a lost response and browser retry.

```ts
const submissionKey = crypto.randomUUID();
await growthApi.bookings.create(
  {
    customerId,
    service: 'Balayage',
    appointmentAt: '2026-10-07T13:00:00.000Z',
    agreedMoney: { currency: 'GBP', minorUnits: 15000 },
    sourceCampaignRecipientId,
  },
  { idempotencyKey: submissionKey },
);
```

Inside the API, an authenticated route maps a validated wire request to one domain command. The service completes the use case and returns a domain result. The presenter maps that result to an explicit response schema.

```ts
const result = await campaignService.recordRecipientOutcome(context, recipientId, {
  commandId: idempotencyKey,
  outcome: { kind: 'replied', recordedAt: clock.now() },
});
```

## Problem

Growth OS must preserve enquiry context, permission, follow-up decisions, booking facts, review work, and audit history for one business per account. It must keep these facts distinct enough to report honestly while supporting a fast daily queue. The hard parts are tenant isolation, consent-aware campaign eligibility, retry-safe mutations, concurrent campaign edits, and cross-resource read views. This candidate keeps one deployable Express API and one MongoDB database, but divides the process by domain knowledge rather than request stages.

## Shape

### Domain types and state transitions

External JSON and MongoDB documents are untrusted boundary values. Zod parses HTTP shapes in `packages/contracts`; repository mappers parse persisted rows. Domain code receives branded identifiers and constructed values only, per type-system-discipline and boundary-discipline.

```ts
type Brand<T, Name extends string> = T & { readonly __brand: Name };
type WorkspaceId = Brand<string, 'WorkspaceId'>;
type UserId = Brand<string, 'UserId'>;
type CustomerId = Brand<string, 'CustomerId'>;
type CampaignId = Brand<string, 'CampaignId'>;
type CampaignRecipientId = Brand<string, 'CampaignRecipientId'>;
type BookingId = Brand<string, 'BookingId'>;
type ReviewId = Brand<string, 'ReviewId'>;
type Instant = Brand<string, 'UtcIsoInstant'>;
type Version = Brand<number, 'AggregateVersion'>;

type Money = Readonly<{ currency: CurrencyCode; minorUnits: number }>;
type PageCursor = Brand<string, 'OpaquePageCursor'>;
type Page<T> = Readonly<{ items: readonly T[]; nextCursor: PageCursor | null }>;

type CustomerLifecycle = 'enquiry' | 'contacted' | 'replied' | 'dormant' | 'closed';
type ConsentChannel = 'whatsapp' | 'email' | 'phone' | 'sms';
type ConsentDecision = 'granted' | 'withdrawn';
type CampaignState = 'draft' | 'ready' | 'active' | 'completed' | 'archived';
type RecipientOutcome =
  | { kind: 'prepared' }
  | { kind: 'sent'; at: Instant }
  | { kind: 'skipped'; at: Instant; reason: SkipReason }
  | { kind: 'replied'; at: Instant }
  | { kind: 'booked'; at: Instant; bookingId: BookingId };
type RecipientOutcomeEvent = Readonly<{
  recipientId: CampaignRecipientId;
  from: RecipientOutcome['kind'];
  to: RecipientOutcome;
  recordedAt: Instant;
}>;
type BookingState = 'scheduled' | 'completed' | 'cancelled' | 'no_show';
type ReviewResponseState =
  | { kind: 'unanswered' }
  | { kind: 'drafted'; text: string; updatedAt: Instant }
  | { kind: 'posted_manually'; text: string; postedAt: Instant };
```

`Money` constructors reject unsafe integers, negative values where the command forbids them, and currency values that differ from the workspace. All persisted timestamps are UTC instants. Presentation uses the workspace IANA timezone. A booking is the only source of booking value. Quoted money remains on the enquiry. Collected revenue does not exist until a future payment record supplies that fact.

Consent records are append-only. Current permission is the latest decision for a customer and channel, ordered by `capturedAt` and record ID. A withdrawal therefore suppresses later audience selection without mutating history. Campaign recipients store the consent record and eligibility explanation used during the last review, but activation rechecks current facts. A stored snapshot never overrides a later withdrawal.

Campaign outcome events are also append-only. `CampaignRecipient.currentOutcome` is a private projection for workflow queries; the outcome event history is the source for sent, replied, and booked counts. This prevents a later reply from erasing the earlier sent fact.

State changes use total transition functions. Invalid transitions return stable domain errors.

```ts
function transitionCampaign(
  current: CampaignState,
  command: CampaignCommand,
): Result<CampaignState, TransitionError>;
function transitionRecipient(
  current: RecipientOutcome,
  command: OutcomeCommand,
): Result<RecipientOutcome, TransitionError>;
function transitionBooking(
  current: BookingState,
  command: BookingCommand,
): Result<BookingState, TransitionError>;
function transitionCustomer(
  current: CustomerLifecycle,
  command: CustomerCommand,
): Result<CustomerLifecycle, TransitionError>;
function transitionReview(
  current: ReviewResponseState,
  command: ReviewCommand,
): Result<ReviewResponseState, TransitionError>;

interface CampaignService {
  create(context: WorkspaceContext, command: CreateCampaign): Promise<Campaign>;
  update(
    context: WorkspaceContext,
    id: CampaignId,
    expected: Version,
    patch: CampaignPatch,
  ): Promise<Campaign>;
  reviewRecipients(context: WorkspaceContext, id: CampaignId): Promise<RecipientReview>;
  activate(context: WorkspaceContext, id: CampaignId, expected: Version): Promise<Campaign>;
  recordRecipientOutcome(
    context: WorkspaceContext,
    id: CampaignRecipientId,
    command: IdempotentOutcomeCommand,
  ): Promise<CampaignRecipient>;
  exportRecipients(context: WorkspaceContext, id: CampaignId): Promise<CsvStream>;
}

interface BookingService {
  create(context: WorkspaceContext, command: Idempotent<CreateBooking>): Promise<Booking>;
  transition(context: WorkspaceContext, id: BookingId, command: BookingCommand): Promise<Booking>;
}

interface CustomerService {
  create(context: WorkspaceContext, command: CreateCustomer): Promise<CreateCustomerResult>;
  addConsent(
    context: WorkspaceContext,
    id: CustomerId,
    command: RecordConsent,
  ): Promise<ConsentRecord>;
  addInteraction(
    context: WorkspaceContext,
    id: CustomerId,
    command: AddInteraction,
  ): Promise<Interaction>;
  importCsv(context: WorkspaceContext, input: SafeCsvInput): Promise<ImportPreview>;
  commitImport(context: WorkspaceContext, command: CommitReviewedImport): Promise<ImportResult>;
}
```

The campaign interface is deep. It hides audience evaluation, current-consent resolution, booking exclusions, personalization, recipient snapshotting, optimistic locking, auditing, and transactional persistence behind five mutation operations. Callers still choose the audience, message, and reviewed recipients because those are product decisions. They do not coordinate validation, lookups, or writes themselves.

### Module map

```text
apps/api/src/
  bootstrap/                 config parsing, dependency assembly, shutdown
  http/                      Express setup, request context, errors, rate limits
  modules/
    identity/                User, Session, PasswordReset; registration and auth
    workspaces/              BusinessWorkspace, onboarding, preferences, deletion
    customers/               Customer, ConsentRecord, Interaction, CSV import
    campaigns/               Campaign, recipients, outcome events, eligibility, messages
    bookings/                Booking and campaign attribution validation
    reviews/                 Review import and response workflow
    today/                   ranked workspace query and reason calculation
    reporting/               stored-fact metrics and CSV results export
    audit/                   append-only AuditEvent writer and workspace query
  platform/
    mongo/                   connection, transactions, base persistence utilities
    security/                password hashing, tokens, CSRF, headers, redaction
    csv/                     bounded parser and formula-safe exporter
    observability/           request IDs, structured logs, health probes
```

Each domain module owns its routes, service, domain functions, repository contract, Mongo implementation, and document mapper. Modules expose service interfaces and narrow read ports, never Mongoose models. `today` and `reporting` are read modules because they own ranking and metric definitions. They query source collections but do not own source writes. Campaign eligibility belongs to `campaigns`; it consumes `CustomerContactFactsReader` and `BookingFactsReader` ports. Booking attribution belongs to `bookings`; it verifies the referenced recipient and customer before storing the relationship.

Normal call depth is route, service, repository. Pure policy functions sit beside the service and do not create another forwarding layer. Cross-module writes go through the owning service. Audit writes join the same Mongo transaction as the sensitive change.

### Data access paths

Repositories are created with a `WorkspaceId`; their methods cannot issue unscoped business queries. Raw Mongoose models stay private. Identity lookups are the only unscoped business path and use normalized login email or hashed session token.

| Access path                 | Collection and index                                                                                                       |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Sign in                     | `users { normalizedEmail: 1 }`, unique                                                                                     |
| Resolve session             | `sessions { tokenHash: 1 }`, unique; `{ expiresAt: 1 }`, TTL                                                               |
| Customer duplicate review   | `customers { workspaceId: 1, normalizedPhone: 1 }`; `{ workspaceId: 1, normalizedEmail: 1 }`, both non-unique              |
| Customer filters            | `customers { workspaceId: 1, lifecycle: 1, updatedAt: -1, _id: -1 }`                                                       |
| Today candidates            | `customers { workspaceId: 1, lifecycle: 1, lastInteractionAt: 1, _id: 1 }`                                                 |
| Current consent             | `consentRecords { workspaceId: 1, customerId: 1, channel: 1, capturedAt: -1, _id: -1 }`                                    |
| Customer timeline           | `interactions { workspaceId: 1, customerId: 1, occurredAt: -1, _id: -1 }`                                                  |
| Campaign list               | `campaigns { workspaceId: 1, state: 1, updatedAt: -1, _id: -1 }`                                                           |
| Campaign recipient          | `campaignRecipients { workspaceId: 1, campaignId: 1, _id: 1 }`; `{ workspaceId: 1, campaignId: 1, customerId: 1 }`, unique |
| Campaign outcomes by period | `campaignOutcomeEvents { workspaceId: 1, recordedAt: -1, _id: -1 }`; `{ workspaceId: 1, recipientId: 1, recordedAt: 1 }`   |
| Booking period              | `bookings { workspaceId: 1, appointmentAt: -1, _id: -1 }`                                                                  |
| Customer bookings           | `bookings { workspaceId: 1, customerId: 1, appointmentAt: -1 }`                                                            |
| Reviews needing work        | `reviews { workspaceId: 1, responseKind: 1, createdAt: -1, _id: -1 }`                                                      |
| Audit timeline              | `auditEvents { workspaceId: 1, occurredAt: -1, _id: -1 }`                                                                  |
| Retry receipt               | `commandReceipts { workspaceId: 1, operation: 1, keyHash: 1 }`, unique; `{ expiresAt: 1 }`, TTL                            |

`Customer.lastInteractionAt` is a private query projection. The customer module updates it in the same transaction that appends an interaction. No command accepts it. Interactions remain the authoritative history. Today uses a bounded Mongo aggregation over candidate customers, latest consent, and active bookings, then applies a pure ranking function. It returns a reason-code list such as `FOLLOW_UP_OVERDUE` or `HIGH_QUOTED_VALUE`; it does not return a hidden score as an explanation.

Cursor pagination uses the final sort fields plus `_id`. User-selected sorts map through an allowlist to indexed plans. The API rejects arbitrary field names and Mongo operators. Customer and audit list endpoints never use unbounded offset scans.

### API and resource boundaries

All business endpoints live under `/api/v1`. Representative resources are:

```text
POST   /auth/register                    POST   /auth/login
POST   /auth/logout                      POST   /auth/password-resets
PUT    /auth/password-reset              GET    /auth/csrf
GET    /workspace                        PATCH  /workspace
DELETE /workspace/account
GET    /today
GET    /customers                        POST   /customers
GET    /customers/{id}                   PATCH  /customers/{id}
POST   /customers/{id}/consents          POST   /customers/{id}/interactions
POST   /customer-imports/preview          POST   /customer-imports
GET    /campaigns                        POST   /campaigns
GET    /campaigns/{id}                   PATCH  /campaigns/{id}
POST   /campaigns/{id}/recipient-review  POST   /campaigns/{id}/activation
DELETE /campaigns/{id}/recipients/{rid}  PUT    /campaign-recipients/{rid}/outcome
GET    /campaigns/{id}/recipient-export
GET    /bookings                         POST   /bookings
PATCH  /bookings/{id}/status
GET    /results                          GET    /results/export
GET    /reviews                          POST   /reviews
PATCH  /reviews/{id}/response             POST   /review-imports
GET    /audit-events                     GET    /data-export
GET    /health/live                      GET    /health/ready
```

`POST /customer-imports/preview` parses a bounded upload and returns a short-lived, server-stored preview ID, proposed mappings, row errors, and duplicate candidates. `POST /customer-imports` accepts that preview ID plus explicit per-row decisions. It cannot silently merge. CSV exports prefix spreadsheet-formula-leading cells with a single quote and set a safe content type.

Success responses use resource-specific schemas. Errors use `{ error: { code, message, fieldErrors?, requestId } }`. Stable codes include `VALIDATION_FAILED`, `NOT_AUTHENTICATED`, `NOT_AUTHORIZED`, `RESOURCE_NOT_FOUND`, `VERSION_CONFLICT`, `IDEMPOTENCY_CONFLICT`, `INVALID_TRANSITION`, and `RATE_LIMITED`. A missing resource outside the active workspace returns `RESOURCE_NOT_FOUND`, which avoids tenant enumeration. No endpoint returns a Mongo document.

### Authentication, session, authorization, and CSRF

Registration creates the user, workspace, initial session, and audit event in one transaction. Argon2id parameters live in validated server configuration and support later rehashing. Login, registration, and password reset have endpoint-specific rate limits keyed by normalized account and network signal. Logs omit credentials, token values, message bodies, and imported row contents.

The browser receives an opaque 256-bit session token in `__Host-growthos.sid`. The database stores only its hash. Production cookies are `Secure`, `HttpOnly`, `SameSite=Lax`, and `Path=/`. Session rotation follows login, password reset, and sensitive account changes. Idle and absolute expirations are checked server-side. Sign-out revokes the current session. Password reset tokens are hashed, single-use, short-lived, and covered by a TTL index.

Each request resolves a `RequestContext` containing `userId`, `workspaceId`, `sessionId`, `requestId`, and the clock. The workspace comes from the authenticated session, never from a client-selected header or request body. Route middleware requires authentication, and workspace-scoped repositories make tenant filtering structural.

`GET /auth/csrf` creates a pre-auth or authenticated server session and returns a random token whose hash is stored with that session. Every state-changing browser request must send the token in `X-CSRF-Token`. The API verifies the session-bound token, `Origin`, and Fetch Metadata before parsing the body. It rotates the token when the session rotates. Same-origin Next.js rewrites keep this flow free of cross-origin cookie exceptions.

### Idempotency and optimistic concurrency

Booking creation and recipient outcome changes require `Idempotency-Key`. The service hashes the key, fingerprints the normalized command, and executes a command-receipt insert, domain write, outcome event where applicable, projection update, and audit append in one Mongo transaction. A retry with the same key and fingerprint returns the stored status and response reference. The same key with a different fingerprint returns `IDEMPOTENCY_CONFLICT`. Receipts expire after a documented retention period. The web client creates one key per user submission and retains it until the request resolves or the user deliberately starts a new submission.

Campaigns carry a monotonic integer `version`. GET responses expose `ETag: "<version>"`. Campaign edits, recipient removal, review, and activation require `If-Match`. The repository performs an atomic match on `_id`, `workspaceId`, and `version`, then increments the version. A stale command returns HTTP 412 with `VERSION_CONFLICT` and the current version. Campaign and recipient writes share a transaction, so a campaign version covers its recipient set as well as its editable fields.

### Contracts and OpenAPI

`packages/contracts` owns Zod schemas for path parameters, query parameters, request bodies, response bodies, and the error envelope. It exports types inferred from those schemas. These are wire contracts, not domain types. The API maps them at the route boundary. The web client parses server responses in development and tests; production may omit redundant success parsing after contract tests prove the server.

A route registry binds method, path, auth requirement, request schemas, response schemas, and stable operation ID in one declaration. Express registration and OpenAPI generation consume that registry. CI regenerates `docs/openapi.json` and fails on a diff, then runs a test that every mounted route has a registry entry. Examples contain invented labels only and never real customer data.

### Docker topology

Development Compose runs `web`, `api`, `mongo`, and a one-shot replica-set initializer. The web container publishes the only application port. Next.js rewrites `/api/v1/*` to the internal API service. The API talks to Mongo over the private Compose network. Mongo uses a named volume, a health check, authentication, and a single-node replica set so local transactions match production semantics.

Production images use separate multi-stage builds for web and API, `npm ci`, pruned runtime dependencies, non-root users, and no source `.env` files. Only web is published. API and Mongo remain on internal networks; Mongo has no host port. Container health checks call web health and API liveness. API readiness also verifies Mongo connectivity and required indexes. The supplied production Compose topology is suitable for a single-host deployment but does not claim high availability. A managed replica set is the production growth path.

### UI composition direction

Direction A is a queue-and-ledger workspace. A compact ink navigation rail frames warm mineral-gray content. Today uses a wide prioritized enquiry ledger with explicit reason labels, consent, service, elapsed time, quoted value, and one primary row action. A narrower recent-activity column shows persisted changes and actual booking totals for the selected period. Sharp dividers, near-square controls, Source Sans 3, brass for selected or pending states, and clay for destructive warnings establish hierarchy without shadows or gradients.

Campaign composition is one continuous work area with audience rules, message editing, and recipient review as named sections, not a hidden wizard. The recipient table keeps exclusion reasons visible. Customer records use a facts header and chronological ledger. On phones, the navigation becomes a compact top bar, tables become labeled record rows, filters open in a modal sheet, and the same primary actions remain available. Buttons use short press-and-release feedback. Dialog entry and save progress are the only routine motion, and reduced-motion preferences remove transforms.

### Design red-flag screen

| Red flag               | Verdict                  | Evidence                                                                                                                                                                                                                                                   |
| ---------------------- | ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Shallow module         | Pass                     | Customer, campaign, identity, and booking services complete use cases behind small command interfaces. `today` and `reporting` hide ranking and aggregation rules rather than exposing query assembly.                                                     |
| Information leakage    | Pass                     | Mongoose documents, Express requests, session tokens, CSV parser rows, and wire contracts stop at their owning boundaries. Cross-module dependencies use branded domain values or narrow fact readers.                                                     |
| Temporal decomposition | Pass                     | Modules own business knowledge. There are no top-level `load`, `validate`, `transform`, or `save` layers. Parsing and persistence stay inside the resource owner.                                                                                          |
| Pass-through method    | Pass with one watch item | The web client adds CSRF, idempotency, ETags, response parsing, and error normalization. Server methods that only forward repository arguments should be deleted during implementation unless they add authorization, policy, transactions, or adaptation. |

## Synthesis decision

No cross-candidate synthesis has happened in this candidate document. Candidate A recommends the resource-oriented modular monolith as the base because it keeps deployment simple, keeps tenant and transaction rules in one process, and still gives each resource one owner. Its defining choice is to allow cross-resource read modules for Today and Results while all writes remain with the owning domain module.

## Tradeoffs accepted

- We accept Mongo transactions and replica-set setup in exchange for atomic idempotency receipts, resource changes, projections, and audit entries.
- We accept a private `lastInteractionAt` projection on Customer in exchange for an indexed Today query. Only the interaction transaction may update it.
- We accept direct read access by Today and Reporting to several collections in exchange for short request paths and no premature read-model service. Those modules cannot write source data.
- We accept manual mapping between wire schemas, domain values, and Mongo documents in exchange for preventing transport and persistence shapes from becoming the domain model.
- We accept a single-host reference production topology in exchange for a reproducible local deployment. The documentation must state that it has no high-availability claim.

## Alternatives considered

- A command bus with handlers and domain events would hide dispatch mechanics, but it would expose eventual consistency and event troubleshooting to every workflow. The first release needs atomic local changes more than replaceable dispatch.
- Separate feature services would isolate deployments, but callers would inherit network failures, distributed authorization, cross-service reporting, and multi-service transactions. One small team and one workspace per account do not justify that interface cost.
- A generic CRUD service plus shared repository would reduce file count, but every caller would need to know consent, transition, audit, and tenant rules. It is a shallow interface and loses resource ownership.
- A fully precomputed Today and Results read model would make reads cheaper, but it adds rebuilds, lag semantics, and another consistency contract before measured load calls for it. Indexed aggregation plus one maintained interaction timestamp is the smaller boundary.

## Open questions and risks

- What retention period should command receipts, sessions, audit events, imports, and deleted-account backups use after legal review?
- Should an existing scheduled booking exclude a customer from every campaign or only campaigns for the same service and time window?
- Which consent evidence fields are required for each source, and does a manually asserted WhatsApp grant meet the intended legal policy?
- Should changing workspace currency be forbidden after the first money record, or should historical records retain their own currency while new records use the new setting?
- How large may an import be before synchronous preview becomes unsafe for memory and request duration?
- Does account deletion erase audit records immediately, or must a minimal, de-identified security record survive for a defined period?
- Will the first production target supply a managed Mongo replica set, or must the single-host Compose deployment carry the initial operational risk?

## Next implementation step

Define the authoritative contract schemas, branded domain values, transition tables, workspace-scoped repository interfaces, and route registry before implementing the first registration-to-booking vertical slice.
