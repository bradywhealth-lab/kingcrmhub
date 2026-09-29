import { beforeEach, describe, expect, it, vi } from 'vitest'

// ---------------------------------------------------------------------------
// Wiring test — the lesson from PR #220: a unit test can be green while the
// integration point is wrong. db-config.test.ts proves resolvePgPoolConfig()
// returns the right shape, but NOTHING there proves db.ts actually hands `max`
// to PrismaPg. If someone reverts db.ts to `new PrismaPg({ connectionString })`
// the pool silently drops back to the default and every unit test still passes.
//
// So: mock the adapter + client, import db.ts fresh, and assert what was
// actually constructed.
// ---------------------------------------------------------------------------

const prismaPgCalls: Array<{ config: unknown; options: unknown }> = []
const prismaClientCalls: Array<Record<string, unknown>> = []

// NOTE: these mocks must be `function` expressions, not arrows — `new PrismaPg(...)`
// throws "is not a constructor" for an arrow function.
vi.mock('@prisma/adapter-pg', () => ({
  PrismaPg: vi.fn(function (this: unknown, config: unknown, options: unknown) {
    prismaPgCalls.push({ config, options })
    return { provider: 'postgres', adapterName: 'prisma-pg-mock' }
  }),
}))

vi.mock('@prisma/adapter-better-sqlite3', () => ({
  PrismaBetterSqlite3: vi.fn(function (this: unknown) {
    return { provider: 'sqlite' }
  }),
}))

vi.mock('@prisma/client', () => ({
  PrismaClient: vi.fn(function (this: unknown, opts: Record<string, unknown>) {
    prismaClientCalls.push(opts)
    return { $transaction: vi.fn(), $connect: vi.fn(), $disconnect: vi.fn() }
  }),
}))

// A fake but well-formed Postgres DSN. Never a real credential.
const TEST_DSN = 'postgres://test_user:***@db.example.com:5432/test_db'

/**
 * db.ts caches its client on `globalThis.prisma` (the Next.js hot-reload guard),
 * and `vi.resetModules()` does NOT clear globals — so without wiping it, only the
 * first test in the file would ever construct the adapter and every later test
 * would silently assert against an empty call log.
 */
function clearPrismaSingleton() {
  const g = globalThis as unknown as { prisma?: unknown }
  delete g.prisma
}

async function loadDbModule() {
  vi.resetModules()
  clearPrismaSingleton()
  prismaPgCalls.length = 0
  prismaClientCalls.length = 0
  // Touch the proxy so createPrismaClient() actually runs.
  const mod = await import('@/lib/db')
  void mod.db.$transaction
  return mod
}

function constructedClient() {
  const g = globalThis as unknown as { prisma?: { $transaction: ReturnType<typeof vi.fn> } }
  if (!g.prisma) throw new Error('PrismaClient singleton was not constructed')
  return g.prisma
}

describe('db.ts postgres wiring', () => {
  beforeEach(() => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('DATABASE_URL', TEST_DSN)
    delete process.env.PRISMA_QUERY_LOG
    delete process.env.DB_POOL_MAX
  })

  it('passes an explicit pool max to PrismaPg, not just a connection string', async () => {
    await loadDbModule()
    expect(prismaPgCalls).toHaveLength(1)
    const cfg = prismaPgCalls[0].config as { connectionString?: string; max?: number }
    expect(typeof cfg.connectionString).toBe('string')
    expect(cfg.max).toBe(10) // pg.Pool default, preserved deliberately
  })

  it('honours DB_POOL_MAX at construction time', async () => {
    vi.stubEnv('DB_POOL_MAX', '24')
    await loadDbModule()
    const cfg = prismaPgCalls[0].config as { max?: number }
    expect(cfg.max).toBe(24)
  })

  it('sets connection and idle timeouts so wedged sockets are reclaimed', async () => {
    await loadDbModule()
    const cfg = prismaPgCalls[0].config as Record<string, unknown>
    expect(cfg.connectionTimeoutMillis).toBeGreaterThan(0)
    expect(cfg.idleTimeoutMillis).toBeGreaterThan(0)
  })

  it('attaches a pool error handler (an idle client error would otherwise crash the process)', async () => {
    await loadDbModule()
    const opts = prismaPgCalls[0].options as { onPoolError?: unknown }
    expect(typeof opts.onPoolError).toBe('function')
  })

  it('does NOT enable query logging in production', async () => {
    await loadDbModule()
    expect(prismaClientCalls).toHaveLength(1)
    expect(prismaClientCalls[0].log).not.toContain('query')
  })

  it('keeps error logging in production so the next P2028 is still visible', async () => {
    await loadDbModule()
    expect(prismaClientCalls[0].log).toContain('error')
  })

  it('enables query logging in development', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    await loadDbModule()
    expect(prismaClientCalls[0].log).toContain('query')
  })

  it('allows an explicit production opt-in for live debugging', async () => {
    vi.stubEnv('PRISMA_QUERY_LOG', '1')
    await loadDbModule()
    expect(prismaClientCalls[0].log).toContain('query')
  })

  it('relaxes TLS for the Supabase pooler host (existing behaviour must not regress)', async () => {
    vi.stubEnv(
      'DATABASE_URL',
      'postgres://test_user:***@aws-1-us-east-1.pooler.supabase.com:5432/test_db',
    )
    await loadDbModule()
    const cfg = prismaPgCalls[0].config as { connectionString?: string }
    expect(cfg.connectionString).toContain('sslmode=no-verify')
  })

  it('preserves Supabase TLS for a non-pooler production host', async () => {
    vi.stubEnv('DATABASE_URL', 'postgres://test_user:***@db.example.com:5432/test_db?sslmode=require')
    await loadDbModule()
    const cfg = prismaPgCalls[0].config as { connectionString?: string }
    expect(cfg.connectionString).not.toContain('sslmode=no-verify')
  })
})

