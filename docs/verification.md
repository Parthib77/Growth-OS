# Verification record

## Foundation gate

Environment: Windows, Node.js 24.21.0, npm 11.19.0, Git 2.53.0. The repository is `C:\Users\Parthib\code\growthos`.

Measured commands and results on 2026-09-21:

- `MONGOMS_DISABLE_POSTINSTALL=1 MONGOMS_RUNTIME_DOWNLOAD=0 npm ci` completed successfully from the committed lockfile. The environment variables prevent an unbounded test-binary download during dependency installation.
- `npm run format` completed successfully.
- `npm run typecheck` completed successfully with `tsc -b packages/contracts apps/api apps/web`.
- `npm test` completed successfully with 7 files and 12 tests passing.
- `npm run generate:openapi` completed successfully.
- `npm run build` completed successfully. The Next.js production build generated the `/` route.
- `MONGOMS_VERSION=8.0.6 npm run test:integration` passed the real single-node replica-set workflow: registration, onboarding, enquiry, consent, event metadata, idempotent booking retry, Results, customer lookup, and two-workspace isolation.
- `npx playwright test apps/web/tests/vertical-slice.spec.ts --project=chromium` passed the focused no-database registration surface and axe scan; the full workflow is present and skipped unless `GROWTHOS_E2E_MONGODB_URI` points at a running MongoDB-backed API. The dev server is managed by Playwright and the test returned HTTP 200 for `/`.
- `npm audit` reports 4 advisories from the resolved dependency graph. They are not yet triaged and therefore the security completion gate is not passed.

Foundation result: `NOT VERIFIED` until the direct MongoDB transaction/readiness check and full browser workflow pass. The local install, type, unit, contract-generation, and production-build checks are supporting evidence only.

## Vertical slice gate

Implemented behavior:

- Registration creates a user and workspace and rotates the anonymous session.
- Onboarding persists business category, timezone, currency, country code, booking link, and follow-up interval.
- Customer creation persists the enquiry, consent record, and safe operational events in the workspace.
- Today reads the stored enquiry and visibly explains the reason and next action.
- Booking creation requires an idempotency key, updates customer lifecycle, persists a booking event, and returns the same booking for a retry with the same body and key.
- Results counts stored enquiry events and stored booking value.
- Business queries require the session-derived workspace ID.
- The web UI exposes registration, onboarding, Today, add enquiry, booking entry, results summary, sign-out, sign-in, pending states, success states, recoverable errors, focus-visible controls, and reduced-motion CSS.

Direct persistence/browser test status:

- `npm run test:integration` is prepared in `apps/api/src/vertical-slice.integration.test.ts` and uses `mongodb-memory-server` with a single-node replica set. With the restored 8.0.6 archive, this direct API/database gate passed.
- The first run was attempted, but the MongoDB binary download initially created `C:\Users\Parthib\.cache\mongodb-binaries\mongodb-windows-x86_64-8.2.6.zip.downloading` at 0 bytes and stalled.
- A bounded retry with `MONGOMS_VERSION=8.0.6 npm run test:integration` created a second zero-byte download and was stopped.
- Reusing the partial 8.2.6 archive reached the checksum step, then failed with `Md5CheckFailedError`; disabling the checksum confirmed the archive is truncated with `End of central directory record signature not found`.
- The restored `MONGOMS_VERSION=8.0.6 npm run test:integration` run now passes the direct replica-set workflow.
- Docker Compose was not run. `docker version` reports a Docker 29.8.0 client but cannot connect to `dockerDesktopLinuxEngine`.

Vertical slice result: `NOT VERIFIED`. The direct API/database gate passes, but the completion predicate still requires the full browser workflow, restart persistence, and production/container evidence. The WSL kernel is missing on this host, so Docker Desktop cannot start its Linux engine; the older 8.2.6 MongoDB cache remains truncated (8.0.6 is usable).

## Known limits

Campaigns, CSV import, reviews, exports, account deletion, and legal pages remain later delivery phases. The API and web app do not claim those features exist. Docker health, production image startup, Lighthouse, and a persisted Playwright workflow require a working MongoDB or Docker runtime.
