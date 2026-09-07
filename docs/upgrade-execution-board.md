# KingCRM Upgrade Execution Board (Local + GitHub Only)

Last updated: 2026-09-07 (review-resolution pass on PR #150)
Owner: @OpsForge

## Non-Negotiables
- Local development only.
- GitHub push allowed after local validation.
- No VPS deploy without explicit approval from @BDUBB.

## Audit Findings — Current Local Status

### 1) Dev placeholder text on auth page
- **Status:** FIXED LOCALLY
- **Evidence:** `src/app/auth/page.tsx` text replaced with user-safe copy.

### 2) Form inputs allowing empty submits
- **Status:** FIXED LOCALLY
- **Evidence:** `required` attributes added; empty-field guards added in handlers; reset password min length enforced.

### 3) No public landing page (`/` → `/auth`)
- **Status:** FIXED LOCALLY
- **Evidence:** `src/app/welcome/page.tsx` added; `middleware.ts` now routes unauthenticated `/` to `/welcome`.

## Validation Gate

### Status: RESOLVED (2026-09-07)
- The former blocker (Node v25 runtime mismatch, lint/test "currently failing") is stale history — full release gate has since run green on the pivot commits: db:generate ✅ typecheck 0 ✅ lint 0 errors ✅ tests 80 passed ✅ build ✅ (isolated worktree, transcripts in PR #150 thread).
- Review-bot findings (cubic/CodeRabbit) on #149/#150 resolved in follow-up commit: public `/book` middleware exemption, offer-toast wording, auth deep-link popstate + param clearing, welcome page canonical metadata, board doc freshness.
- `/book/[slug]` was auth-walled by middleware since the feature shipped (pre-existing bug, now fixed).

### Required unblock steps
1. ~~Switch shell to Node 22.x.~~ Done — Docker build uses `node:22-alpine`.
2. ~~Clean install dependencies for one package manager path.~~ Done — `bun install` for local gate, `npm ci` in the image.
3. ~~Run full validation~~ Done — see Validation Gate status above.

## Owner Assignments (One Task = One Owner)

### @CodeForge
- Own validation unblock + green checks (lint/test passing) on Node 22.
- Produce commit with the 3 audit-fix files.

### @OpsForge
- Own execution board, sequencing, and Pillar 3 kickoff plan (Conversion Infrastructure).
- Prepare next patch queue immediately after validation pass.

### @ATLAS
- Own independent QA pass and proof report against the 3 findings once CodeForge checks are green.

### @Sentinel
- Own status discipline: only report verified state from local repo + command output.

## Pillar 3 (Conversion Infrastructure) — Immediate Start Queue
1. Define lead-capture schema + required fields by source.
2. Add form-level validation map and server-side validation gate.
3. Add conversion event instrumentation (view, start, submit, qualified).
4. Add basic conversion dashboard card set (daily starts, submits, qualified rate).

## Required Proof in Every Update
- changed files
- command outputs
- pass/fail results
- next owner + deadline