describe('db.ts transaction helpers retry pool exhaustion', () => {
  beforeEach(() => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('DATABASE_URL', TEST_DSN)
  })

  /**
   * A $transaction stub that actually INVOKES Prisma's callback with a fake
   * transaction client, the way the real client does.
   *
   * cubic P2 (confidence 9) was right that the previous stubs ignored the callback
   * entirely: the "successful retry" never ran the RLS set_config or the caller's
   * callback, and the P2002 case never exercised a write. A stub that skips the
   * callback would stay green even if db.ts stopped setting the RLS org id.
   */
  type FakeTx = { $executeRaw: ReturnType<typeof vi.fn> }

  /**
   * `onAcquire` models what the REAL client does before running the callback:
   * if it throws, the transaction never started (the retryable case). If it
   * resolves, the callback IS invoked with the fake tx — so in-callback failures
   * (a real write error) are a separate, non-retryable path.
   */
  function stubTransaction(onAcquire?: (callIndex: number, tx: FakeTx) => Promise<void> | void) {
    const client = constructedClient()
    const txns: FakeTx[] = []
    client.$transaction.mockImplementation(
      async (
        callback: (tx: FakeTx) => Promise<unknown>,
        _options?: unknown,
      ) => {
        const tx: FakeTx = { $executeRaw: vi.fn() }
        const callIndex = txns.length
        txns.push(tx)
        if (onAcquire) await onAcquire(callIndex, tx)
        return callback(tx)
      },
    )
    return { client, txns }
  }

  it('retries on acquisition failure and runs the RLS setup + caller callback exactly once', async () => {
    const { withOrgRlsTransaction } = await loadDbModule()

    const { txns } = stubTransaction(callIndex => {
      if (callIndex === 0) {
        // Acquisition failure: the transaction never started, so nothing ran.
        throw Object.assign(
          new Error('Transaction API error: Unable to start a transaction in the given time.'),
          { code: 'P2028' },
        )
      }
      // Successful acquisition: db.ts sets the RLS org id inside the callback.
    })

    let callbackRuns = 0
    const result = await withOrgRlsTransaction('org_1', async () => {
      callbackRuns++
      return 'recovered'
    })

    expect(result).toBe('recovered')
    expect(txns).toHaveLength(2) // two acquisition attempts
    // The caller callback must run exactly ONCE — the first attempt threw before
    // the callback was reached, so a retry cannot double-apply it.
    expect(callbackRuns).toBe(1)
    // And the RLS org id must actually be set on the successful transaction.
    // db.ts runs set_config('app.current_organization_id', ...) as the first
    // statement inside the callback, so the failed attempt's tx never sees it.
    expect(txns[1].$executeRaw).toHaveBeenCalledTimes(1)
    expect(txns[0].$executeRaw).not.toHaveBeenCalled()
  })

  it('does NOT retry a mid-transaction error, so a write can never be duplicated', async () => {
    const { withOrgRlsTransaction } = await loadDbModule()

    // Acquisition succeeds; the P2002 comes from the CALLER's callback — i.e. a
    // real write already ran. This is exactly the case where retrying would
    // duplicate the write, so it must propagate with no second attempt.
    const { txns } = stubTransaction()

    let callbackRuns = 0
    await expect(
      withOrgRlsTransaction('org_1', async () => {
        callbackRuns++
        throw Object.assign(new Error('unique constraint'), { code: 'P2002' })
      }),
    ).rejects.toThrow('unique constraint')

    expect(txns).toHaveLength(1) // no retry
    expect(callbackRuns).toBe(1) // ran once, never repeated
  })

  it('does NOT retry a P2028 that is a mid-run timeout rather than an acquisition failure', async () => {
    const { withOrgRlsTransaction } = await loadDbModule()

    // Same code, different wording: the transaction DID start, ran work, then
    // expired. Retrying would repeat that work, so it must not be retried.
    const { txns } = stubTransaction()

    let callbackRuns = 0
    await expect(
      withOrgRlsTransaction('org_1', async () => {
        callbackRuns++
        throw Object.assign(
          new Error('Transaction already closed: A query cannot be executed on an expired transaction'),
          { code: 'P2028' },
        )
      }),
    ).rejects.toThrow('Transaction already closed')

    expect(txns).toHaveLength(1)
    expect(callbackRuns).toBe(1)
  })

  it('raises maxWait above Prisma 2s default (production transactions measured 3.7-7.1s)', async () => {
    await loadDbModule()
    const client = constructedClient()
    stubTransaction()
    const mod2 = await import('@/lib/db')
    await mod2.withOrgRlsTransaction('org_1', async () => 'ok')

    const options = client.$transaction.mock.calls[0][1] as { maxWait?: number; timeout?: number }
    expect(options.maxWait).toBeGreaterThan(2000)
    expect(options.timeout).toBeGreaterThan(options.maxWait)
  })

  it('rejects a negative DB_TX_TIMEOUT_MS instead of expiring every transaction', async () => {
    // cubic P2 (confidence 8): `Number(raw) || fallback` accepted -1, which would
    // make every RLS transaction expire immediately.
    vi.stubEnv('DB_TX_TIMEOUT_MS', '-1')
    vi.stubEnv('DB_TX_MAX_WAIT_MS', '-5')
    const mod = await loadDbModule()
    const client = constructedClient()
    stubTransaction()
    await mod.withOrgRlsTransaction('org_1', async () => 'ok')

    const options = client.$transaction.mock.calls[0][1] as { maxWait?: number; timeout?: number }
    expect(options.maxWait).toBe(15_000) // fallback, not -5
    expect(options.timeout).toBe(30_000) // fallback, not -1
  })
})
