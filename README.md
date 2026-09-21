# Growth OS

Growth OS is a consent-aware daily workspace for appointment businesses. This checkout contains the Foundation, Domain and contract foundation, and the first stored vertical slice.

## Start locally

Install Node.js 24 and start a MongoDB single-node replica set. Docker Compose provides the supported local database topology.

```powershell
Copy-Item .env.example .env
$env:MONGOMS_DISABLE_POSTINSTALL='1'
$env:MONGOMS_RUNTIME_DOWNLOAD='0'
npm ci
docker compose up -d mongo mongo-init
npm run generate:openapi
npm run dev
```

Open `http://localhost:3000`. Register an account, complete onboarding, add an enquiry, and record a booking. The API listens on `http://localhost:4000`.

## Verify

```powershell
npm run format:check
npm run typecheck
npm test
npm run build
npx playwright install chromium
npx playwright test apps/web/tests/vertical-slice.spec.ts --project=chromium
npm run test:integration
```

The integration test uses a disposable MongoDB replica set through `mongodb-memory-server`. Docker Desktop is required for Compose and production image checks. On the verification machine, Docker 29.8.0 is installed but the `dockerDesktopLinuxEngine` daemon is not running. The integration and Compose gates remain unverified until a MongoDB binary or Docker daemon is available.

## Scope in this phase

The vertical slice covers registration, onboarding, customer enquiries with consent, the Today register, idempotent bookings, Results, sign-in, sign-out, tenant-scoped persistence, and the operational event ledger. CSV import, campaigns, reviews, exports, deletion, and later completion features remain deliberately excluded from this phase.
