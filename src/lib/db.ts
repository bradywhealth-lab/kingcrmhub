import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { AsyncLocalStorage } from 'node:async_hooks'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

const rlsTxStorage = new AsyncLocalStorage<PrismaClient>()

function createPrismaClient(): PrismaClient {
  const databaseUrl = process.env.DATABASE_URL?.trim()
  if (!databaseUrl) {
    throw new Error('Missing DATABASE_URL for Prisma PostgreSQL adapter')
  }
  const adapter = new PrismaPg({ connectionString: databaseUrl })
  return new PrismaClient({ adapter, log: ['query'] })
}

function getBaseClient(): PrismaClient {
  if (globalForPrisma.prisma) {
    return globalForPrisma.prisma
  }

  const client = createPrismaClient()
  if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.prisma = client
  }
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
  return getBaseClient().$transaction(async tx => {
    await tx.$executeRaw`SELECT set_config('app.current_organization_id', ${organizationId}, true)`
    return rlsTxStorage.run(tx as PrismaClient, callback)
  })
}

export async function withSessionTokenRlsTransaction<T>(
  sessionToken: string,
  callback: () => Promise<T>,
): Promise<T> {
  return getBaseClient().$transaction(async tx => {
    await tx.$executeRaw`SELECT set_config('app.current_session_token', ${sessionToken}, true)`
    return rlsTxStorage.run(tx as PrismaClient, callback)
  })
}