# Growth OS delivery plan

## Delivery rule

Build the smallest complete path first. Each phase starts from a verified prior phase, ends with direct evidence, and does not pass on a build alone. The full completion predicate in `docs/architecture.md` remains false until the final release gate passes.

## Planning rigor

This is a high-rigor run because authentication, consent, tenant isolation, deletion, and reporting are one-way-door decisions once real data exists. The architecture, domain model, threat model, screen direction, tests, and phase gates are fixed before application code. An implementation deviation that changes an invariant must update the relevant plan and decision log before acceptance.

## Foundation

Deliver:

- Git and npm workspace structure.
- Exact direct dependency versions and a committed lockfile.
- Environment parsing and `.env.example`.
- Formatting, linting, type checking, Vitest, Supertest, Playwright, and axe setup.
- Development Compose with a single-node MongoDB replica set.
- Production Dockerfiles and Compose topology.
- CI for install, checks, builds, OpenAPI drift, scans, and tests.
- Index migration and readiness checks.

Verify:

- `npm ci` works from a clean checkout.
- Web, API, and MongoDB report healthy.
- Transactions commit and roll back in the development topology.
- Production images build with no source secrets.
- The index migration is repeatable and readiness detects missing indexes.

Current blocker: Docker Desktop 4.91.0 installation stopped at the Windows administrator prompt. The user must approve that operating-system action before container verification.

## Domain and contract foundation

Deliver:

- Branded IDs, `Money`, `UtcInstant`, local-date input, and server-owned contexts.
- Closed state unions and total transition tables.
- The operational-event union and exhaustive redaction registry.
- Zod wire schemas and the route registry.
- Workspace-scoped repository contracts.
- Idempotency and optimistic-concurrency contracts.

Verify:

- Transition-table completeness tests pass.
- Invalid states fail type checking or constructors.
- Every registered route generates valid OpenAPI.
- Domain modules do not import Express, Mongoose, or wire DTOs.

## Vertical slice

Deliver one stored workflow:

1. Register.
2. Create the business workspace.
3. Add a customer enquiry and consent record.
4. See the customer in Today with a visible reason.
5. Record a booking.
6. See the booking and recorded value in Results.

Include session rotation, CSRF, tenant scoping, events, booking idempotency, responsive phone behavior, errors, and restart persistence in this slice.

Verify the real browser, API, and MongoDB path. Use two workspaces. Retry the booking after a simulated lost response. Restart the API. Inspect the stored booking, events, and Results response.

## Customer data

Deliver manual customer editing, interaction history, consent history, filters, search, CSV preview, column mapping, duplicate review, import commit, and safe export.

Verify file limits, encoding rejection, duplicate races, no silent merge, consent resolution, formula-safe export, indexed queries, and the complete phone workflow.

## Campaigns

Deliver draft campaigns, audience rules, template variables, recipient review, exclusion reasons, recipient removal, activation, individual WhatsApp click-to-chat, CSV export, outcomes, ETags, idempotency, and audit views.

Verify the eligibility matrix. Withdraw consent after review and prove activation excludes the recipient. Race two edits. Retry an outcome. Prove that opening WhatsApp does not create a delivery fact.

## Completion features

Deliver bookings management, Results date filtering, reviews, review import, response workflow, settings, data export, account deletion, privacy, terms, contact details, and the labeled demo workspace.

Verify result definitions against stored events and bookings. Verify original review immutability. Verify export contents, deletion confirmation, session revocation, legal-review markers, and demo persistence through the normal API.

## Product quality

Apply the selected operations-register direction across the complete product. Inspect every screen at phone, tablet, laptop, and wide desktop sizes. Complete keyboard, screen-reader, zoom, contrast, reduced-motion, error, offline, loading, empty, pending, and saved-state checks.

Capture real screenshots for the case study only after the product passes the corresponding workflow. Do not use static mock screens as evidence.

## Release verification

Run the complete unit, integration, browser, accessibility, security, query, performance, and Docker plan from `docs/test-plan.md`. Exercise the full workflow against production containers. Inspect browser console output, failed requests, stored facts, logs, exports, and the final diff.

Write `docs/verification.md` from measured evidence. Write the case study with separate sections for assumptions, implemented behavior, tests, measurements, research still required, and future integrations.

The release gate passes only when every completion clause is true. A missing credential may block only an optional provider connection. The click-to-chat core workflow must remain usable.

## Work sequence and change boundaries

Each coherent change ends with its closest check before the next change starts. The preferred sequence is:

1. Add the failing behavior test or contract check.
2. Add the smallest domain or boundary change.
3. Run the focused check.
4. Run the affected integration check.
5. Inspect the real artifact when the change is visible or persisted.
6. Record the decision or verified phase gate in `docs/decision-log.tsv`.

Do not batch several unverified domain changes. Do not preserve a temporary compatibility layer in a greenfield repository. If implementation produces repeated casts, optional fields that are always present, duplicated workspace checks, or callers that coordinate load and save steps, stop and redesign the boundary.

## Delivery ownership

The planning agent owns architectural decisions and reviews deviations. The execution agent implements the approved plan. The root coordinator owns final verification and cannot rely on executor summaries. Any concurrent worker receives a separate work area or a non-overlapping file set. Shared database state in tests is partitioned by workspace and test run.

## Phase exit report

Each phase report states:

- The user-visible capability.
- The maintained invariant.
- The command and environment used for verification.
- The direct result as `VERIFIED`, `NOT VERIFIED`, or `INCONCLUSIVE`.
- Remaining risks or blockers.
- Any architecture deviation and its decision-log row.

## Open dependencies

- User administrator approval is required to finish Docker Desktop installation.
- Legal review must close retention, deletion, privacy, terms, jurisdiction, and business-contact text before production launch.
- Owner research must validate Today reasons, consent language, click-to-chat expectations, mobile composition, and attribution.
- Production deployment must provide a replica-set-capable MongoDB target and an operational backup and restore policy.
