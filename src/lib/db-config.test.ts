import { describe, expect, it } from 'vitest'
import {
  isPoolExhaustionError,
  resolvePgPoolConfig,
  resolvePrismaLogConfig,
  withPoolRetry,
} from '@/lib/db-config'

// ---------------------------------------------------------------------------
// Grounded in production evidence (2026-09-29), not theory:
//   docker logs --since 3h kingcrmhub  | grep -E -c  "P2028"       -> 54
//   docker logs --since 3h kingcrmhub  | grep -E -ic "too many clients|remaining connection slots" -> 0
//   docker logs --since 30m kingcrmhub | grep -E -c  "prisma:query" -> ~1.6/sec on 1 vCPU
// NOTE: the `-E` matters. An earlier version of this comment quoted a BRE grep,
// where `|` is a literal character, so that count proved nothing. Re-measured
// with -E (and each phrase separately) the zero does hold. Never cite a BRE
// alternation as evidence.
// WINDOW CAVEAT: the container restarted 2026-09-29T22:46:02Z, so a fresh window
// reads 0 P2028 only because no load has hit it yet. The 54 is from the
// pre-restart container under real traffic.
// The pooler (Supabase transaction mode) is NOT rejecting connections, so the
// exhaustion is client-side: N concurrent transactions with 3.7-7.1s latencies
// exceed Prisma's default $transaction maxWait of 2s and die as P2028 -> HTTP 500.
// ---------------------------------------------------------------------------

describe('resolvePrismaLogConfig', () => {
  it('does NOT log every query in production', () => {
    const log = resolvePrismaLogConfig({ NODE_ENV: 'production' })
    expect(log).not.toContain('query')
  })

  it('keeps verbose query logging in development', () => {
    expect(resolvePrismaLogConfig({ NODE_ENV: 'development' })).toContain('query')
  })

  it('keeps verbose query logging under test', () => {
    expect(resolvePrismaLogConfig({ NODE_ENV: 'test' })).toContain('query')
  })

  it('allows an explicit production opt-in for debugging a live incident', () => {
    const log = resolvePrismaLogConfig({ NODE_ENV: 'production', PRISMA_QUERY_LOG: '1' })
    expect(log).toContain('query')
  })

  it('treats "true" as an opt-in and ignores empty strings', () => {
    expect(resolvePrismaLogConfig({ NODE_ENV: 'production', PRISMA_QUERY_LOG: 'true' })).toContain('query')
    expect(resolvePrismaLogConfig({ NODE_ENV: 'production', PRISMA_QUERY_LOG: '' })).not.toContain('query')
  })

  it('still surfaces errors in production (silencing errors would hide the next P2028)', () => {
    expect(resolvePrismaLogConfig({ NODE_ENV: 'production' })).toContain('error')
  })
})

