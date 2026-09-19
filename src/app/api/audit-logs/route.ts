import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { withRequestOrgContext } from '@/lib/request-context'

export async function GET(request: NextRequest) {
  try {
    return await withRequestOrgContext(request, async (context) => {
      const limit = Math.max(1, Math.min(100, Number(request.nextUrl.searchParams.get('limit') || '25')))
      const logs = await db.auditLog.findMany({
        where: { organizationId: context.organizationId },
        orderBy: { createdAt: 'desc' },
        take: limit,
      })
      return NextResponse.json({ logs })
    })
  } catch (error) {
    console.error('Audit logs GET error:', error)
    return NextResponse.json({ error: 'Failed to load audit logs' }, { status: 500 })
  }
}
