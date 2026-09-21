# Growth OS test plan

## Purpose

This plan proves product behavior through the public browser, HTTP API, and persisted database. Tests call the system as its users and clients do. They assert literal outcomes, stable error codes, stored facts, and visible states. Tests do not assert private call order.

## Test data

Use deterministic factories with branded IDs, UTC instants, IANA timezones, and integer minor-unit money. Seed at least two workspaces for every authorization suite. Seed campaign and customer volumes that exercise pagination and indexes. Fictional data must be labeled as demo or test data and contain no real personal information.

Each test owns its workspace. Parallel tests never share mutable records. A reset command must reject non-test databases and require an explicit guard.

## Unit tests

Pure domain tests cover:

- Today ranking order, stable reason codes, tie-breaking, recency, booking exclusion, and consent exclusion.
- Consent resolution by channel, effective time, and record ID tie-breaker.
- Every allowed and invalid customer, campaign, recipient, booking, review, session, import, and deletion transition.
- Money construction, currency mismatch, safe-integer limits, and summation.
- Template parsing, allowed variables, missing values, and literal escaping.
- Duplicate candidate matching for normalized phone and email without implicit merge.
- UTC and business-timezone range conversion across daylight-saving changes.
- Booking attribution rules.
- Operational-event redaction and exhaustive presentation.
- CSV formula protection and bounded parsing.

Transition-table tests must enumerate all state and command pairs. Adding a new union member must fail compilation or a table completeness check until its behavior is defined.

## API integration tests

Run Express against a real disposable MongoDB replica set. Do not replace transactions with mocks.

### Identity and session

- Register, sign in, sign out, request reset, complete reset, and reject token reuse.
- Rotate the session and CSRF token after authentication and reset.
- Enforce idle and absolute expiry with a controlled clock.
- Revoke all sessions after password reset and account deletion.
- Apply rate limits without revealing whether an account exists.
- Assert cookie attributes in production mode.

### Authorization and tenancy

- For each business resource, create it in workspace A and request it through workspace B.
- Prove that reads and writes return non-enumerating `404` responses.
- Prove that filters, exports, audit history, Results, and Today never include another workspace.
- Attempt request-body, header, query, and path workspace overrides.

### Customers and import

- Create and update a customer with valid consent history.
- Return duplicate candidates for normalized phone or email and never merge automatically.
- Preview a valid CSV, invalid encoding, oversized file, oversized cell, wrong mapping, and formula-leading cell.
- Require an explicit resolution for every blocked row before commit.
- Expire import staging and reject replay after expiry.

### Campaigns

- Create, edit, review, activate, and complete a campaign.
- Reject unknown template variables.
- Exclude missing consent, withdrawn consent, missing phone, active booking, removed recipient, and cancelled campaign.
- Withdraw consent after preview and prove activation rechecks it.
- Require `If-Match` for draft edit, recipient removal, review, and activation.
- Race two edits and prove one succeeds while one receives HTTP 412.
- Preserve the local draft data in the conflict response only when it belongs to the same workspace.
- Prove click-to-chat creates no provider-delivery fact.

### Idempotency and transactions

- Retry booking creation with the same key and body and receive the same booking.
- Reuse a key with another body and receive HTTP 409.
- Race two first attempts and persist one booking, one event set, and one receipt.
- Repeat a recipient outcome and receive the stored result without a second event.
- Inject a failure after each transactional write and prove that no partial fact commits.
- Restart the API between a committed response loss and retry.

### Bookings, Results, reviews, and lifecycle

- Reject cross-workspace and wrong-customer campaign attribution.
- Accept attribution only from the defined contacted recipient states.
- Compute date ranges in the workspace timezone.
- Keep quoted value separate from recorded booking value.
- Omit collected revenue.
- Preserve original review text while response drafts change.
- Export data safely and complete account deletion with explicit confirmation.

### Contracts

- Validate representative success and every error envelope against the route registry.
- Prove every mounted route has one registry entry and operation ID.
- Regenerate `docs/openapi.json` and fail on a diff.

## Browser tests

Playwright runs against the real web application, Express API, and MongoDB. The critical workflow is:

1. Register and complete onboarding.
2. Add an enquiry and record consent.
3. Find the enquiry in Today and explain its reason from visible text.
4. Create a campaign and review a recipient.
5. Verify the WhatsApp action without claiming delivery.
6. Record a sent or skipped outcome.
7. Record a booking with campaign attribution.
8. Find the booking and its recorded value in Results.
9. Create a review response and mark it posted manually.
10. Sign out, restart the API, sign in, and confirm persistence.

Additional browser tests cover duplicate review, CSV mapping, consent withdrawal, campaign conflict recovery, offline save failure, expired session recovery, data export, account deletion cancellation, legal pages, empty states, and server validation that preserves form input.

