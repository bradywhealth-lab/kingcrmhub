import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  const databaseUrl = process.env.DATABASE_URL?.trim()
  if (!databaseUrl) {
    return NextResponse.json({
      ok: true,
      ready: true,
      database: 'skipped_no_database_url',
      timestamp: new Date().toISOString(),
    })
  }

  try {
    await db.$queryRaw`SELECT 1`
    return NextResponse.json({
      ok: true,
      ready: true,
      database: 'ok',
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown readiness error'
    return NextResponse.json(
      {
        ok: false,
        ready: false,
        database: 'error',
        error: message,
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    )
  }
}
