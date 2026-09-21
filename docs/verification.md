# Verification record

## Foundation gate

Environment: Windows, Node.js 24.21.0, npm 11.19.0, Git 2.53.0. The repository is `C:\Users\Parthib\code\growthos`.

Measured commands and results on 2026-09-21:

- `MONGOMS_DISABLE_POSTINSTALL=1 MONGOMS_RUNTIME_DOWNLOAD=0 npm ci` completed successfully from the committed lockfile. The environment variables prevent an unbounded test-binary download during dependency installation.
- `npm run format` completed successfully.
- `npm run typecheck` completed successfully with `tsc -b packages/contracts apps/api apps/web`.
- `npm test` completed successfully with 2 files and 4 tests passing.
- `npm run generate:openapi` completed successfully.
- `npm run build` completed successfully. The Next.js production build generated the `/` route.
- `npx playwright test apps/web/tests/vertical-slice.spec.ts --project=chromium` passed with one real-app registration-surface test and an axe scan after the official Chromium download. The dev server returned HTTP 200 for `/` and was stopped after the run.
- `npm audit` reports 4 advisories from the resolved dependency graph. They are not yet triaged and therefore the security completion gate is not passed.

Foundation result: `VERIFIED` for the local install, type, unit, contract-generation, and production-build checks. It is not a release result.

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

- `npm run test:integration` is prepared in `apps/api/src/vertical-slice.integration.test.ts` and uses `mongodb-memory-server` with a single-node replica set.
- The first run was attempted, but the MongoDB binary download initially created `C:\Users\Parthib\.cache\mongodb-binaries\mongodb-windows-x86_64-8.2.6.zip.downloading` at 0 bytes and stalled.
- A bounded retry with `MONGOMS_VERSION=8.0.6 npm run test:integration` created a second zero-byte download and was stopped.
- Reusing the partial 8.2.6 archive reached the checksum step, then failed with `Md5CheckFailedError`; disabling the checksum confirmed the archive is truncated with `End of central directory record signature not found`.
- Docker Compose was not run. `docker version` reports a Docker 29.8.0 client but cannot connect to `dockerDesktopLinuxEngine`.

Vertical slice result: `INCONCLUSIVE`. The application and independent checks are implemented. A real database/browser proof remains blocked by the local MongoDB/Docker runtime.

## Known limits

Campaigns, CSV import, reviews, exports, account deletion, and legal pages remain later delivery phases. The API and web app do not claim those features exist. Docker health, production image startup, Lighthouse, and a persisted Playwright workflow require a working MongoDB or Docker runtime.
