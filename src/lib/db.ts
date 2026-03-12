import { PrismaClient } from '@prisma/client'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db =
  globalForPrisma.prisma ??
  (() => {
    const databaseUrl = process.env.DATABASE_URL ?? 'file:./prisma/dev.db'
    const sqlitePath = databaseUrl.startsWith('file:') ? databaseUrl.slice(5) : databaseUrl
    const adapter = new PrismaBetterSqlite3({ url: sqlitePath })
    const client = new PrismaClient({ adapter, log: ['query'] })
    if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = client
    return client
  })()