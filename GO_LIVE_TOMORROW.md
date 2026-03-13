# Go-Live Tomorrow Checklist

Run this list in order. Each step includes a quick verification before moving on.

## 1) Configure environment variables

Set production variables from `.env.example` in your hosting provider dashboard.

Required minimum:
- `DATABASE_URL`
- `INTERNAL_RUNNER_KEY`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_STORAGE_BUCKET`
- `RUNNER_ORGANIZATION_ID`
- `APP_BASE_URL`
- AI provider key(s) used by your deployment

Optional:
- `LINEAR_API_KEY`
- `SCRAPINGBEE_API_KEY`
- `SCRAPER_PROXY_URL_TEMPLATE`
- `FIRECRAWL_API_KEY`
- `TRUST_PROXY=1` (if behind a trusted reverse proxy and not on Vercel)

Verify:
- Confirm no `.env` or secret file is committed to git.

## 2) Prepare production database

1. Create a production Postgres instance.
2. Set `DATABASE_URL` in the host.
3. Run:
   - `npm run db:generate`
   - migration deploy step for your environment (for Prisma, typically `prisma migrate deploy` in CI/CD)

Verify:
- `GET /api/ready` returns 200 and reports database `ok`.

## 3) Configure Supabase object storage

1. Create the bucket referenced by `SUPABASE_STORAGE_BUCKET`.
2. Ensure server-side credentials (`SUPABASE_SERVICE_ROLE_KEY`) are valid.
3. Confirm bucket policies allow server-side upload/delete operations.

Verify:
- Upload a carrier document in the app and confirm object exists in the bucket.

## 4) Schedule automation runner

Create a recurring job that runs:
- `npm run runner:tick`

Required runner env:
- `APP_BASE_URL`
- `INTERNAL_RUNNER_KEY`
- `RUNNER_ORGANIZATION_ID`

Recommended cadence:
- Every 5-15 minutes (adjust by lead/content volume).

Verify:
- Trigger the runner once manually and confirm successful calls to:
  - `POST /api/sequences/run`
  - `POST /api/content/publish`

## 5) Deploy application

Deploy using your normal CI/CD path (for example push to `main` for Vercel).

Verify:
- `GET /api/health` returns 200.
- `GET /api/ready` returns 200 after database is online.

## 6) Execute manual smoke tests

Run sections 1-7 in `ELITE_TEST_CHECKLIST.md`:
- lead scraping
- social content generation and publishing
- follow-up automation
- AI scoring/feedback/my-day
- carrier library
- carrier AI playbook + save to timeline
- runner security behavior

Verify:
- Each section passes with expected status transitions and activity records.

## 7) Verify runner endpoint security

With `INTERNAL_RUNNER_KEY` set:
1. Call runner endpoints without `x-internal-runner-key`.
2. Expect `401`.
3. Call again with valid `x-internal-runner-key`.
4. Expect success.

Endpoints:
- `POST /api/content/publish`
- `POST /api/sequences/run`

Verify:
- Scheduler is configured with the key and correct org id.

## 8) Final release gate

Run:
- `npm run release-gate`

Verify:
- Lint, build, Prisma generate, and tests all pass.
- No secrets are staged or committed.
