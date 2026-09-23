# Growth OS architecture

## Problem

Growth OS must preserve enquiry context, permission, follow-up work, booking facts, review work, and an audit history for one business per account. It must support a fast daily queue without inferring business results from mutable rows. The hard constraints are tenant isolation, consent-aware campaign eligibility, retry-safe mutations, concurrent campaign editing, honest reporting, and a complete phone workflow.

## Completion predicate

The architecture is implemented only when a clean checkout can start the documented development and production topologies and an independent operator can complete the critical workflow in a browser against Express and MongoDB. The same run must prove workspace isolation, consent exclusion, retry-safe booking creation, stale campaign rejection, restart persistence, mobile completeness, keyboard access, automated accessibility checks, passing builds and tests, indexed common queries, and an audit history. `docs/verification.md` must contain commands, screenshots, measured results, and limits. Any failed clause makes the predicate false.

## Synthesis decision

Candidate B is the base. Its current-state documents plus a typed operational-event ledger give Results and audit history durable business facts without requiring event sourcing, a broker, or projection workers.

The synthesis grafts these parts from Candidate A:

- Domain modules own writes. Today and Results are read modules with narrow fact-reader ports.
- Customer import has separate preview and commit resources. A person resolves every possible duplicate.
- Campaign recipient review is explicit and activation rechecks current consent and booking facts.
- Access paths and indexes are named together.
- The web API client owns cookies, CSRF headers, request IDs, error decoding, idempotency keys, and ETags.

The synthesis rejects Candidate A's separate generic audit stream and campaign outcome stream. One curated `operationalEvents` ledger is easier to reason about and gives reports an exhaustive source of business facts. The synthesis also rejects permanent idempotency receipts from Candidate B. Booking receipts remain for the workspace lifetime, but recipient-outcome receipts may expire after the approved audit and retry window because the recipient state machine prevents a second business fact.

Both candidates pass the architect red-flag screen after synthesis. Public command methods complete one business operation, boundary representations stay private, modules follow domain ownership rather than processing stages, and forwarding methods without policy are excluded.

## System shape

Growth OS is an npm workspace with three code units and one database.

```text
browser
  -> apps/web, Next.js App Router
       -> same-origin /api/v1 rewrite
            -> apps/api, Express modular monolith
                 -> MongoDB replica set

packages/contracts
  -> Zod wire schemas, error schemas, route metadata, generated OpenAPI
```

The web application is the only public application container. The API and MongoDB remain on a private network. The API is one deployable process divided by business ownership, not a set of network services.

## Caller's view

The browser calls a generated `growthApi` client. Feature code passes business intent and handles typed results.

```ts
const created = await growthApi.bookings.create(
  {
    customerId,
    service: 'Balayage',
    appointmentAt: '2026-10-07T13:00:00.000Z',
    agreedMoney: { currency: 'USD', minorUnits: 18_500 },
    sourceCampaignRecipientId,
  },
  { idempotencyKey: submissionId },
);
```

```ts
const draft = await growthApi.campaigns.get(campaignId);
await growthApi.campaigns.update(
  campaignId,
  { name: 'October colour follow-up', template },
  { etag: draft.etag },
);
```

Routes parse wire values, establish a server-owned context, and invoke one command or query. They do not coordinate persistence steps.

```ts
const input = CreateBookingRequestSchema.parse(req.body);
const context = requireCommandContext(req);
const result = await bookingCommands.record(context, toDomain(input), idempotencyKey);
return presentBooking(res, result);
```

## Domain boundaries

All external JSON, CSV rows, environment values, query parameters, and MongoDB documents are untrusted until a boundary parser constructs domain values. Internal code receives branded identifiers, `UtcInstant`, `Money`, closed state unions, and a server-owned context. This applies boundary discipline and type-system discipline. Illegal lifecycle combinations do not compile.

Command services expose business operations. A command service owns authorization after authentication, transition checks, idempotency, optimistic concurrency, the MongoDB transaction, current-state writes, and ledger appends. Query services return screen-shaped or report-shaped views. They never expose Mongoose queries or documents.

```text
apps/api/src/
  app/                    composition, middleware order, route registry
  platform/
    config/               environment parsing
    mongo/                connection, transactions, indexes, health
    http/                 request IDs, limits, errors, rate limits, headers
    auth/                 passwords, sessions, CSRF, reset tokens
    idempotency/          command receipts
    events/               event store, redaction registry, audit queries
    csv/                  bounded parser and formula-safe export
    observability/        structured logs and health probes
  identity/               registration and account lifecycle
  workspace/              onboarding, settings, export, deletion
  customers/              customer, consent, interactions, import
  campaigns/              drafts, recipients, eligibility, provider port
  bookings/               bookings and attribution
  reviews/                review and response workflow
  today/                  ranked read query and reason codes
  results/                event and booking aggregations
```

