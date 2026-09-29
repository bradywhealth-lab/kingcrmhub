/**
 * Database client configuration: Prisma logging, pg pool sizing, and a
 * pool-exhaustion retry that is safe for write paths.
 *
 * Extracted from src/lib/db.ts so the behaviour can be unit-tested without
 * constructing a real PrismaClient.
 *
 * ## Production evidence behind these defaults (2026-09-29, measured — not assumed)
 * - `docker logs --since 3h kingcrmhub | grep -c P2028`  -> **54**
 *   sample: "Transaction API error: Unable to start a transaction in the given
 *   time. code: 'P2028'"
 * - `grep -c "too many clients|remaining connection slots"` -> **0**
 *   => the Supabase pooler is NOT rejecting connections; exhaustion is client-side.
 * - `docker logs --since 30m | grep -c "prisma:query"` -> **1773** (~1/sec) on a
 *   1-vCPU container, because db.ts passed `log: ['query']` unconditionally.
 * - 16 parallel requests -> 6 succeed / 10 x HTTP 500 (OpsForge's burst repro);
 *   8 parallel all pass but take 3.7-7.1s.
 *
 * ## Why `connection_limit` is NOT the knob (verified against installed source)
 * `pg.Pool` derives its size from `options.max`:
 *   node_modules/pg-pool/index.js:89
 *     this.options.max = this.options.max || this.options.poolSize || 10
 * Measured empirically with the installed pg:
 *   new Pool({connectionString:'...?connection_limit=25'}) -> max 10  (inert)
 *   new Pool({connectionString:'...?max=25'})              -> max 10  (inert!)
 *   new Pool({connectionString:'...', max: 12})            -> max 12  (works)
 * `pg-connection-string` does copy unknown query params into the parsed config,
 * but `pg.Pool` sets its own `options.max` before that parse and never reads it
 * back. So the ONLY supported knob is an explicit `max` — exposed here as
 * `DB_POOL_MAX`.
 */

import type { Prisma } from '@prisma/client'

/** pg.Pool options we manage explicitly. */
export type PgPoolConfig = {
  max: number
  idleTimeoutMillis: number
  connectionTimeoutMillis: number
}

/** Env subset these helpers read, so they are testable without process.env. */
export type DbEnv = Record<string, string | undefined>

/** pg.Pool's own default (pg-pool/index.js:89). Preserved so this change is behaviour-neutral by default. */
const PG_DEFAULT_MAX = 10

/**
 * Hard ceiling so a typo in DB_POOL_MAX cannot open thousands of sockets and
 * exhaust the upstream pooler (which would fail closed for every user).
 */
const PG_MAX_CEILING = 100

const DEFAULT_IDLE_TIMEOUT_MS = 10_000
const DEFAULT_CONNECTION_TIMEOUT_MS = 10_000

function parsePositiveInt(raw: string | undefined): number | null {
  if (!raw) return null
  const trimmed = raw.trim()
  if (!/^\d+$/.test(trimmed)) return null // rejects '', '-5', 'abc', '1e3', 'NaN', '12.5'
  const n = Number.parseInt(trimmed, 10)
  if (!Number.isFinite(n) || n <= 0) return null
  return n
}

function isTruthyFlag(raw: string | undefined): boolean {
  if (!raw) return false
  const v = raw.trim().toLowerCase()
  return v === '1' || v === 'true' || v === 'yes' || v === 'on'
}

/**
 * Prisma log levels.
 *
 * Query logging is development-only: at ~1 line/sec it burned CPU/IO on a 1-vCPU
 * production container (1773 lines in 30 min measured). `error` is always kept —
 * silencing errors would hide the next P2028. Set `PRISMA_QUERY_LOG=1` to opt
 * back in while debugging a live incident.
 */
export function resolvePrismaLogConfig(env: DbEnv = process.env): Prisma.LogLevel[] {
  const isProd = env.NODE_ENV === 'production'
  const logQueries = !isProd || isTruthyFlag(env.PRISMA_QUERY_LOG)

  const levels: Prisma.LogLevel[] = ['error', 'warn']
  if (logQueries) levels.push('query')
  return levels
}

/**
 * pg.Pool configuration.
 *
 * `DB_POOL_MAX` is the only supported pool-size knob (see the file header for
 * why URL params do not work). Defaults preserve current behaviour (max 10) so
 * this PR changes nothing until the pool is deliberately tuned.
 */
export function resolvePgPoolConfig(env: DbEnv = process.env): PgPoolConfig {
  const requested = parsePositiveInt(env.DB_POOL_MAX)
  const max = Math.min(requested ?? PG_DEFAULT_MAX, PG_MAX_CEILING)

  return {
    max,
    idleTimeoutMillis:
      parsePositiveInt(env.DB_POOL_IDLE_TIMEOUT_MS) ?? DEFAULT_IDLE_TIMEOUT_MS,
    connectionTimeoutMillis:
      parsePositiveInt(env.DB_POOL_CONNECTION_TIMEOUT_MS) ?? DEFAULT_CONNECTION_TIMEOUT_MS,
  }
}

/**
 * True only when the failure means "a transaction/connection could not be
 * ACQUIRED" — i.e. nothing ran yet, so a retry cannot duplicate a write.
 *
 * - Prisma `P2028`: "Unable to start a transaction in the given time"
 * - Postgres `57P03`: cannot_connect_now
 *
 * Deliberately narrow. Mid-transaction failures (unique constraint P2002,
 * not-found P2025, socket resets) are NOT retried: a write may already have
 * been applied.
 */
export function isPoolExhaustionError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const err = error as { code?: unknown; message?: unknown }

  if (typeof err.code === 'string') {
    if (err.code === 'P2028' || err.code === '57P03') return true
  }

  const message = typeof err.message === 'string' ? err.message : ''
  return (
    message.includes('Unable to start a transaction in the given time') ||
    message.includes('P2028') ||
    message.includes('cannot_connect_now')
  )
}

export type PoolRetryOptions = {
  /** Total attempts including the first. Values < 1 are treated as 1. */
  attempts?: number
  /** First backoff delay in ms; doubles each attempt. */
  baseDelayMs?: number
  /** Ceiling for the exponential backoff. */
  maxDelayMs?: number
  /** Injectable for tests so no real timers are used. */
  sleep?: (ms: number) => Promise<void>
}

const realSleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))

/**
 * Retry `fn` only while it fails to ACQUIRE a pool slot.
 *
 * Exponential backoff with jitter, capped at `maxDelayMs`. No sleep after the
 * final attempt (pointless latency on a guaranteed failure).
 */
export async function withPoolRetry<T>(
  fn: () => Promise<T>,
  options: PoolRetryOptions = {},
): Promise<T> {
  const attempts = Math.max(1, Math.trunc(options.attempts ?? 3))
  const baseDelayMs = options.baseDelayMs ?? 120
  const maxDelayMs = options.maxDelayMs ?? 1500
  const sleep = options.sleep ?? realSleep

  let lastError: unknown
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn()
    } catch (error) {
      if (!isPoolExhaustionError(error)) throw error
      lastError = error
      if (attempt < attempts) {
        const backoff = Math.min(baseDelayMs * 2 ** (attempt - 1), maxDelayMs)
        // Full jitter: spreads retries from N concurrent requests that all
        // failed for the same reason, so they do not re-collide in lockstep.
        const jitter = Math.random() * baseDelayMs * 0.25
        await sleep(Math.min(backoff + jitter, maxDelayMs))
      }
    }
  }
  throw lastError
}
