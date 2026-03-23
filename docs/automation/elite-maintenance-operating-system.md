# Elite Maintenance Operating System

## Objective

Keep InsuraFuze shipping like a serious product instead of turning into a fragile side project.

This operating system is the recurring structure for:

- maintenance
- release safety
- agent delegation
- code health
- product hardening

## Weekly Operating Cadence

### Daily

- check production errors
- review failed Vercel deployments
- review auth/session issues
- review database/runtime warnings
- review any new user friction reports

### 3x per week

- smoke test core CRM path:
  - login
  - create lead
  - move pipeline
  - open settings
  - logout

### Weekly

- dependency and security review
- test suite review
- top 5 maintenance debt items
- top 5 product friction points
- top 5 AI improvement opportunities

### Before every production merge

- lint
- typecheck
- tests
- build
- production env sanity check
- live smoke test plan ready

## Agent Workflows

### 1. Release Guardian

Purpose:

- protect production
- validate deploy safety

Responsibilities:

- check env assumptions
- verify auth/session routes
- verify Vercel build output
- run launch checklist
- review runtime logs after deploy

Best recurring prompt:

`Audit the release candidate for production risk. Prioritize auth, data access, env assumptions, migrations, and runtime failures.`

### 2. CRM Workflow Hardener

Purpose:

- keep core business path excellent

Responsibilities:

- audit lead flow
- audit pipeline flow
- audit activity timeline
- audit follow-up actions
- identify broken/weak operator loops

Best recurring prompt:

`Review the CRM core as an operator product. Find anything that slows down or confuses a broker trying to work leads and close revenue.`

### 3. AI Ops Architect

Purpose:

- keep AI practical, not ornamental

Responsibilities:

- improve next-best-action logic
- improve playbooks
- improve carrier recommendations
- improve prompt quality and routing
- identify low-value AI surfaces to cut

Best recurring prompt:

`Find the highest-value AI improvements that make the product feel like a real operator assistant instead of a generic assistant layer.`

### 4. Design Systems Enforcer

Purpose:

- maintain visual consistency and clarity

Responsibilities:

- catch theme drift
- standardize empty states
- standardize loading/error states
- reduce inconsistent CTA patterns

Best recurring prompt:

`Audit the UI for inconsistency, weak hierarchy, unclear actions, and visual drift. Prioritize trust and operator clarity.`

### 5. Maintenance Sweeper

Purpose:

- prevent slow code rot

Responsibilities:

- identify monolith files
- identify duplicate fetch logic
- identify brittle server code
- identify stale docs/scripts
- propose the next maintainability cut

Best recurring prompt:

`Find the highest-leverage maintainability improvement that reduces future breakage without slowing shipping.`

## Skills To Build Or Formalize

These do not have to be implemented tomorrow as Codex skills, but they should exist as operating patterns.

### Skill: `release-guardian`

Inputs:

- branch/PR
- target environment

Outputs:

- release risk summary
- required fixes before merge
- post-deploy smoke checklist

### Skill: `prod-debugger`

Inputs:

- Vercel logs
- failing request
- env assumptions

Outputs:

- exact root cause
- most likely fix
- follow-up verification plan

### Skill: `crm-core-auditor`

Inputs:

- current app
- user path

Outputs:

- friction list
- proposed fixes ordered by revenue impact

### Skill: `ai-workflow-tuner`

Inputs:

- prompts
- routes
- examples

Outputs:

- prompt improvements
- routing improvements
- new AI workflows worth shipping

### Skill: `maintainability-surgeon`

Inputs:

- monolith file
- current app architecture

Outputs:

- extraction plan
- safe refactor slices
- verification checklist

## Workflow Templates

### Workflow: Production Incident Triage

1. identify failing route
2. capture request method/status/body
3. capture Vercel runtime error
4. classify:
   - env
   - db
   - auth
   - schema
   - client bug
5. patch smallest viable fix
6. redeploy
7. rerun exact failing flow
8. write short incident note

### Workflow: Beta Readiness Sweep

1. auth flows
2. core CRM flows
3. settings/security/team
4. integrations visibility
5. runtime errors
6. launch checklist update

### Workflow: Monolith Reduction

1. identify biggest non-feature shell chunk
2. extract presentational component
3. extract state hook
4. extract shared API helper
5. run tests/lint/typecheck
6. document what remains

## Professionalization Moves

To keep this elite over time:

- require PRs for all production changes
- keep a production incident log
- keep a launch readiness checklist as a living file
- maintain a release checklist before every merge to `main`
- keep one doc with current env truth
- keep one doc with current architecture truth

## Best Near-Term Maintenance Bets

- finish extracting feature views from [page.tsx](/Users/bradywilson/Desktop/z.ai-1st-kingCRM/src/app/page.tsx)
- add better error logging context around production routes
- create a single production env truth doc
- add a serverless-safe Prisma/Supabase connection checklist
- add one recurring “core path smoke test” script/playbook

## What “Elite” Means Here

Elite does not mean infinite features.

It means:

- reliable core flows
- obvious operator value
- low production drama
- low maintenance drag
- fast diagnosis when something breaks
- AI that drives action, not noise
