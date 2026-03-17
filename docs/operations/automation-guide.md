# Elite CRM operational automation guide

This repo now includes a small automation stack designed for a solo maintainer:

- catch code regressions before they land
- verify the deployed app is alive and database-ready
- run the internal follow-up and content schedulers on a timer
- keep dependencies and GitHub Actions reasonably fresh

## What was added

| File | Purpose | Safe or side-effecting |
| --- | --- | --- |
| `.github/workflows/ci.yml` | Runs the release gate on every push and pull request. | Safe |
| `.github/workflows/deployment-smoke-check.yml` | Checks the live app hourly and opens a GitHub issue if it starts failing. | Safe |
| `.github/workflows/runner-tick.yml` | Triggers the app's internal scheduler endpoints every 15 minutes. | Side-effecting |
| `.github/dependabot.yml` | Opens weekly dependency update PRs for app packages and GitHub Actions. | Safe |
| `scripts/release-gate.mjs` | Runs lint, build, Prisma generate, and tests with Bun when available. | Safe |
| `scripts/smoke-check.mjs` | Verifies `/api/health`, `/api/ready`, and runner auth protection. | Safe |

## Exactly what each workflow does

### 1. `ci.yml`

Trigger:

- every push
- every pull request

Steps:

1. **Check out repository**  
   Pulls the current commit into the GitHub Actions runner.
2. **Set up Node.js**  
   Installs Node 20 so Prisma, Next, and repo scripts have a stable runtime.
3. **Set up Bun**  
   Installs Bun because this app is Bun-first.
4. **Install dependencies**  
   Runs `bun install --frozen-lockfile` so CI uses the committed lockfile state.
5. **Run release gate**  
   Executes `node scripts/release-gate.mjs`, which runs:
   - `bun run lint` or `npm run lint`
   - `bun run build` or `npm run build`
   - `bun run db:generate` or `npm run db:generate`
   - `bun run test` or `npm run test`

What this gives you:

- a single red/green gate for code quality
- fast feedback on broken builds, lint errors, Prisma client drift, and failing tests
- the same gate callable locally with `node scripts/release-gate.mjs`

### 2. `deployment-smoke-check.yml`

Trigger:

- manual run from the Actions tab
- automatic hourly schedule at minute 17

Required secret:

- `APP_BASE_URL`

Optional manual input:

- `base_url` to override `APP_BASE_URL` for one-off checks

Steps:

1. **Check out repository**  
   Pulls the smoke-check script into the runner.
2. **Set up Node.js**  
   Installs Node 20 for the script runtime.
3. **Run deployment smoke checks**  
   Executes `node scripts/smoke-check.mjs`, which:
   - calls `GET /api/health` and expects HTTP 200 with `ok: true`
   - calls `GET /api/ready` and expects HTTP 200 with `ready: true`
   - calls `POST /api/sequences/run` without runner credentials and expects HTTP 401
   - calls `POST /api/content/publish` without runner credentials and expects HTTP 401

Why the auth checks matter:

- they verify the internal runner endpoints are present
- they verify those endpoints stay locked down
- they do **not** execute publishing or sequence processing because they intentionally omit the runner key

Failure handling:

- if a scheduled run fails, the workflow opens a GitHub issue titled `Deployment smoke check failed`
- if the issue already exists, the workflow adds a fresh comment instead of opening duplicates
- after a later scheduled success, the workflow comments on that issue and closes it

What this gives you:

- live production verification without touching data
- an issue-based alert trail you can work through asynchronously

### 3. `runner-tick.yml`

Trigger:

- manual run from the Actions tab
- automatic schedule every 15 minutes

Required secrets:

- `APP_BASE_URL`
- `INTERNAL_RUNNER_KEY`
- `RUNNER_ORGANIZATION_ID`

Steps:

1. **Check out repository**  
   Pulls the internal runner script into the runner.
2. **Set up Node.js**  
   Installs Node 20 for the script runtime.
3. **Trigger internal runner endpoints**  
   Executes `node scripts/run-internal-runners.mjs`, which:
   - posts to `/api/sequences/run`
   - posts to `/api/content/publish` with `{ "limit": 25 }`
   - includes `x-internal-runner-key`
   - includes `x-organization-id`

Important behavior:

- this workflow **does real work**
- it can create activity records, advance sequence enrollments, and publish due content queue items
- it should point at the same organization and environment you want automated

Failure handling:

- if a scheduled run fails, the workflow opens a GitHub issue titled `Runner tick failed`
- repeated failures comment on the same issue
- a later successful scheduled run comments and closes the issue

What this gives you:

- a hosted cron replacement
- automation for follow-ups and content publishing without needing another scheduler host

### 4. `dependabot.yml`

Trigger:

- weekly Monday check for app dependencies
- weekly Monday check for GitHub Actions dependencies

Exactly what it does:

- opens PRs for npm ecosystem updates from the repo root
- groups production dependency updates together
- groups development dependency updates together
- opens separate PRs for GitHub Actions version bumps

What this gives you:

- steady, reviewable dependency upkeep
- fewer surprise jumps after long periods of drift

## Exactly what the new scripts do

### `scripts/release-gate.mjs`

- prefers Bun automatically when Bun is installed
- falls back to npm if Bun is unavailable
- exits on the first failing step
- prints which package runner it chose so CI and local output are easy to follow

Use it when:

- you want one command before merging or deploying
- you want CI and local verification to match

### `scripts/smoke-check.mjs`

- requires `APP_BASE_URL`
- strips a trailing slash so URLs stay consistent
- fails if the app is down, the database is not ready, or the internal runner endpoints are accidentally public
- only performs safe read checks plus intentional unauthorized POST checks

Use it when:

- you want to validate a deployed environment manually
- you want the same smoke logic locally and in GitHub Actions

Run it manually with:

- `APP_BASE_URL=https://your-app.example.com node scripts/smoke-check.mjs`

## Required GitHub repository secrets

Set these in GitHub repository settings before expecting the scheduled workflows to be useful:

| Secret | Used by | Why it exists |
| --- | --- | --- |
| `APP_BASE_URL` | smoke check, runner tick | Points workflows at the deployed app |
| `INTERNAL_RUNNER_KEY` | runner tick | Authenticates cron-style internal runner calls |
| `RUNNER_ORGANIZATION_ID` | runner tick | Scopes runner execution to the right tenant/org |

## Recommended operating pattern

1. Let `ci.yml` guard every code change.
2. Let `deployment-smoke-check.yml` watch the live app and create issues only when the deployed app actually fails.
3. Let `runner-tick.yml` own the scheduler loop so follow-ups and queued content continue running.
4. Review Dependabot PRs weekly and rely on CI to tell you if an update is unsafe.

## Manual commands you can keep using

- `node scripts/release-gate.mjs`
- `APP_BASE_URL=https://your-app.example.com node scripts/smoke-check.mjs`
- `APP_BASE_URL=https://your-app.example.com INTERNAL_RUNNER_KEY=... RUNNER_ORGANIZATION_ID=... node scripts/run-internal-runners.mjs`

## After merge checklist

1. Add the required GitHub secrets.
2. Merge the PR so schedules can run from the default branch.
3. Open the Actions tab and manually run:
   - `Deployment smoke check`
   - `Runner tick`
4. Confirm the workflows can see the correct deployed environment.
