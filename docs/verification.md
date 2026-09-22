# Verification record

## Environment

Measured on 2026-09-21 in `C:\Users\Parthib\code\growthos`:

- Windows with Node.js 24.21.0, npm 11.19.0, and Git 2.53.0.
- Docker Desktop 4.92.0, Docker Engine 29.8.0, and Docker Compose 5.5.1.
- MongoDB 8.0.6 for disposable integration/browser tests and `mongo:8.3.11-noble` for the production-like Compose stack.

## Automated checks

- `MONGOMS_DISABLE_POSTINSTALL=1 MONGOMS_RUNTIME_DOWNLOAD=0 npm ci` completed from the committed lockfile without an installation-time MongoDB download.
- `npm run format` and `npm run typecheck` completed successfully.
- `npm test` passed 8 files and 18 tests. Coverage includes configuration, CSV limits and parsing, duplicate review, lifecycle transitions, formula-safe cells, and customer import retry behavior.
- `MONGOMS_VERSION=8.0.6 MONGOMS_RUNTIME_DOWNLOAD=0 npm run test:integration` passed 2 integration tests against a real single-node replica set. They cover registration, onboarding, event metadata, idempotent booking retries, Results, customer lookup, two-workspace isolation, import preview and commit, retry-safe import commit, interaction history, lifecycle transitions, and consent withdrawal.
- `npm run generate:openapi`, `npm run check:openapi`, `npm run build`, and `npm run check:rewrite` completed successfully.
- The self-contained Playwright run passed all 6 checks in desktop Chromium and iPhone 13/WebKit: the axe registration surface, registration through stored booking and Results, and the customer add/search/detail/history/consent-withdrawal workflow.
- `npm audit --audit-level=high` reports 0 vulnerabilities after upgrading `concurrently` and `express-rate-limit`.

## Production-container evidence

- Clean production images built from the API and web Dockerfiles. The build context is approximately 1 MB after adding `.dockerignore`.
- `docker compose up -d --build` initialized the authenticated MongoDB replica set, ran the index migration to completion, and brought `mongo`, `api`, and `web` to `healthy` state. `mongo-init` and `mongo-migrate` exited successfully.
- The external-stack Playwright run against `http://localhost:3000` passed all 6 Chromium and iPhone 13/WebKit checks.
- A record created through the production web origin remained available after sequentially restarting `mongo`, `api`, and `web`. Sign-in returned the same workspace and the saved customer retained both its name and internal notes.
- The production HTTP topology was checked with a non-secure local cookie name; secure deployments use the `__Host-` cookie prefix only when `COOKIE_SECURE=true`.

Foundation result: `VERIFIED` for locked installation, compilation, database transactions, workspace isolation, browser workflow, dependency audit, production images, container health, index migration, and restart persistence.

## Implemented vertical slice

- Registration atomically creates a user and workspace and rotates the anonymous session.
- Onboarding persists business category, timezone, currency, country code, booking link, and follow-up interval.
- Customer records are workspace-scoped and support search, lifecycle filters, cursor pagination, service interests, internal notes, interaction history, full consent history, validated lifecycle transitions, and contact suppression after consent withdrawal.
- CSV import enforces byte, row, column, and cell limits; rejects formula-like cells; previews mappings; surfaces normalized phone/email duplicates; and requires an explicit skip or create-separately decision. Replaying a committed import returns the original response instead of creating more customers.
- Today reads stored enquiry facts and explains each recommended action.
- Booking creation requires an idempotency key, updates customer lifecycle, records an operational event, and returns the original booking for a matching retry.
- Results derives enquiry and booking metrics from stored facts in the workspace timezone.
- Sessions provide idle and absolute expiry, CSRF protection, origin checks in production, and workspace identity derived on the server.
- The web interface exposes pending, success, empty, and recoverable-error states, focus-visible controls, and reduced-motion behavior.

Vertical-slice result: `VERIFIED` across direct API/database tests, desktop and phone browser tests, production containers, and restart persistence.

## Earlier environment failures

The first MongoDB 8.2.6 test-binary download stalled and left a truncated archive. Verification stayed fail-closed until a valid 8.0.6 archive was restored. Docker Desktop initially lacked a usable WSL kernel; after the engine became available, the full production-container gate was rerun and passed. The corrupt 8.2.6 cache is not used by the current test commands.

## Remaining release gates

The complete product result remains `NOT VERIFIED`. Campaign execution, review requests, expanded reporting and export, settings, account deletion, privacy and terms pages, demo mode, Lighthouse budgets, container scanning, and the final visual/accessibility review remain open. No release-complete claim should be made until those features and their evidence are present.
