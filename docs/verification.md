# Verification record

## Environment

Final release evidence was captured on September 23, 2026, in `C:\Users\Parthib\code\growthos`.

- Windows 10.0.19045 on an AMD Ryzen 5 5600X with 12 logical CPUs and 16 GB memory.
- Node.js 24.21.0, npm 11.19.0, and Git 2.53.0.
- Docker Desktop 4.92.0, Docker Engine 29.8.0, and Docker Compose 5.5.1.
- MongoDB 8.0.6 for disposable integration/browser tests and `mongo:8.3.11-noble` for Compose.

## Source checks

The final source gate uses these commands:

```powershell
npm run format:check
npm run typecheck
npm test
$env:MONGOMS_VERSION='8.0.6'
$env:MONGOMS_RUNTIME_DOWNLOAD='0'
npm run test:integration
npm run generate:openapi
npm run check:openapi
npm run check:rewrite
npm run build
npm audit --audit-level=high
npx playwright test
```

Results:

- Unit tests passed 12 files and 30 tests. Coverage includes prioritization, consent eligibility, status transitions, money, personalization, duplicate detection, CSV limits and formula protection, timezone rules, network-failure copy, configuration, and error envelopes.
- API integration tests passed 4 files and 9 tests against real single-node MongoDB replica sets. Coverage includes registration, password reset and token reuse, session behavior, workspace isolation, customer/import behavior, consent withdrawal, campaign conflicts and idempotency, booking idempotency and status transitions, Results, reviews, exports, deletion, and convergent demo seeding.
- OpenAPI generation and drift checking, same-origin rewrite checking, TypeScript compilation, formatting, and the production build passed.
- The source Playwright gate passed 19 tests with 5 intentional skips. Four visual-capture cases are opt-in; the fifth skip is the phone project for the Chromium-only tablet/laptop/wide matrix.
- `npm audit --audit-level=high` reported zero vulnerabilities.

## Browser quality evidence

The browser suite exercises registration, onboarding, enquiry capture, Today, customer search and history, consent withdrawal, campaigns, WhatsApp handoff, outcomes, bookings, Results, reviews, exports, settings, account deletion, legal pages, sign-out/sign-in persistence, password reset, and offline recovery.

- Chromium and the iPhone 13 profile completed the full daily workflow.
- The six primary authenticated screens passed axe scans with no serious or critical violations.
- Responsive overflow checks passed at 768 × 1024, 912 × 900, 1366 × 768, and 1920 × 1080. The phone project covers the 390 px workflow.
- Today dialogs trap focus, cycle Tab and Shift+Tab, close with Escape, and restore the trigger.
- Reduced-motion emulation reduced transition duration to at most 1 ms.
- The authenticated quality flow produced no unexpected console errors and no failed API responses.
- Offline registration preserved entered values, showed actionable connection guidance, and succeeded after reconnection.

Production screenshots are committed in [`docs/screenshots`](screenshots). The root review inspected the desktop and phone Today and Reviews captures after the production build.

## Production containers and persistence

Commands:

```powershell
docker compose up -d --build
docker compose ps -a
docker compose run --rm -e DEMO_SEED_GUARD=seed-growthos-demo api node apps/api/dist/scripts/seed-demo.js
$env:GROWTHOS_E2E_EXTERNAL='1'
$env:PLAYWRIGHT_BASE_URL='http://localhost:3000'
npx playwright test apps/web/tests/vertical-slice.spec.ts apps/web/tests/release-quality.spec.ts --project=chromium --project=phone
```

The Compose run initialized the authenticated replica set, applied indexes, and brought MongoDB, API, and web health checks to healthy. MongoDB has no host port. The final API and web images run as the unprivileged `node` user on a digest-pinned Alpine Node 24.21.0 base, with npm removed from the runtime layers.

The external production test passed 17 tests with 3 intentional skips. One is the phone project for the Chromium-only viewport matrix. Two are password-reset completion on desktop and phone because the production stack has no external delivery credentials; the source-browser and integration suites verify the development provider, webhook contract, single-use token, and session rotation.

