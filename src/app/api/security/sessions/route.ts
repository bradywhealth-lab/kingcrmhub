import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { withRequestOrgContext } from '@/lib/request-context'
import { AUTH_COOKIE_NAME } from '@/lib/auth'
import { hashSessionToken } from '@/lib/auth'
import { enforceRateLimit } from '@/lib/rate-limit'

export async function GET(request: NextRequest) {
  try {
    return withRequestOrgContext(request, async (context) => {
      if (!context.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

      const currentToken = request.cookies.get(AUTH_COOKIE_NAME)?.value?.trim() || null
      const currentTokenHash = currentToken ? hashSessionToken(currentToken) : null

      const sessions = await db.userSession.findMany({
        where: {
          userId: context.userId,
          isActive: true,
          expiresAt: { gt: new Date() },
        },
        orderBy: [
          { lastActiveAt: 'desc' },
          { createdAt: 'desc' },
        ],
        select: {
          id: true,
          createdAt: true,
          expiresAt: true,
          lastActiveAt: true,
          device: true,
          browser: true,
          os: true,
          city: true,
          country: true,
          token: true,
        },
      })

      return NextResponse.json({
        sessions: sessions.map((session) => ({
          id: session.id,
          createdAt: session.createdAt,
          expiresAt: session.expiresAt,
          lastActiveAt: session.lastActiveAt,
          device: session.device,
          browser: session.browser,
          os: session.os,
          city: session.city,
          country: session.country,
          isCurrent: currentTokenHash === session.token,
        })),
      })
    })
  } catch (error) {
    console.error('Sessions GET error:', error)
    return NextResponse.json({ error: 'Failed to load sessions' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const limited = enforceRateLimit(request, { key: 'security-sessions-delete', limit: 30, windowMs: 60_000 })
    if (limited) return limited

    return withRequestOrgContext(request, async (context) => {
      if (!context.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

      const id = request.nextUrl.searchParams.get('id')
      if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

      const target = await db.userSession.findFirst({
        where: {
          id,
          userId: context.userId,
          isActive: true,
        },
        select: {
          id: true,
          userId: true,
        },
      })
      if (!target) return NextResponse.json({ error: 'Session not found' }, { status: 404 })

      await db.userSession.update({
        where: { id },
        data: { isActive: false },
      })

      await db.auditLog.create({
        data: {
          organizationId: context.organizationId,
          action: 'revoke',
          entityType: 'user_session',
          entityId: id,
          actorId: context.userId,
          description: 'Revoked active session',
        },
      })

      return NextResponse.json({ success: true })
    })
  } catch (error) {
    console.error('Sessions DELETE error:', error)
    return NextResponse.json({ error: 'Failed to revoke session' }, { status: 500 })
  }
}
