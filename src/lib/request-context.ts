import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'node:crypto'
import { db, withOrgRlsTransaction, withSessionTokenRlsTransaction } from '@/lib/db'
import { getCurrentSessionFromToken } from '@/lib/auth'
import { enforceSameOrigin, isUnsafeMethod } from '@/lib/security'

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

function isTrustedInternalRunnerRequest(request: NextRequest): boolean {
  const requiredKey = process.env.INTERNAL_RUNNER_KEY?.trim()
  if (!requiredKey) return false

  const providedKey = request.headers.get('x-internal-runner-key')?.trim()
  if (!providedKey) return false

  const requiredBuffer = Buffer.from(requiredKey)
  const providedBuffer = Buffer.from(providedKey)
  if (requiredBuffer.length !== providedBuffer.length) return false
  return timingSafeEqual(requiredBuffer, providedBuffer)
}

export async function getOrgContext(request: NextRequest): Promise<OrgContext | null> {
  const token = readSessionTokenFromRequest(request)
  if (token) {
    const session = await withSessionTokenRlsTransaction(token, async () => getCurrentSessionFromToken(token))
    if (session?.user) {
      return { organizationId: session.user.organizationId, userId: session.user.id }
    }
  }

  if (isTrustedInternalRunnerRequest(request)) {
    const orgHeader = request.headers.get('x-organization-id')?.trim()
    if (orgHeader) {
      const existing = await withOrgRlsTransaction(orgHeader, async () =>
        db.organization.findUnique({
          where: { id: orgHeader },
          select: { id: true },
        }),
      )
      if (existing) return { organizationId: existing.id, userId: null }
    }
  }

  // Development-only fallback to keep local workflows usable before auth rollout.
  if (process.env.NODE_ENV !== 'production') {
    const allowBypass = process.env.ALLOW_DEV_AUTH_BYPASS?.trim() === 'true'
    if (!allowBypass) return null

    const fallbackOrgId = process.env.DEV_DEFAULT_ORG_ID?.trim()
    if (fallbackOrgId) {
      const existing = await withOrgRlsTransaction(fallbackOrgId, async () =>
        db.organization.findUnique({
          where: { id: fallbackOrgId },
          select: { id: true },
        }),
      )
      if (existing) return { organizationId: existing.id, userId: null }
    }
  }

  return null
}

export const getRequestOrgContext = getOrgContext

export async function withRequestOrgContext<T>(
  request: NextRequest,
  handler: (context: OrgContext) => Promise<T>,
): Promise<T | NextResponse> {
  if (isUnsafeMethod(request.method)) {
    const csrfBlocked = enforceSameOrigin(request)
    if (csrfBlocked) return csrfBlocked
  }

  const context = await getOrgContext(request)
  if (!context) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return withOrgRlsTransaction(context.organizationId, () => handler(context))
}