After restarting MongoDB, API, and web, browser sign-in returned the same demo workspace and its active `September consultation follow-up` campaign. This directly verifies volume and application persistence across service restarts.

## Security evidence

Commands:

```powershell
npm audit --audit-level=high
docker scout cves local://growthos-web:latest --only-severity critical,high --only-vuln-packages
docker scout cves local://growthos-api:latest --only-severity critical,high --only-vuln-packages
```

The first image scan exposed inherited Debian and bundled npm findings. The runtime images were rebuilt on a smaller digest-pinned Alpine base and npm was removed. The repeated final scans reported:

- Web image `66f650df3c03`: 0 critical, 0 high, 94 indexed packages, 74 MB Scout size.
- API image `00cb02e511fe`: 0 critical, 0 high, 301 indexed packages, 161 MB Scout size.
- npm dependency audit: 0 vulnerabilities.

No unresolved high-severity finding remains in the checked dependency tree or final application images. The concise threat analysis and control mapping are in [threat-model.md](threat-model.md).

## Performance evidence

Lighthouse command:

```powershell
npm run measure:lighthouse
```

The script signs into the seeded production workspace, obtains the HTTP-only session cookie through the browser, and measures the authenticated Today view with the Lighthouse desktop profile and local supplied network conditions.

| Measure                  | Result |        Gate |
| ------------------------ | -----: | ----------: |
| Performance              |    100 | at least 90 |
| Accessibility            |    100 | at least 95 |
| Largest Contentful Paint | 475 ms | below 2.5 s |
| Cumulative Layout Shift  | 0.0026 |   below 0.1 |
| Total Blocking Time      |   0 ms |    recorded |

The six screens share one Next.js client shell rather than separate routes. Lighthouse therefore measures the authenticated entry view; axe, responsive, console, and failed-request checks independently exercise every primary screen. Raw output is committed as [HTML](performance/lighthouse-today.html) and [JSON](performance/lighthouse-today.json).

Load-smoke command:

```powershell
npm run smoke:load
```

The authenticated test made 240 reads across Today, Results, Customers, Campaigns, Reviews, and Bookings at concurrency 12. It completed in 0.99 seconds with zero errors, 241.3 requests per second, 32 ms p50, 81 ms p95, 155 ms p99, and 158 ms maximum latency. This is a local baseline on the machine above, not a production capacity claim. The raw result is [api-load-smoke.json](performance/api-load-smoke.json).

## Verified product behavior

- Registration creates a user and workspace atomically, rotates the anonymous session, and preserves server-derived tenancy.
- Sessions have idle and absolute expiry, CSRF tokens, production Origin and Fetch Metadata checks, HTTP-only cookies, and secure-cookie support.
- Customers retain enquiry context, interactions, consent history, lifecycle, notes, service interests, bookings, and explicit duplicate decisions.
- CSV imports are size-bounded, mapping-aware, retry-safe, formula-safe, and never merge silently.
- Today explains each priority with stored facts and excludes already-booked enquiries.
- Campaigns keep immutable revisions, optimistic conflicts, explicit recipient review, consent and booking rechecks, idempotent outcomes, formula-safe exports, and audit history.
- WhatsApp is a reviewed click-to-chat handoff. The application records owner-marked outcomes and never claims provider delivery.
- Bookings enforce idempotency and valid status transitions, update linked lifecycle state transactionally, and feed Results from stored records.
- Reviews preserve the original review while responses move through explicit draft and manually-posted states.
- Workspace export, settings, deletion confirmation, Privacy, Terms, and the guarded database-backed demo are implemented.

## Limits that require external action

The technical release gate is `VERIFIED` for the local production topology. A public launch still requires:

- Legal approval of the visibly marked Privacy and Terms drafts.
- A private session secret, TLS, secure-cookie configuration, backup/restore operations, monitoring, and a deployment owner.
- Real password-reset webhook credentials and delivery-provider acceptance testing.
- Optional WhatsApp Cloud API or Google Business Profile credentials if those integrations are later added.
- Interviews, usability sessions, and screen-reader evaluation with representative owners. No user-research or business-impact claim is made.
