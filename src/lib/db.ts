import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import {
  isPoolExhaustionError,
  resolvePgPoolConfig,
  resolvePrismaLogConfig,
  withPoolRetry,
} from '@/lib/db-config'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'
import { AsyncLocalStorage } from 'node:async_hooks'
import { existsSync } from 'node:fs'
import path from 'node:path'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

const rlsTxStorage = new AsyncLocalStorage<PrismaClient>()
let usingLocalSqlite = false

/**
 * Prisma's default $transaction maxWait is 2s. Production transactions were
 * measured at 3.7-7.1s when the dashboard fires ~8 parallel requests, so every
 * waiter past 2s died with P2028 -> HTTP 500 (54 occurrences in 3h).
 */
const TRANSACTION_MAX_WAIT_MS = Number(process.env.DB_TX_MAX_WAIT_MS) || 15_000
const TRANSACTION_TIMEOUT_MS = Number(process.env.DB_TX_TIMEOUT_MS) || 30_000

// Re-exported for route-level use where a caller wants the same classification.
export { isPoolExhaustionError, withPoolRetry }

function buildPostgresConnectionString(databaseUrl: string): string {
  try {
    const url = new URL(databaseUrl)
    const hostname = url.hostname.toLowerCase()
    const isSupabaseHost =
      hostname.endsWith('.supabase.com') ||
      hostname.endsWith('.supabase.co') ||
      hostname === 'supabase.com' ||
      hostname === 'supabase.co'
    const isSupabasePoolerHost =
      hostname === 'pooler.supabase.com' ||
      hostname === 'pooler.supabase.co' ||
      hostname.endsWith('.pooler.supabase.com') ||
      hostname.endsWith('.pooler.supabase.co')

    const shouldRelaxTls =
      isSupabasePoolerHost ||
      (process.env.NODE_ENV !== 'production' && isSupabaseHost)

    if (shouldRelaxTls) {
      url.searchParams.set('sslmode', 'no-verify')
      url.searchParams.delete('sslcert')
      url.searchParams.delete('sslkey')
      url.searchParams.delete('sslrootcert')
    }

    return url.toString()
  } catch {
    return databaseUrl
  }
}

function createPrismaClient(): PrismaClient {
  const databaseUrl = process.env.DATABASE_URL?.trim()
  const localSqlitePath = path.join(process.cwd(), 'prisma', 'dev.db')
  const shouldUseLocalSqlite =
    process.env.NODE_ENV !== 'production' &&
    !databaseUrl &&
    existsSync(localSqlitePath)

  if (shouldUseLocalSqlite) {
    usingLocalSqlite = true
    const adapter = new PrismaBetterSqlite3({ url: `file:${localSqlitePath}` })
    return new PrismaClient({ adapter, log: resolvePrismaLogConfig() })
  }

  if (!databaseUrl) {
    throw new Error('Missing DATABASE_URL for Prisma adapter')
  }
  usingLocalSqlite = false

  // Pool size must be set as an explicit option object: `max` CANNOT be passed
  // through the connection string (measured against the installed pg — it ignores
  // both ?max= and ?connection_limit=; see the db-config.ts header for the proof).
  // PrismaPg accepts a pg.PoolConfig, so no direct `pg` dependency is needed.
  // Defaults preserve prior behaviour (max 10).
  const poolConfig = resolvePgPoolConfig()
  const adapter = new PrismaPg(
    {
      connectionString: buildPostgresConnectionString(databaseUrl),
      max: poolConfig.max,
      idleTimeoutMillis: poolConfig.idleTimeoutMillis,
      connectionTimeoutMillis: poolConfig.connectionTimeoutMillis,
    },
    {
      // An idle client erroring would otherwise crash the process.
      onPoolError: err => console.error('[db] pg pool error:', err),
    },
  )
  return new PrismaClient({ adapter, log: resolvePrismaLogConfig() })
}

function getBaseClient(): PrismaClient {
  if (globalForPrisma.prisma) {
    return globalForPrisma.prisma
  }

  const client = createPrismaClient()
  globalForPrisma.prisma = client
  return client
}

export const db = new Proxy({} as PrismaClient, {
  get(target, prop, receiver) {
    const scopedClient = rlsTxStorage.getStore() ?? getBaseClient()
    const value = Reflect.get(scopedClient as object, prop, receiver)
    if (typeof value === 'function') {
      return value.bind(scopedClient)
    }
    return value
  },
}) as PrismaClient

export async function withOrgRlsTransaction<T>(
  organizationId: string,
  callback: () => Promise<T>,
): Promise<T> {
  if (usingLocalSqlite) {
    return callback()
  }
  // Retried at the ACQUISITION boundary only: P2028 means the transaction never
  // started, so no statement ran and a retry cannot duplicate a write. maxWait is
  // raised because production transactions were measured at 3.7-7.1s under load
  // while Prisma's default maxWait is 2s.
  return withPoolRetry(() =>
    getBaseClient().$transaction(
      async tx => {
        await tx.$executeRaw`SELECT set_config('app.current_organization_id', ${organizationId}, true)`
        return rlsTxStorage.run(tx as PrismaClient, callback)
      },
      { maxWait: TRANSACTION_MAX_WAIT_MS, timeout: TRANSACTION_TIMEOUT_MS },
    ),
  )
}

export async function withSessionTokenRlsTransaction<T>(
  sessionToken: string,
  callback: () => Promise<T>,
): Promise<T> {
  if (usingLocalSqlite) {
    return callback()
  }
  return withPoolRetry(() =>
    getBaseClient().$transaction(
      async tx => {
        await tx.$executeRaw`SELECT set_config('app.current_session_token', ${sessionToken}, true)`
        return rlsTxStorage.run(tx as PrismaClient, callback)
      },
      { maxWait: TRANSACTION_MAX_WAIT_MS, timeout: TRANSACTION_TIMEOUT_MS },
    ),
  )
}
