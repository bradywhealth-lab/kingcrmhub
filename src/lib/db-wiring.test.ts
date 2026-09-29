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

  it('retries withOrgRlsTransaction on P2028 and succeeds on the second attempt', async () => {
    const { withOrgRlsTransaction } = await loadDbModule()
    const client = constructedClient()

    let attempt = 0
    client.$transaction.mockImplementation(async () => {
      attempt++
      if (attempt === 1) throw Object.assign(new Error('Unable to start a transaction in the given time.'), { code: 'P2028' })
      return 'recovered'
    })

    await expect(withOrgRlsTransaction('org_1', async () => 'recovered')).resolves.toBe('recovered')
    expect(attempt).toBe(2)
  })

  it('does NOT retry a non-pool error, so a write can never be duplicated', async () => {
    const { withOrgRlsTransaction } = await loadDbModule()
    const client = constructedClient()

    let attempt = 0
    client.$transaction.mockImplementation(async () => {
      attempt++
      throw Object.assign(new Error('unique constraint'), { code: 'P2002' })
    })

    await expect(withOrgRlsTransaction('org_1', async () => 'x')).rejects.toThrow('unique constraint')
    expect(attempt).toBe(1)
  })
})
