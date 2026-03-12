# Elite CRM - Project Summary

## What This Project Is

Elite CRM is a multi-tenant, AI-first CRM platform for life and health insurance broker workflows. The app combines lead management, follow-up automation, scraping, social marketing, and broker document operations into one Next.js product.

## Current Product State

### Implemented and usable

- Lead management and CSV import pipelines.
- AI scoring endpoint + lead re-score workflow.
- AI daily assistant endpoint and dashboard card.
- Sequence management + sequence runner endpoint.
- Scrape jobs with extraction, dedupe, and lead creation.
- Social content queue with AI generation (text + media prompt), scheduling, edit/delete.
- Carrier library for brochures and underwriting docs (upload + metadata + delete).
- Carrier AI playbooks grounded by retrieved underwriting snippets with citations.
- Saveable AI playbooks to lead timeline via activity metadata.
- Internal-key hardening path for automation runner endpoints.

### Partially implemented / not production-hardened yet

- Organization/user context is still mostly hardcoded to `demo-org-1`.
- Scheduled workers are not yet externalized (sequence runner and scraping still need production job orchestration).
- Carrier document storage currently writes to local filesystem under `public/uploads`.
- Some AI flows still rely on mixed fallback logic and need a unified production policy.
- Request validation and rate limiting are not yet consistently enforced across all mutating APIs.

## Technical Stack

- **Frontend:** Next.js App Router, React 19, TypeScript, Tailwind, shadcn/ui, Framer Motion.
- **Backend:** Next.js route handlers under `src/app/api`.
- **Data:** Prisma ORM with SQLite in local/dev; Postgres recommended for production.
- **AI:** `z-ai-web-dev-sdk` via `src/app/api/ai/route.ts` plus deterministic AI support routes.
- **Storage:** local filesystem currently for carrier docs; object storage recommended for production.

## Key Domains In Schema

- Core CRM: organizations, users, leads, activities, pipeline, sequences, content queue.
- AI domain: feedback, insights, scoring metadata.
- Scrape domain: `ScrapeJob`, `ScrapedContact`.
- Broker domain: `Carrier`, `CarrierDocument`, `CarrierDocumentChunk`.

## API Surface (Notable)

- Leads: `/api/leads`, `/api/leads/[id]`
- Uploads: `/api/upload`
- Scraping: `/api/scrape`
- Sequences: `/api/sequences`, `/api/sequences/run`
- Sequence enrollment: `/api/sequences/enroll`
- AI: `/api/ai`, `/api/ai/score`, `/api/ai/feedback`, `/api/ai/my-day`, `/api/ai/carrier-playbook`, `/api/ai/carrier-playbook/save`
- Social: `/api/content`, `/api/content/publish`
- Appointments: `/api/bookings`
- Carriers/docs: `/api/carriers`, `/api/carriers/[id]`, `/api/carriers/[id]/documents`, `/api/carriers/[id]/documents/[docId]`

## Production Readiness Snapshot

### Ready

- Core feature architecture is in place across API, DB, and UI.
- Lint and production build passed in this session.

### Must complete before production launch

1. Replace hardcoded org context with real auth/session enforcement.
2. Move production DB to Postgres and run migration deployment flow.
3. Move carrier docs from local filesystem to object storage.
4. Add request validation and rate limiting to mutating endpoints.
5. Add scheduler/worker infrastructure for recurring automation jobs and protect runner calls with `INTERNAL_RUNNER_KEY`.

For full detail, see `cursor_sessionhandoff.md`.
