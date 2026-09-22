# Growth OS

Growth OS is a consent-aware daily workspace for salons and other appointment businesses. The implemented workflow covers account creation, onboarding, customer records and CSV import, the Today register, booking capture, and stored Results.

## Start the supported stack

Install Docker Desktop, then run:

```powershell
docker compose up -d --build
docker compose ps
```

Wait until `mongo`, `api`, and `web` report `healthy`, then open `http://localhost:3000`. Compose initializes the MongoDB replica set, applies required indexes, starts the API, and serves the production web build. Data is stored in the `growthos-mongo` volume and survives ordinary container restarts.

To stop the stack without deleting its data:

```powershell
docker compose down
```

The checked-in Compose secret is only a local-development default. Set `SESSION_SECRET` to a private random value before using this topology beyond one developer machine.

## Work from source

Install Node.js 24 and npm 11, copy the example environment, and install the locked dependencies:

```powershell
Copy-Item .env.example .env
$env:MONGOMS_DISABLE_POSTINSTALL='1'
npm ci
npm run generate:openapi
npm run dev
```

Source development requires the MongoDB replica-set URI configured in `.env`. The web app runs at `http://localhost:3000`; the API runs at `http://localhost:4000`.

## Verify

```powershell
npm run format:check
npm run typecheck
npm test
$env:MONGOMS_VERSION='8.0.6'
$env:MONGOMS_RUNTIME_DOWNLOAD='0'
npm run test:integration
npm run generate:openapi
npm run check:openapi
npm run build
npm run check:rewrite
npx playwright test apps/web/tests/vertical-slice.spec.ts --project=chromium --project=phone
npm audit --audit-level=high
```

The integration and browser suites use a disposable single-node MongoDB replica set. They expect MongoDB 8.0.6 in the `mongodb-memory-server` cache. Set `GROWTHOS_ALLOW_MONGODB_DOWNLOAD=1` for the Playwright run if the binary is not cached and downloading it is acceptable.

To exercise the already-running production Compose stack:

```powershell
$env:GROWTHOS_E2E_EXTERNAL='1'
$env:PLAYWRIGHT_BASE_URL='http://localhost:3000'
npx playwright test apps/web/tests/vertical-slice.spec.ts --project=chromium --project=phone
```

## Current scope

The verified implementation covers tenant-scoped registration and sessions, onboarding, searchable customer records, consent and interaction history, lifecycle transitions, bounded CSV import with explicit duplicate handling, the Today register, idempotent booking capture, Results, and an operational event ledger.

Campaign execution, review requests, broader reporting and export, settings, account deletion, legal pages, demo mode, and the final release-quality visual and performance pass remain to be built.
