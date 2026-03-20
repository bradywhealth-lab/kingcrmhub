import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'
import { AsyncLocalStorage } from 'node:async_hooks'
import { existsSync } from 'node:fs'
import path from 'node:path'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

const rlsTxStorage = new AsyncLocalStorage<PrismaClient>()
let usingLocalSqlite = false

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
    return new PrismaClient({ adapter, log: ['query'] })
  }

  if (!databaseUrl) {
    throw new Error('Missing DATABASE_URL for Prisma adapter')
  }
  usingLocalSqlite = false
  const adapter = new PrismaPg({ connectionString: buildPostgresConnectionString(databaseUrl) })
  return new PrismaClient({ adapter, log: ['query'] })
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
  return getBaseClient().$transaction(async tx => {
    await tx.$executeRaw`SELECT set_config('app.current_organization_id', ${organizationId}, true)`
    return rlsTxStorage.run(tx as PrismaClient, callback)
  })
}

export async function withSessionTokenRlsTransaction<T>(
  sessionToken: string,
  callback: () => Promise<T>,
): Promise<T> {
  if (usingLocalSqlite) {
    return callback()
  }
  return getBaseClient().$transaction(async tx => {
    await tx.$executeRaw`SELECT set_config('app.current_session_token', ${sessionToken}, true)`
    return rlsTxStorage.run(tx as PrismaClient, callback)
  })
}