Run the critical workflow at these viewport classes:

| Class        | Reference viewport | Requirement                                                |
| ------------ | ------------------ | ---------------------------------------------------------- |
| Phone        | 390 by 844         | Complete every daily action without hidden capability.     |
| Tablet       | 768 by 1024        | No clipped tables, dialogs, or navigation.                 |
| Laptop       | 1440 by 900        | Register and inspector remain usable together.             |
| Wide desktop | 1920 by 1080       | Content stays bounded and reading lines remain controlled. |

## Accessibility tests

Run `axe-core` on every required screen in its default, populated, empty, validation-error, and dialog states. Automated scans must report no serious or critical violations.

Manual checks cover:

- Keyboard-only completion of the critical workflow.
- Visible focus and logical order.
- Dialog focus trap, Escape behavior, and focus restoration.
- Error summary and field association.
- Status announcements for pending, saved, failed, and offline states.
- 200 percent zoom and browser text-spacing overrides.
- Reduced motion.
- Screen-reader spot checks for Today, recipient review, booking entry, and Results.
- Color contrast for text, controls, focus, disabled states, and charts.

The release target is a Lighthouse accessibility score of at least 95, but the manual and axe gates remain independent.

## Security tests

Security verification follows `docs/threat-model.md` and includes:

- CSRF token, Origin, and Fetch Metadata rejection cases.
- MongoDB operator payloads, oversized JSON, invalid content types, and header injection attempts.
- Authentication rate limits and generic account responses.
- Cookie and reset-token properties.
- CSV formula, encoding, path, and size cases.
- Log and event scans for secrets and sensitive contents.
- Dependency, secret, SBOM, and container scans.
- Production network inspection that confirms MongoDB has no public port.

No unresolved high-severity finding may remain without an approved, dated exception.

## Query and performance tests

Seed realistic small, medium, and stress datasets. The initial profiles are 500, 10,000, and 100,000 customers per workspace with proportionate interactions, recipients, bookings, and events. The stress profile does not define a production promise. It exposes query growth.

For Today, customer search, customer history, campaign recipients, bookings, Results, audit history, and exports:

- Capture MongoDB `explain("executionStats")` output.
- Assert that the expected compound index is selected.
- Fail on an unbounded collection scan for a common request.
- Record returned rows, examined documents, execution time, and dataset size.

Run an API load smoke test against the production build. Use a documented request mix and fixed concurrency. Record the machine, containers, seed size, duration, latency percentiles, throughput, error count, and resource use. Set acceptance thresholds after the first baseline. Before that baseline, only zero unexpected errors and no resource exhaustion are hard gates.

Run Lighthouse against seeded authenticated Today, Customers, Campaign, and Results screens. Record the browser, build, machine, viewport, throttling profile, and trace. Targets are performance at least 90, accessibility at least 95, largest contentful paint below 2.5 seconds, interaction to next paint below 200 milliseconds, and cumulative layout shift below 0.1.

## Docker and recovery tests

- Start the development topology from a clean volume by following the README.
- Build the production images without development secrets.
- Start production Compose and run the browser critical workflow.
- Restart web and API and prove persisted data remains.
- Restart MongoDB and prove readiness stays false until transactions and indexes are available.
- Restore a test backup into an empty environment and compare record counts and sampled facts.
- Prove seed and reset commands refuse an unguarded production environment.

## Phase gates

| Gate                | Required evidence                                                                                                                                       |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Foundation          | Lockfile install, lint, type check, unit smoke, production build, Compose health, index migration.                                                      |
| Vertical slice      | Browser registration-to-booking-to-Results flow, restart persistence, and two-workspace isolation.                                                      |
| Customer data       | Import limits, duplicate decisions, consent history, formula-safe export, and mobile customer workflow.                                                 |
| Campaigns           | Eligibility matrix, stale-preview withdrawal, ETags, idempotent outcomes, click-to-chat truth, and audit facts.                                         |
| Completion features | Reviews, exports, deletion, legal pages, and retention placeholders verified.                                                                           |
| Product quality     | Required responsive screenshots, keyboard flow, axe scans, reduced motion, error and offline states.                                                    |
| Release             | Development and production startup, full suites, scans, query evidence, Lighthouse, load smoke, final browser run, and reviewed `docs/verification.md`. |

Each gate ends in `VERIFIED`, `NOT VERIFIED`, or `INCONCLUSIVE`. Only `VERIFIED` permits the next delivery phase. An inconclusive result is not a pass.

## Verification record

`docs/verification.md` must record the commit, operating system, tool versions, commands, seed size, environment, result, screenshots or reports, and known limits. It must distinguish direct measurement from inference. The root coordinator must inspect the browser, database result, logs, and final diff rather than accept a delegated summary.
