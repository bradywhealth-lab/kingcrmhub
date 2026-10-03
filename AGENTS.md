# AGENTS.md

## Cursor Cloud specific instructions

### Overview

Elite CRM — a multi-tenant, AI-first CRM platform for insurance broker workflows. Single Next.js 16 app (App Router) with Prisma 7 ORM + PostgreSQL, Node 22 runtime (a `bun >= 1.4.2` engine is declared, but bun must not drive installs — see first note). See `README.md` for quick-start and `package.json` for all scripts.

### Services

| Service | Port | How to start |
|---|---|---|
| PostgreSQL | 5432 | `sudo service postgresql start` (must be running before Next.js) |
| Next.js dev server | 3000 | `npm ci` then `npm run dev` (tees `dev.log`) — never bun (see first note) |

### Non-obvious notes

- **Local dev is `npm ci` + `next dev` — never `bun install`/`bun run dev`.** bun 1.3.11 cannot parse this repo's committed `bun.lock` and silently re-resolves a different dependency set, dropping the protected `next-auth.uuid: 11.1.1` security pin from `package.json` `overrides` (proven on t_598b10c8). `bun.lock` stays in the repo by decision (#4); it must not drive installs.
- **Probe dev servers via `http://localhost:PORT` — the canonical, always-registered origin.** `next.config.ts` sets `allowedDevOrigins` so 127.0.0.1 works too, but any UNREGISTERED host (e.g. a LAN IP like `http://192.168.x.x:PORT`) gets its cross-origin `/_next/*` dev resources (including the HMR websocket) blocked by Next 16 dev: a silently dead, never-hydrated UI indistinguishable from a hung server. When a dev server looks hung, grep `dev.log` for `Blocked cross-origin request` FIRST before diagnosing app code.
- **Prisma config (`prisma.config.ts`)** falls back to SQLite (`file:./prisma/dev.db`) when `DATABASE_URL` is unset. Always ensure `DATABASE_URL` is exported in the shell or set in `.env` before running Prisma commands.
- **`.env` auto-loading**: Next.js reads `.env` at dev startup, but Prisma CLI commands (e.g. `prisma db push`) require `DATABASE_URL` set via `.env` _or_ exported as a shell env var. If Prisma falls back to SQLite, `DATABASE_URL` is not being picked up — export it explicitly.
- **`npm run test`** runs Vitest. Tests mock `@/lib/db` and do not require a live database.
- **`npm run lint`** runs ESLint 9 with Next.js config. No warnings expected on a clean tree.
- **Database bootstrap**: After installing PostgreSQL and creating the `elite_crm` database, run `npx prisma db push` then `npx prisma db seed` to populate demo data. Optionally run `node scripts/apply-init-sql.mjs` to apply RLS policies.
- **Supabase / AI keys**: Placeholder values in `.env` are sufficient for the app to start. Carrier document uploads and AI features will degrade without real keys.
- **`postinstall` script** runs `prisma generate` automatically after `npm ci` (or any install).

### Environment variables

When no injected secrets are present, the cloud agent bootstraps a local PostgreSQL instance and writes a `.env` with `DATABASE_URL=postgresql://elite_user:elite_pass@localhost:5432/elite_crm` plus placeholder values. This is enough for the app to start, lint, and pass tests.

For full functionality (AI routes, Supabase storage, etc.), add the following secrets via the Cursor Secrets panel:

| Secret | Required for |
|---|---|
| `DATABASE_URL` | Core app (local PG is used if absent) |
| `SUPABASE_URL` | Carrier document uploads |
| `SUPABASE_SERVICE_ROLE_KEY` | Carrier document uploads |
| `OPENAI_API_KEY` | AI features (or use `ANTHROPIC_API_KEY` / `GOOGLE_API_KEY`) |
| `INTERNAL_RUNNER_KEY` | Internal runner endpoint auth |
| `APP_BASE_URL` | Runner scripts |
| `RUNNER_ORGANIZATION_ID` | Runner scripts |

Optional: `LINEAR_API_KEY`, `SCRAPINGBEE_API_KEY`, `FIRECRAWL_API_KEY`, `SCRAPER_PROXY_URL_TEMPLATE`, `TRUST_PROXY`, `DEV_DEFAULT_ORG_ID`.