Each write module owns its routes, commands, pure policy, repository contract, MongoDB store, and document mapper. Mongoose models stay private. Today and Results may read several collections through narrow readers, but only the owning module writes source data.

Normal mutation call depth is route, command, and store. A layer remains only when it adds transport policy, domain and transaction policy, or persistence semantics. This avoids shallow modules and pass-through methods.

## Operational facts and current state

MongoDB current-state documents serve normal screens. Every material command also appends one or more typed `OperationalEvent` records in the same transaction. The ledger records safe business facts, actor, request ID, command ID, subject, occurrence time, schema version, and an exhaustive payload. It excludes message bodies, notes, passwords, session values, reset tokens, raw CSV rows, and full review text.

Reports do not replay events to build current state. Results counts enquiry, prepared, sent, and reply facts from the ledger. It reads booking status, agreed value, and valid attribution from bookings. Audit presents redacted event views. Full event sourcing, brokers, consumers, and projection workers remain out of scope.

## API resources

All application resources live under `/api/v1`.

```text
GET    /auth/csrf
POST   /auth/register
POST   /auth/sign-in
POST   /auth/sign-out
POST   /auth/password-reset-requests
POST   /auth/password-resets
GET    /session

GET    /workspace
PATCH  /workspace
POST   /workspace/exports
DELETE /workspace/account

GET    /today
GET    /customers
POST   /customers
GET    /customers/{customerId}
PATCH  /customers/{customerId}
GET    /customers/{customerId}/interactions
POST   /customers/{customerId}/interactions
GET    /customers/{customerId}/consents
POST   /customers/{customerId}/consents
POST   /customer-imports/preview
POST   /customer-imports/{importId}/commit

GET    /campaigns
POST   /campaigns
GET    /campaigns/{campaignId}
PATCH  /campaigns/{campaignId}
POST   /campaigns/{campaignId}/recipient-review
POST   /campaigns/{campaignId}/activation
DELETE /campaigns/{campaignId}/recipients/{recipientId}
PUT    /campaign-recipients/{recipientId}/outcome
GET    /campaigns/{campaignId}/recipient-export

GET    /bookings
POST   /bookings
PATCH  /bookings/{bookingId}/status
GET    /results
GET    /results.csv

GET    /reviews
POST   /reviews
PATCH  /reviews/{reviewId}/response
POST   /reviews/{reviewId}/mark-posted
POST   /review-imports

GET    /audit-events
GET    /data-export
GET    /openapi.json
GET    /health/live
GET    /health/ready
```

List resources use bounded page sizes, allowlisted filters and sorts, and opaque cursors built from the indexed sort fields plus `_id`. Success responses use resource-specific DTOs. Errors use `{ error: { code, message, requestId, fieldErrors?, details? } }`. Another workspace's resource returns `404 RESOURCE_NOT_FOUND` to prevent enumeration. A known action forbidden within the active workspace returns `403 FORBIDDEN`.

Stable codes include `VALIDATION_FAILED`, `UNAUTHENTICATED`, `FORBIDDEN`, `RESOURCE_NOT_FOUND`, `DUPLICATE_REVIEW_REQUIRED`, `CONSENT_REQUIRED`, `INVALID_TRANSITION`, `IDEMPOTENCY_KEY_REUSED`, `CAMPAIGN_VERSION_CONFLICT`, and `RATE_LIMITED`.

## Contracts and OpenAPI

`packages/contracts` owns Zod schemas for path, query, body, response, and error shapes. TypeScript wire types are inferred from those schemas. Domain modules do not import wire DTOs.

A route registry binds method, path, authentication requirement, schemas, response statuses, and stable operation ID. Express registration and OpenAPI generation consume the same registry. CI regenerates `docs/openapi.json`, fails on drift, and proves that every mounted route has a registry entry. Integration tests validate representative success and error responses against the registered schemas.

## Authentication, sessions, and CSRF

Passwords use Argon2id with centrally validated parameters and rehash support. Registration creates the user, workspace, session, and events in one transaction. Authentication endpoints use tighter rate limits keyed by normalized identifier and network signal. Responses do not reveal whether an account exists.

