# AGENTS.md

## Cursor Cloud specific instructions

### Overview

Elite CRM — a multi-tenant, AI-first CRM platform for insurance broker workflows. Single Next.js 16 app (App Router) with Prisma 7 ORM + PostgreSQL, Bun runtime. See `README.md` for quick-start and `package.json` for all scripts.

### Services

| Service | Port | How to start |
|---|---|---|
| PostgreSQL | 5432 | `sudo service postgresql start` (must be running before Next.js) |
| Next.js dev server | 3000 | `bun run dev` |

### Non-obvious notes

- **Prisma config (`prisma.config.ts`)** falls back to SQLite (`file:./prisma/dev.db`) when `DATABASE_URL` is unset. Always ensure `DATABASE_URL` is exported in the shell or set in `.env` before running Prisma commands.
- **`.env` auto-loading**: Next.js reads `.env` at dev startup, but Prisma CLI commands (e.g. `prisma db push`) require `DATABASE_URL` set via `.env` _or_ exported as a shell env var. If Prisma falls back to SQLite, `DATABASE_URL` is not being picked up — export it explicitly.
- **`bun run test`** runs Vitest. Tests mock `@/lib/db` and do not require a live database.
- **`bun run lint`** runs ESLint 9 with Next.js config. No warnings expected on a clean tree.
- **Database bootstrap**: After installing PostgreSQL and creating the `elite_crm` database, run `npx prisma db push` then `npx prisma db seed` to populate demo data. Optionally run `node scripts/apply-init-sql.mjs` to apply RLS policies.
- **Supabase / AI keys**: Placeholder values in `.env` are sufficient for the app to start. Carrier document uploads and AI features will degrade without real keys.
- **`postinstall` script** runs `prisma generate` automatically after `bun install`.
