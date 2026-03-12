import { NextRequest } from 'next/server'
import { db } from '@/lib/db'

type OrgContext = {
  organizationId: string
  userId: string | null
}

function readSessionTokenFromRequest(request: NextRequest): string | null {
  const headerToken = request.headers.get('x-session-token') || request.headers.get('authorization')
  if (headerToken?.startsWith('Bearer ')) return headerToken.slice('Bearer '.length).trim()
  if (headerToken) return headerToken.trim()

  const cookieToken =
    request.cookies.get('session-token')?.value ||
    request.cookies.get('user-session-token')?.value ||
    request.cookies.get('auth-token')?.value

  return cookieToken?.trim() || null
}

export async function getOrgContext(request: NextRequest): Promise<OrgContext | null> {
  const orgHeader = request.headers.get('x-organization-id')?.trim()
  if (orgHeader) {
    const existing = await db.organization.findUnique({ where: { id: orgHeader }, select: { id: true } })
    if (existing) return { organizationId: existing.id, userId: null }
  }

  const userIdHeader = request.headers.get('x-user-id')?.trim()
  if (userIdHeader) {
    const user = await db.user.findUnique({
      where: { id: userIdHeader },
      select: { id: true, organizationId: true },
    })
    if (user) return { organizationId: user.organizationId, userId: user.id }
  }

  const userEmailHeader = request.headers.get('x-user-email')?.trim().toLowerCase()
  if (userEmailHeader) {
    const user = await db.user.findUnique({
      where: { email: userEmailHeader },
      select: { id: true, organizationId: true },
    })
    if (user) return { organizationId: user.organizationId, userId: user.id }
  }

  const token = readSessionTokenFromRequest(request)
  if (token) {
    const session = await db.userSession.findFirst({
      where: {
        token,
        isActive: true,
        expiresAt: { gt: new Date() },
      },
      select: {
        user: { select: { id: true, organizationId: true } },
      },
    })
    if (session?.user) {
      return { organizationId: session.user.organizationId, userId: session.user.id }
    }
  }

  // Development-only fallback to keep local workflows usable before auth rollout.
  if (process.env.NODE_ENV !== 'production') {
    const fallbackOrgId = process.env.DEV_DEFAULT_ORG_ID?.trim()
    if (fallbackOrgId) {
      const existing = await db.organization.findUnique({
        where: { id: fallbackOrgId },
        select: { id: true },
      })
      if (existing) return { organizationId: existing.id, userId: null }
    }

    const firstOrg = await db.organization.findFirst({
      select: { id: true },
      orderBy: { createdAt: 'asc' },
    })
    if (firstOrg) return { organizationId: firstOrg.id, userId: null }
  }

  return null
}
