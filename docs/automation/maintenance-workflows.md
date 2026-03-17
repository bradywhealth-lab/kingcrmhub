# Elite CRM Maintenance Workflows

This document explains exactly what automation was added, what each workflow does, and how to operate it as a solo maintainer.

## Files added

- `.github/workflows/ci.yml`
- `.github/workflows/dependency-review.yml`
- `.github/workflows/codeql.yml`
- `.github/workflows/nightly-maintenance.yml`
- `.github/workflows/auto-label.yml`
- `.github/workflows/issue-triage.yml`
- `.github/workflows/stale.yml`
- `.github/dependabot.yml`
- `.github/labeler.yml`

## 1) CI workflow (`ci.yml`)

### Trigger

- On `push` to `main` and `cursor/**`
- On `pull_request` targeting `main`

### What it does

Runs four independent status-check jobs on every change:

1. **`lint`**: install dependencies then run `bun run lint`
2. **`typecheck`**: install dependencies then run `bun run typecheck` (a gate that blocks new TypeScript errors while allowing the current baseline debt)
3. **`test`**: install dependencies then run `bun run test`
4. **`build`**: install dependencies, run Prisma generate, then run `bun run build`

Each job appears as a separate GitHub check, so branch protections can require them individually.
For Dependabot-authored PRs, CI uses non-frozen `bun install` to avoid lockfile drift failures between `package-lock.json` and `bun.lock`.

### Why this helps

- Prevents broken PRs from merging.
- Catches type/lint/test/build regressions early.
- Makes every PR self-validating without manual babysitting.

## 2) Dependency Review (`dependency-review.yml`)

### Trigger

- On `pull_request` targeting `main`

### What it does

- Uses `actions/dependency-review-action` to inspect dependency changes.
- Fails PR checks when dependency updates introduce known vulnerabilities at **high severity or higher**.
- If GitHub Dependency Graph is disabled, it skips gracefully instead of failing the whole PR.

### Why this helps

- Stops risky dependency bumps before merge.
- Gives a simple security gate with zero local effort.

## 3) CodeQL static security scan (`codeql.yml`)

### Trigger

- On push to `main`
- On pull requests to `main`
- Weekly scheduled scan

### What it does

- Initializes CodeQL for JavaScript/TypeScript.
- Runs CodeQL analysis and uploads findings to GitHub Security alerts.

### Why this helps

- Finds dataflow/security issues not caught by lint/tests.
- Gives continuous security scanning with no manual steps.

## 4) Nightly Maintenance (`nightly-maintenance.yml`)

### Trigger

- Daily schedule
- Manual `workflow_dispatch` run

### What it does

`health-check` job:

1. Checkout
2. Setup Bun
3. Install dependencies
4. Prisma generate
5. Run lint + typecheck + tests + build

`create-alert-issue` job (only if health-check fails):

- Creates (or updates) a single issue titled **"Nightly maintenance failed"**
- Includes direct link to the failing workflow run and commit SHA

### Why this helps

- You get proactive breakage detection even without active development.
- You get an issue automatically created instead of silently missing failures.

## 5) PR Auto Labeling (`auto-label.yml` + `labeler.yml`)

### Trigger

- On PR open/sync/reopen/ready-for-review (`pull_request_target`)

### What it does

- Uses path rules in `.github/labeler.yml` to apply labels automatically.
- Current scope labels include:
  - `frontend`
  - `backend`
  - `database`
  - `tests`
  - `documentation`
  - `automation`

### Why this helps

- Faster triage and filtering when you review many PRs.
- Better prioritization and search by area.

## 6) AI-Assisted Issue Triage (`issue-triage.yml`)

### Trigger

- On issue `opened` and `edited`

### What it does

- Heuristically classifies issue text and applies labels:
  - `bug`, `enhancement`, `documentation`, `security`, `database`, `frontend`
- If a label does not exist yet, it creates it.
- On new issues, posts one intake checklist comment with:
  - Required repro details
  - Expected vs actual behavior guidance
  - Suggested AI prompt for debugging that specific issue

### Why this helps

- Standardizes issue quality without manual copy/paste.
- Gives immediate AI-driven next step to anyone opening issues.

## 7) Stale management (`stale.yml`)

### Trigger

- Weekly schedule
- Manual `workflow_dispatch`

### What it does

- Marks inactive issues/PRs as stale.
- Auto-closes them after a grace period.
- Exempts high-priority/security labels from auto-close.

### Why this helps

- Keeps backlog clean and actionable.
- Reduces noise for a solo maintainer.

## 8) Dependabot (`dependabot.yml`)

### Trigger

- Weekly update checks for:
  - npm dependencies
  - GitHub Actions dependencies

### What it does

- Opens update PRs automatically.
- Groups npm patch/minor updates to reduce PR noise.
- Uses commit prefixes:
  - `deps` for npm
  - `ci` for workflow updates

### Why this helps

- Security and ecosystem updates happen continuously.
- Less manual dependency hygiene work.

## Operating model for solo maintenance

Recommended default loop:

1. Dependabot opens update PRs.
2. CI + Dependency Review + CodeQL validate risk.
3. Auto-labeling adds scope labels.
4. Merge only green PRs.
5. Nightly workflow catches drift when no one is pushing code.
6. Stale workflow keeps backlog manageable.
7. Issue triage workflow keeps new issues structured and AI-ready.

## Required repository settings/checks

- Enable GitHub Actions for this repository.
- Protect `main` and require at least:
  - `Status Checks / lint`
  - `Status Checks / typecheck`
  - `Status Checks / test`
  - `Status Checks / build`
  - `Dependency Review / Block vulnerable dependency changes`
- Keep GitHub Security features enabled so CodeQL results are visible.

## Optional future upgrades

- Add release workflow (tag + changelog + deploy) once deploy pipeline is finalized.
- Add integration-test workflow against ephemeral PostgreSQL service.
- Add AI-generated release notes workflow from merged PRs.