The browser receives an opaque 256-bit token in `__Host-growthos.sid`. MongoDB stores only the token hash. Production cookies use `Secure`, `HttpOnly`, `SameSite=Lax`, and `Path=/`. Sessions have idle and absolute expiry, explicit revocation, a user session generation, and TTL cleanup. The server rotates the session after sign-in, password reset, and sensitive account changes.

Password reset requests always return the same account-safe message. A matching account receives a 256-bit, single-use token through an authenticated HTTPS webhook; MongoDB stores only its hash and removes expired records through a TTL index. Reset completion changes the Argon2id password, increments the user session generation, revokes every prior session and unused reset token, and creates a fresh session in one transaction. Raw-token exposure is available only behind an explicit development/test flag and is rejected by production configuration.

`GET /auth/csrf` creates or refreshes a short-lived anonymous or authenticated session and returns a random raw token. The server stores its hash with the session. Every unsafe browser request must send the raw token in `X-CSRF-Token`. Before parsing the body, the API validates the session-bound token, an allowlisted `Origin`, and Fetch Metadata. A session rotation also rotates the CSRF token.

Each authenticated request receives a server-owned `RequestContext` with `userId`, `workspaceId`, `sessionId`, `requestId`, and the clock. The API never reads `workspaceId` from a request header or body. Repositories are constructed with `WorkspaceId`, and every business query includes it.

## Idempotency and optimistic concurrency

Booking creation and recipient outcome commands require `Idempotency-Key`. The scope is workspace, operation, and key hash. The service fingerprints the normalized command and writes the command receipt, domain change, operational events, and audit-safe response reference in one MongoDB transaction.

The same key and fingerprint returns the original response. The same key with a different fingerprint returns HTTP 409 with `IDEMPOTENCY_KEY_REUSED`. Concurrent first attempts resolve through the unique receipt index. Booking receipts remain until workspace deletion. Other receipt retention requires an approved policy before production.

Campaigns carry a monotonic integer version. GET returns an ETag that includes the campaign ID and version. Draft edits, recipient removal, review, and activation require `If-Match`. The store matches `_id`, `workspaceId`, and the expected version, then increments the version atomically. A stale command returns HTTP 412 with `CAMPAIGN_VERSION_CONFLICT` and the current ETag. It does not return another user's content.

## Data access and indexes

Production disables automatic index creation. A checked migration command creates and verifies indexes before readiness passes.

| Access path               | Collection and index                                                                                                                |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Sign in                   | `users { normalizedEmail: 1 }`, unique                                                                                              |
| Resolve session           | `sessions { tokenHash: 1 }`, unique; `{ expiresAt: 1 }`, TTL                                                                        |
| Duplicate review          | `customers { workspaceId: 1, normalizedPhone: 1 }`; `{ workspaceId: 1, normalizedEmail: 1 }`, both non-unique                       |
| Customer filters          | `customers { workspaceId: 1, lifecycle: 1, updatedAt: -1, _id: -1 }`                                                                |
| Today candidates          | `customers { workspaceId: 1, lifecycle: 1, lastInteractionAt: 1, _id: 1 }`                                                          |
| Current consent           | `consentRecords { workspaceId: 1, customerId: 1, channel: 1, capturedAt: -1, _id: -1 }`                                             |
| Customer timeline         | `interactions { workspaceId: 1, customerId: 1, occurredAt: -1, _id: -1 }`                                                           |
| Campaign list             | `campaigns { workspaceId: 1, state: 1, updatedAt: -1, _id: -1 }`                                                                    |
| Campaign recipients       | `campaignRecipients { workspaceId: 1, campaignId: 1, state: 1, _id: 1 }`; unique `{ workspaceId: 1, campaignId: 1, customerId: 1 }` |
| Customer campaign history | `campaignRecipients { workspaceId: 1, customerId: 1, createdAt: -1, _id: -1 }`                                                      |
| Booking period            | `bookings { workspaceId: 1, appointmentAt: -1, _id: -1 }`                                                                           |
| Customer bookings         | `bookings { workspaceId: 1, customerId: 1, appointmentAt: -1, _id: -1 }`                                                            |
| Attributed bookings       | `bookings { workspaceId: 1, sourceCampaignRecipientId: 1, appointmentAt: -1 }`                                                      |
| Reviews needing work      | `reviews { workspaceId: 1, responseState: 1, receivedAt: -1, _id: -1 }`                                                             |
| Results by event          | `operationalEvents { workspaceId: 1, type: 1, occurredAt: -1, _id: -1 }`                                                            |
| Audit timeline            | `operationalEvents { workspaceId: 1, occurredAt: -1, _id: -1 }`                                                                     |
| Subject history           | `operationalEvents { workspaceId: 1, subjectKind: 1, subjectId: 1, occurredAt: -1, _id: -1 }`                                       |
| Event uniqueness          | `operationalEvents { workspaceId: 1, commandId: 1, ordinal: 1 }`, unique                                                            |
| Retry receipt             | `commandReceipts { workspaceId: 1, operation: 1, keyHash: 1 }`, unique                                                              |
| Import staging            | `importBatches { workspaceId: 1, createdAt: -1 }`; `{ expiresAt: 1 }`, TTL                                                          |