describe('resolvePgPoolConfig', () => {
  it('defaults to pg.Pool max=10, preserving current behaviour', () => {
    // Verified from node_modules/pg-pool/index.js:89
    //   this.options.max = this.options.max || this.options.poolSize || 10
    expect(resolvePgPoolConfig({}).max).toBe(10)
  })

  it('honours DB_POOL_MAX so the pool can be tuned per environment', () => {
    expect(resolvePgPoolConfig({ DB_POOL_MAX: '20' }).max).toBe(20)
  })

  it('ignores a nonsense DB_POOL_MAX instead of poisoning the pool', () => {
    for (const bad of ['0', '-5', 'abc', '', '1e3', 'NaN']) {
      expect(resolvePgPoolConfig({ DB_POOL_MAX: bad }).max).toBe(10)
    }
  })

  it('caps DB_POOL_MAX at a sane ceiling so a typo cannot exhaust the pooler', () => {
    expect(resolvePgPoolConfig({ DB_POOL_MAX: '99999' }).max).toBeLessThanOrEqual(100)
  })

  it('ignores ?max= in the connection string — pg.Pool reads max only from its options object', () => {
    // MEASURED empirically against the installed pg (not assumed):
    //   new Pool({connectionString:'...?max=25'}).options.max  -> 10  (inert)
    //   new Pool({connectionString:'...?max=25', max:12}).options.max -> 12
    // pg-connection-string does copy unknown params generically into the parsed
    // config, but pg.Pool sets its own options.max BEFORE that parse and never
    // reads it back. So the only working knob is an explicit `max` here.
    const cfg = resolvePgPoolConfig({
      DATABASE_URL: 'postgres://user:***@host:5432/db?max=25',
    })
    expect(cfg.max).toBe(10)
  })

  it('does not treat connection_limit as a pool size, because pg never reads it', () => {
    // MEASURED: new Pool({connectionString:'...?connection_limit=25&pool_timeout=20'}).options.max -> 10.
    // grep across node_modules/pg/lib + pg-connection-string for "connection_limit" = 0 hits.
    const cfg = resolvePgPoolConfig({
      DATABASE_URL: 'postgres://user:***@host:5432/db?connection_limit=25&pool_timeout=20',
    })
    expect(cfg.max).toBe(10)
  })

  it('uses DB_POOL_MAX as the only supported pool-size knob', () => {
    const cfg = resolvePgPoolConfig({
      DATABASE_URL: 'postgres://user:***@host:5432/db?max=25',
      DB_POOL_MAX: '12',
    })
    expect(cfg.max).toBe(12)
  })

  it('sets connection and idle timeouts so a wedged socket is reclaimed', () => {
    const cfg = resolvePgPoolConfig({})
    expect(cfg.connectionTimeoutMillis).toBeGreaterThan(0)
    expect(cfg.idleTimeoutMillis).toBeGreaterThan(0)
  })

  it('accepts env overrides for both timeouts', () => {
    const cfg = resolvePgPoolConfig({
      DB_POOL_CONNECTION_TIMEOUT_MS: '5000',
      DB_POOL_IDLE_TIMEOUT_MS: '15000',
    })
    expect(cfg.connectionTimeoutMillis).toBe(5000)
    expect(cfg.idleTimeoutMillis).toBe(15000)
  })
})

describe('isPoolExhaustionError', () => {
  // cubic P2 (confidence 9), accepted: Prisma reports P2028 for Transaction API
  // errors GENERALLY, including a transaction that timed out MID-RUN. Matching on
  // the code alone would retry the whole callback — so a scrape handler would
  // repeat its external fetches and a POST could double-apply. Only the
  // acquisition wording is safe. These tests encode that narrower contract.

  it('matches the acquisition failure logged in production (code + wording)', () => {
    const err = Object.assign(
      new Error('Transaction API error: Unable to start a transaction in the given time.'),
      { code: 'P2028' },
    )
    expect(isPoolExhaustionError(err)).toBe(true)
  })

  it('matches the acquisition wording even when the code is absent', () => {
    expect(
      isPoolExhaustionError(new Error('Unable to start a transaction in the given time')),
    ).toBe(true)
  })

  it('does NOT match a bare P2028 code — that may be a mid-run transaction timeout', () => {
    // The over-broad version of this code returned true here, which is exactly the
    // double-side-effect hazard cubic flagged.
    expect(isPoolExhaustionError(Object.assign(new Error('x'), { code: 'P2028' }))).toBe(false)
  })

  it('does NOT match other P2028 wordings (write conflict, expired transaction)', () => {
    for (const message of [
      'Transaction already closed: A query cannot be executed on an expired transaction',
      'Transaction API error: Transaction write conflict detected',
      'P2028',
    ]) {
      expect(isPoolExhaustionError(Object.assign(new Error(message), { code: 'P2028' }))).toBe(false)
    }
  })

  it('matches pg 57P03 (cannot_connect_now) — a pre-execution refusal', () => {
    expect(isPoolExhaustionError(Object.assign(new Error('x'), { code: '57P03' }))).toBe(true)
  })

  it('does NOT match other Prisma errors', () => {
    expect(isPoolExhaustionError(Object.assign(new Error('x'), { code: 'P2002' }))).toBe(false) // unique constraint
    expect(isPoolExhaustionError(Object.assign(new Error('x'), { code: 'P2025' }))).toBe(false) // record not found
  })

  it('does NOT match generic or non-Error values', () => {
    expect(isPoolExhaustionError(new Error('connection refused'))).toBe(false)
    expect(isPoolExhaustionError(null)).toBe(false)
    expect(isPoolExhaustionError(undefined)).toBe(false)
    expect(isPoolExhaustionError('Unable to start a transaction in the given time')).toBe(false)
  })
})

