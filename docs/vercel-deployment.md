# Vercel deployment

Growth OS runs as two Vercel projects in this npm workspace: `apps/web` (Next.js) and `apps/api` (Express). The API uses a free MongoDB Atlas cluster. Neon/Postgres is not compatible with the current Mongoose models.

Current production URLs:

- Site: https://web-eight-wine-91.vercel.app
- API: https://api-alpha-roan-59.vercel.app

The web app serves `/api/*` from its own origin and rewrites those requests to the API. This keeps the session cookie on the site origin.

## Project setup

Use Node.js 24 and the Vercel CLI. From the repository root, run `vercel link --repo` and link `apps/web` and `apps/api` as separate projects. Vercel stores the local mapping in the ignored `.vercel/repo.json` file. Both projects must retain their respective root directories.

Provision a MongoDB Atlas Free cluster through the Vercel Marketplace and connect it to the API project. The integration sets `MONGODB_URI`. Do not commit that connection string. Apply the API indexes before admitting traffic with `npm run migrate:indexes --workspace @growthos/api` while `MONGODB_URI` points at that cluster.

Configure these Vercel environment variables:

| Project | Variable         | Production value                               |
| ------- | ---------------- | ---------------------------------------------- |
| API     | `MONGODB_URI`    | Provided by the Atlas integration              |
| API     | `SESSION_SECRET` | Private random value of at least 32 characters |
| API     | `COOKIE_SECURE`  | `true`                                         |
| API     | `WEB_ORIGIN`     | Exact HTTPS site origin                        |
| Web     | `API_ORIGIN`     | Exact HTTPS API origin                         |

Do not set `PASSWORD_RESET_EXPOSE_TOKEN=true` in production. If password reset emails are needed, configure the webhook URL and secret described in the README.

## Deploy and verify

Run the repository checks before deploying:

```powershell
npm run check:vercel-entrypoint --workspace @growthos/api
npm run typecheck
npm test
npm run build
```

Deploy the API, then the web app:

```powershell
vercel deploy --prod --cwd apps/api
vercel deploy --prod --cwd apps/web
```

After the web project receives its stable production alias, set the API's `WEB_ORIGIN` to that exact URL and redeploy the API. Check `https://<web-origin>/api/v1/health/ready` for `{"status":"ready"}`. Test account registration and deletion through the web origin to verify routing, cookies, CSRF checks, and MongoDB transactions.

Vercel project creation succeeded through the CLI, but linking the GitHub repository reported that this Vercel account needs a GitHub Login Connection. Until the account owner adds that connection and runs `vercel git connect` for both projects, deploy updates with the CLI. Do not assume a GitHub push updates the production site.
