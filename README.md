# Growth OS

Growth OS is a consent-aware daily workspace for salons and other appointment businesses. The implemented workflow covers account creation, onboarding, customer records and CSV import, the Today register, consent-aware campaigns, booking capture, reviews, stored Results, exports, settings, and account deletion.

The production site is [Growth OS on Vercel](https://web-eight-wine-91.vercel.app). Deployment and database setup are documented in [docs/vercel-deployment.md](docs/vercel-deployment.md).

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

## Seed the demo workspace

The demo is a real account backed by the configured MongoDB database. Seeding is guarded and idempotent: the first run creates the fictional workspace, and later runs leave operator changes untouched.

From a source checkout with the database running:

```powershell
$env:DEMO_SEED_GUARD='seed-growthos-demo'
npm run seed:demo
Remove-Item Env:DEMO_SEED_GUARD
```

Against the Compose stack:

```powershell
docker compose run --rm -e DEMO_SEED_GUARD=seed-growthos-demo api node apps/api/dist/scripts/seed-demo.js
```

Sign in at `http://localhost:3000` with:

- Email: `demo@growthos.local`
- Password: `DemoWorkspace!2026`

Every authenticated screen labels this account as `Demo workspace`. Override the credentials on the first seed with `GROWTHOS_DEMO_EMAIL` and `GROWTHOS_DEMO_PASSWORD` when preparing a shared environment; later seed runs never replace account changes.

## Configure password reset delivery

Password reset uses single-use, 30-minute tokens. MongoDB stores only each token hash. For production delivery, configure both:

```text
PASSWORD_RESET_WEBHOOK_URL=https://your-delivery-service.example/reset
PASSWORD_RESET_WEBHOOK_SECRET=replace-with-a-private-webhook-secret
```

Growth OS sends an authenticated JSON request containing `email`, `resetUrl`, and `expiresAt`. The delivery service is responsible for emailing the link. If delivery is not configured, the public endpoint still returns the same account-safe message but does not create an unusable token. `PASSWORD_RESET_EXPOSE_TOKEN=true` is available only in development and test; production configuration rejects it.

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
npx playwright test apps/web/tests/release-quality.spec.ts --project=chromium
npm audit --audit-level=high
```

The integration and browser suites use a disposable single-node MongoDB replica set. They expect MongoDB 8.0.6 in the `mongodb-memory-server` cache. Set `GROWTHOS_ALLOW_MONGODB_DOWNLOAD=1` for the Playwright run if the binary is not cached and downloading it is acceptable.

To exercise the already-running production Compose stack:

```powershell
$env:GROWTHOS_E2E_EXTERNAL='1'
$env:PLAYWRIGHT_BASE_URL='http://localhost:3000'
npx playwright test apps/web/tests/vertical-slice.spec.ts --project=chromium --project=phone
```

The production run intentionally skips password-reset completion when no delivery webhook is
configured. The source-browser and integration suites exercise the single-use reset flow with the
development provider.

Measure the seeded production stack and scan the final runtime images:

```powershell
npm run measure:lighthouse
npm run smoke:load
docker scout cves local://growthos-web:latest --only-severity critical,high --only-vuln-packages
docker scout cves local://growthos-api:latest --only-severity critical,high --only-vuln-packages
```

Refresh the committed production screenshots when the interface changes:

```powershell
$env:GROWTHOS_E2E_EXTERNAL='1'
$env:PLAYWRIGHT_BASE_URL='http://localhost:3000'
$env:GROWTHOS_CAPTURE_VISUALS='1'
$env:GROWTHOS_SCREENSHOT_DIR='docs/screenshots'
npx playwright test apps/web/tests/phase6-visual.spec.ts --project=chromium --project=phone
```

## Current scope

The verified implementation covers tenant-scoped registration and sessions, password recovery, onboarding, searchable customer records, consent and interaction history, lifecycle transitions, bounded CSV import with explicit duplicate handling, the Today register, campaign drafting and recipient review, consent-aware WhatsApp handoff, idempotent campaign outcomes, attributed bookings, booking status management, Results and CSV export, review response workflows, workspace export, settings, account deletion, legal drafts, a database-backed demo, immutable revisions, and an operational event ledger.

The technical release gates are recorded in `docs/verification.md`, including production-container,
restart-persistence, responsive, accessibility, performance, load-smoke, dependency, and container
scan evidence. A public launch still requires legal approval of the marked Privacy and Terms drafts,
a private production session secret, TLS with secure cookies, backup operations, and real password
reset delivery credentials.