Normalized contact indexes are non-unique. Shared phone numbers and email addresses are legitimate. The product shows candidates and requires an explicit create-separate or link decision. It never silently merges records.

`Customer.lastInteractionAt` is a private query projection. The customer module updates it in the same transaction that appends an interaction. Commands cannot set it. Today uses bounded bulk reads and a pure ranking function that returns a score for ordering and stable reason codes for explanation. The UI shows reasons, never a hidden score.

## CSV boundaries

Uploads use strict byte, row, column, and cell limits. The preview endpoint parses UTF-8 or UTF-8 with BOM into short-lived server-side staging rows. It returns proposed mappings, row errors, and duplicate candidates. The commit endpoint accepts the preview ID plus an explicit resolution for each blocked row. Confirmed rows call the same customer command policy in bounded chunks.

Exports prefix cells that begin with spreadsheet formula characters and use a safe content type and filename. Logs and events never copy raw upload rows.

## Docker topology

Development Compose runs `web`, `api`, `mongo`, and a one-shot replica-set initializer. The web service publishes the application port. The API and MongoDB use the private Compose network. MongoDB uses authentication, a named volume, a health check, and a single-node replica set so development transactions match production semantics.

Production uses separate multi-stage images for web and API. Builds use `npm ci`. Runtime stages contain pruned dependencies, non-root users, no source `.env` files, and read-only filesystems where the runtime permits. Only web publishes a port. The production reference is a single-host deployment and makes no high-availability claim. A managed replica set is the growth path.

API liveness checks only the process. Readiness verifies configuration, MongoDB connectivity, replica-set transaction support, and required indexes. Web health verifies the Next.js process and the API rewrite path.

## Interface depth

Command interfaces are small compared with the rules they hide. They protect tenancy, state transitions, duplicate review, eligibility, transactions, events, audit redaction, idempotency, and concurrent writes. The browser must still participate in CSRF, idempotency, and ETags because those are real browser and distributed-system semantics. Hiding them would make retry and conflict behavior less honest.

## Tradeoffs accepted

- We accept transactional writes to current documents, receipts, and events in exchange for replay safety and trustworthy reporting.
- We accept a MongoDB replica-set requirement in exchange for all-or-nothing business facts.
- We accept request-time aggregation in exchange for no projection worker or eventual-consistency contract in the first release.
- We accept hand-written wire, domain, and persistence mappers in exchange for keeping boundary shapes out of domain logic.
- We accept one deployable API in exchange for simpler authorization, reporting, and transactions.
- We accept a private interaction-time projection in exchange for an indexed Today query.

## Rejected alternatives

- Full event sourcing lost because every screen, correction, retention action, and schema change would inherit replay and projection concerns.
- A generic CRUD service lost because callers would coordinate consent, transitions, audit facts, and transactions.
- A generic command bus lost because it adds dispatch indirection without hiding product complexity.
- Separate feature services lost because callers would inherit network failure, distributed authorization, and cross-service transactions.
- A generic audit middleware lost because transport middleware cannot express business meaning or honest sent, replied, booked, and attributed facts.

## Open risks

- Legal review must set retention periods for consent evidence, events, exports, sessions, receipts, and deleted-workspace backups.
- Owner research must decide whether any active booking blocks all campaigns or only matching services and time windows.
- Load tests must identify the event volume that justifies daily rollups.
- The first production target must provide a replica-set-capable MongoDB deployment.
- Docker Desktop installation still requires user administrator approval on this machine.

## Next implementation step

Define the authoritative domain unions, transition tables, event registry, workspace-scoped repository contracts, Zod wire schemas, and route registry before creating Mongoose schemas or Express handlers.
