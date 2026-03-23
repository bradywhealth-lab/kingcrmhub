# Elite CRM Simplification Roadmap

## Goal

Get InsuraFuze to feel elite by making it:

- simpler to understand
- harder to break
- faster to operate
- easier to maintain
- more obviously valuable in the first five minutes

## The Core Principle

Do not win by adding more surfaces.

Win by making the highest-value path brutally clear:

1. capture lead
2. qualify with AI
3. move through pipeline
4. trigger follow-up
5. close
6. retain and expand

Everything that does not directly strengthen that loop should be deprioritized or folded into a clearer workflow.

## Simplification Priorities

### 1. Ruthlessly simplify the first-run experience

The first-run experience should not look like a giant all-features control room.

Best direction:

- new user lands in a guided onboarding state
- empty states explain exactly what to do next
- first three actions are obvious:
  - add/import leads
  - connect communication channels
  - activate one workflow

### 2. Turn the product into 4 clear domains

The UI and codebase should converge around these domains:

- CRM Core
  - leads
  - pipeline
  - activities
- AI Operator
  - scoring
  - next best action
  - playbooks
  - automations
- Growth Engine
  - campaigns
  - social
  - sequences
- Admin / Ops
  - team
  - security
  - integrations
  - billing

That is cleaner than the current many-surface mental model.

### 3. Make every page answer one operator question

Each page should answer:

- Dashboard: what matters right now?
- Leads: who do I work next?
- Pipeline: where is revenue stuck?
- Automation: what is running and what is broken?
- Social: what is queued, connected, and published?
- Settings: what controls the workspace?

If a page cannot answer a question crisply, reduce it.

### 4. Remove “wide but shallow” feeling

Avoid fake breadth.

Better:

- fewer actions
- stronger defaults
- clearer workflows
- better empty/loading/error states

Worse:

- many tabs with half-depth workflows

## Product Moves With Highest ROI

### Must-have product polish

- consistent success/error/loading states everywhere
- confirm destructive actions clearly
- every primary button should have one obvious outcome
- every empty state should suggest the next action
- every integration card should show:
  - connected/disconnected
  - last verified time
  - next action needed

### CRM Core should become excellent first

If nothing else gets deep, these must:

- lead detail
- activity timeline
- AI summary
- pipeline move/update
- lead assignment
- notes/tasks/follow-up

This is where the product’s credibility lives.

### AI should feel like an operator, not a gimmick

Best AI surfaces:

- “What should I do next?”
- “Why is this deal risky?”
- “What should I send?”
- “Which carrier is best and why?”
- “Who needs attention today?”

Low-value AI:

- decorative summaries
- vague generic suggestions

## Codebase Simplification Priorities

### Highest-value remaining extractions

Remaining large inline feature views in [page.tsx](/Users/bradywilson/Desktop/z.ai-1st-kingCRM/src/app/page.tsx):

- dashboard
- leads
- pipeline
- uploads
- linear
- automation
- social

Recommended order:

1. leads
2. pipeline
3. dashboard
4. automation
5. social
6. linear
7. uploads

Why:

- leads and pipeline are highest business risk
- dashboard is high-visibility
- automation/social are high-complexity

### Introduce typed feature hooks

Best next hooks:

- `useLeads`
- `usePipeline`
- `useDashboard`
- `useAutomations`
- `useSocialAccounts`
- `useWebhooks`
- `useApiKeys`
- `useAuditLog`

Benefits:

- one fetch/mutation path per domain
- less state duplication
- easier retries/loading/error handling

### Introduce a real API client layer

The codebase should converge on a shared fetch wrapper that handles:

- typed JSON parsing
- error normalization
- auth/session failures
- retry policy
- toast-safe messages

## Launch Philosophy

### Beta standard

Good enough for beta:

- auth reliable
- core CRM flows reliable
- pipeline reliable
- settings/security/team reliable
- clear operator value

### Public launch standard

Needed for broad launch:

- production auth stable for days
- no silent 500s on core routes
- deployment/env process reliable
- better observability
- consistent error recovery
- communication channel integrations dependable

## The Best Long-Term Bet

The best version of InsuraFuze is not “the CRM with the most tabs.”

It is:

- the AI-native insurance CRM that tells the broker exactly what to do next
- with the cleanest operator loop
- and the least maintenance pain behind the scenes

That means simplification is not optional. It is the strategy.