describe('withPoolRetry', () => {
  it('returns the value when the first attempt succeeds', async () => {
    let calls = 0
    const out = await withPoolRetry(async () => {
      calls++
      return 'ok'
    })
    expect(out).toBe('ok')
    expect(calls).toBe(1)
  })

  it('retries on P2028 and returns the later success', async () => {
    let calls = 0
    const out = await withPoolRetry(
      async () => {
        calls++
        if (calls < 3)
        throw Object.assign(new Error('Transaction API error: Unable to start a transaction in the given time.'), { code: 'P2028' })
        return 'recovered'
      },
      { sleep: async () => {} },
    )
    expect(out).toBe('recovered')
    expect(calls).toBe(3)
  })

  it('is bounded: gives up after `attempts` and rethrows the last error', async () => {
    let calls = 0
    await expect(
      withPoolRetry(
        async () => {
          calls++
          throw Object.assign(
            new Error(`Unable to start a transaction in the given time (boom ${calls})`),
            { code: 'P2028' },
          )
        },
        { attempts: 3, sleep: async () => {} },
      ),
    ).rejects.toThrow('boom 3')
    expect(calls).toBe(3)
  })

  it('does NOT retry a non-pool error — a write may already have run', async () => {
    // Safety invariant: P2028 means the transaction never STARTED, so a retry
    // cannot duplicate a write. Any other error is re-thrown immediately.
    for (const err of [
      Object.assign(new Error('x'), { code: 'P2002' }),
      Object.assign(new Error('x'), { code: 'P2025' }),
      new Error('ECONNRESET'),
    ]) {
      let calls = 0
      await expect(
        withPoolRetry(
          async () => {
            calls++
            throw err
          },
          { attempts: 5, sleep: async () => {} },
        ),
      ).rejects.toThrow()
      expect(calls).toBe(1)
    }
  })

  it('backs off between attempts and never sleeps after the final attempt', async () => {
    const slept: number[] = []
    await withPoolRetry(
      async () => {
        if (slept.length < 2)
          throw Object.assign(new Error('Unable to start a transaction in the given time.'), { code: 'P2028' })
        return 'ok'
      },
      {
        attempts: 4,
        baseDelayMs: 100,
        maxDelayMs: 1000,
        sleep: async ms => {
          slept.push(ms)
        },
      },
    )
    expect(slept).toHaveLength(2) // 2 failures -> 2 sleeps, none after success
    expect(slept[1]).toBeGreaterThan(slept[0]) // exponential growth
  })

  it('caps the backoff at maxDelayMs', async () => {
    const slept: number[] = []
    await expect(
      withPoolRetry(
        async () => {
          throw Object.assign(new Error('Unable to start a transaction in the given time.'), { code: 'P2028' })
        },
        {
          attempts: 6,
          baseDelayMs: 100,
          maxDelayMs: 250,
          sleep: async ms => {
            slept.push(ms)
          },
        },
      ),
    ).rejects.toThrow()
    expect(Math.max(...slept)).toBeLessThanOrEqual(250)
  })

  it('treats attempts<1 as a single try', async () => {
    let calls = 0
    await expect(
      withPoolRetry(
        async () => {
          calls++
          throw Object.assign(new Error('Unable to start a transaction in the given time.'), { code: 'P2028' })
        },
        { attempts: 0, sleep: async () => {} },
      ),
    ).rejects.toThrow()
    expect(calls).toBe(1)
  })
})
