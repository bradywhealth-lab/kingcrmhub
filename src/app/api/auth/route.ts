import { NextRequest, NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { AUTH_COOKIE_NAME, SESSION_TTL_MS, buildSessionCookieOptions, createSessionToken, ensureUniqueOrganizationSlug, getCurrentSessionFromToken, getCurrentUserFromCookies, hashPassword, hashSessionToken, invalidateSessionToken, readSessionClientDetails, slugifyOrganizationName, verifyPassword } from '@/lib/auth'
import { parseJsonBody } from '@/lib/validation'
import { enforceRateLimit } from '@/lib/rate-limit'
import { enforceSameOrigin } from '@/lib/security'
import { z } from 'zod'

function readUserPreferences(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function serializeAuthUser(user: {
  id: string
  email: string
  name: string | null
  role: string
  organizationId: string
  preferences: unknown
  organization: {
    id: string
    name: string
    slug: string
    plan: string
  }
}) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    organizationId: user.organizationId,
    organization: user.organization,
    preferences: user.preferences,
  }
}

const authSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('signup'),
    name: z.string().min(1).max(120),
    email: z.string().email(),
    password: z.string().min(8).max(200),
    organizationName: z.string().min(1).max(120),
  }),
  z.object({
    action: z.literal('login'),
    email: z.string().email(),
    password: z.string().min(1).max(200),
  }),
  z.object({
    action: z.literal('change-password'),
    currentPassword: z.string().min(1).max(200),
    newPassword: z.string().min(8).max(200),
  }),
  z.object({
    action: z.literal('accept-invite'),
    email: z.string().email(),
    token: z.string().min(16).max(200),
    name: z.string().min(1).max(120).optional(),
    password: z.string().min(8).max(200),
  }),
])

export async function GET() {
  try {
    const current = await getCurrentUserFromCookies()
    if (!current) {
      return NextResponse.json({ authenticated: false }, { status: 401 })
    }

    return NextResponse.json({
      authenticated: true,
      user: current.user,
      mustChangePassword: readUserPreferences(current.user.preferences).requirePasswordChange === true,
      session: {
        id: current.sessionId,
        expiresAt: current.expiresAt,
      },
    })
  } catch (error) {
    console.error('Auth GET error:', error)
    return NextResponse.json({ error: 'Failed to load auth session' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const csrfBlocked = enforceSameOrigin(request)
    if (csrfBlocked) return csrfBlocked

    const parsed = await parseJsonBody(request, authSchema)
    if (!parsed.success) return parsed.response
    const data = parsed.data
    const sessionClient = readSessionClientDetails(request)

    const rateLimitKey =
      data.action === 'login'
        ? `auth-login:${data.email.toLowerCase()}`
        : data.action === 'signup'
          ? `auth-signup:${data.email.toLowerCase()}`
          : 'auth-change-password'

    const limited = enforceRateLimit(request, {
      key: rateLimitKey,
      limit: data.action === 'login' ? 10 : data.action === 'signup' ? 5 : 10,
      windowMs: 15 * 60_000,
    })
    if (limited) return limited

    if (data.action === 'signup') {
      const existing = await db.user.findUnique({
        where: { email: data.email.toLowerCase() },
        select: { id: true },
      })
      if (existing) {
        return NextResponse.json({ error: 'An account with that email already exists.' }, { status: 409 })
      }

      const slug = await ensureUniqueOrganizationSlug(slugifyOrganizationName(data.organizationName))
      const passwordHash = hashPassword(data.password)

      const result = await db.$transaction(async (tx) => {
        const organization = await tx.organization.create({
          data: {
            name: data.organizationName.trim(),
            slug,
            plan: 'pro',
          },
        })

        const user = await tx.user.create({
          data: {
            email: data.email.toLowerCase(),
            passwordHash,
            name: data.name.trim(),
            role: 'owner',
            organizationId: organization.id,
          },
          include: {
            organization: {
              select: { id: true, name: true, slug: true, plan: true },
            },
          },
        })

        await tx.teamMember.create({
          data: {
            organizationId: organization.id,
            userId: user.id,
            role: 'owner',
            isActive: true,
          },
        })

        const token = createSessionToken()
        const expiresAt = new Date(Date.now() + SESSION_TTL_MS)
        await tx.userSession.create({
          data: {
            userId: user.id,
            token: hashSessionToken(token),
            isActive: true,
            expiresAt,
            lastActiveAt: new Date(),
            device: sessionClient.device,
            browser: sessionClient.browser,
            os: sessionClient.os,
            ip: sessionClient.ip,
          },
        })

        await tx.auditLog.create({
          data: {
            organizationId: organization.id,
            action: 'create',
            entityType: 'user',
            entityId: user.id,
            actorId: user.id,
            actorEmail: user.email,
            description: 'Created owner account and initialized workspace',
            metadata: {
              organizationSlug: organization.slug,
              plan: organization.plan,
            },
          },
        })

        return { user, token, expiresAt }
      })

      const response = NextResponse.json({
        authenticated: true,
        user: serializeAuthUser(result.user),
        mustChangePassword: false,
      })
      response.cookies.set(AUTH_COOKIE_NAME, result.token, buildSessionCookieOptions(result.expiresAt))
      return response
    }

    if (data.action === 'change-password') {
      const token = request.cookies.get(AUTH_COOKIE_NAME)?.value?.trim()
      if (!token) {
        return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
      }

      const current = await getCurrentSessionFromToken(token)
      const session = current
        ? await db.userSession.findFirst({
            where: { id: current.sessionId },
            include: { user: true },
          })
        : null

      if (!session?.user || !verifyPassword(data.currentPassword, session.user.passwordHash)) {
        return NextResponse.json({ error: 'Current password is incorrect.' }, { status: 401 })
      }

      const currentPreferences = readUserPreferences(session.user.preferences)
      delete currentPreferences.requirePasswordChange

      const nextToken = createSessionToken()
      const nextExpiresAt = new Date(Date.now() + SESSION_TTL_MS)

      await db.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: session.user.id },
          data: {
            passwordHash: hashPassword(data.newPassword),
            preferences: currentPreferences as Prisma.InputJsonValue,
          },
        })

        await tx.userSession.updateMany({
          where: { userId: session.user.id, isActive: true },
          data: { isActive: false },
        })

        await tx.userSession.create({
          data: {
            userId: session.user.id,
            token: hashSessionToken(nextToken),
            isActive: true,
            expiresAt: nextExpiresAt,
            lastActiveAt: new Date(),
            device: sessionClient.device,
            browser: sessionClient.browser,
            os: sessionClient.os,
            ip: sessionClient.ip,
          },
        })

        await tx.auditLog.create({
          data: {
            organizationId: session.user.organizationId,
            action: 'update',
            entityType: 'user',
            entityId: session.user.id,
            actorId: session.user.id,
            actorEmail: session.user.email,
            description: 'Updated account password and rotated active sessions',
          },
        })
      })

      const response = NextResponse.json({ success: true, mustChangePassword: false })
      response.cookies.set(AUTH_COOKIE_NAME, nextToken, buildSessionCookieOptions(nextExpiresAt))
      return response
    }

    if (data.action === 'accept-invite') {
      const user = await db.user.findUnique({
        where: { email: data.email.toLowerCase() },
        include: {
          organization: {
            select: { id: true, name: true, slug: true, plan: true },
          },
        },
      })
      if (!user) {
        return NextResponse.json({ error: 'Invitation not found.' }, { status: 404 })
      }

      const preferences = readUserPreferences(user.preferences)
      const inviteTokenHash = typeof preferences.inviteTokenHash === 'string' ? preferences.inviteTokenHash : null
      const inviteTokenExpiresAt = typeof preferences.inviteTokenExpiresAt === 'string' ? preferences.inviteTokenExpiresAt : null
      if (
        !inviteTokenHash ||
        inviteTokenHash !== hashSessionToken(data.token) ||
        !inviteTokenExpiresAt ||
        Number.isNaN(Date.parse(inviteTokenExpiresAt)) ||
        new Date(inviteTokenExpiresAt) <= new Date()
      ) {
        return NextResponse.json({ error: 'Invitation is invalid or expired.' }, { status: 401 })
      }

      delete preferences.inviteTokenHash
      delete preferences.inviteTokenExpiresAt
      delete preferences.requirePasswordChange
      preferences.invitedAcceptedAt = new Date().toISOString()

      const token = createSessionToken()
      const expiresAt = new Date(Date.now() + SESSION_TTL_MS)

      const result = await db.$transaction(async (tx) => {
        const updatedUser = await tx.user.update({
          where: { id: user.id },
          data: {
            name: data.name?.trim() || user.name,
            passwordHash: hashPassword(data.password),
            preferences: preferences as Prisma.InputJsonValue,
          },
          include: {
            organization: {
              select: { id: true, name: true, slug: true, plan: true },
            },
          },
        })

        await tx.userSession.updateMany({
          where: { userId: user.id, isActive: true },
          data: { isActive: false },
        })

        await tx.userSession.create({
          data: {
            userId: user.id,
            token: hashSessionToken(token),
            isActive: true,
            expiresAt,
            lastActiveAt: new Date(),
            device: sessionClient.device,
            browser: sessionClient.browser,
            os: sessionClient.os,
            ip: sessionClient.ip,
          },
        })

        await tx.auditLog.create({
          data: {
            organizationId: user.organizationId,
            action: 'accept_invite',
            entityType: 'user',
            entityId: user.id,
            actorId: user.id,
            actorEmail: user.email,
            description: 'Accepted workspace invitation and activated account',
          },
        })

        return updatedUser
      })

      const response = NextResponse.json({
        authenticated: true,
        user: serializeAuthUser(result),
        mustChangePassword: false,
      })
      response.cookies.set(AUTH_COOKIE_NAME, token, buildSessionCookieOptions(expiresAt))
      return response
    }

    const user = await db.user.findUnique({
      where: { email: data.email.toLowerCase() },
      include: {
        organization: {
          select: { id: true, name: true, slug: true, plan: true },
        },
      },
    })

    if (!user || !verifyPassword(data.password, user.passwordHash)) {
      return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 })
    }

    const token = createSessionToken()
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS)
    await db.userSession.create({
      data: {
        userId: user.id,
        token: hashSessionToken(token),
        isActive: true,
        expiresAt,
        lastActiveAt: new Date(),
        device: sessionClient.device,
        browser: sessionClient.browser,
        os: sessionClient.os,
        ip: sessionClient.ip,
      },
    })

    await db.auditLog.create({
      data: {
        organizationId: user.organizationId,
        action: 'login',
        entityType: 'user_session',
        entityId: user.id,
        actorId: user.id,
        actorEmail: user.email,
        description: 'Signed in to the workspace',
      },
    })

    const response = NextResponse.json({
      authenticated: true,
      user: serializeAuthUser(user),
      mustChangePassword: readUserPreferences(user.preferences).requirePasswordChange === true,
    })
    response.cookies.set(AUTH_COOKIE_NAME, token, buildSessionCookieOptions(expiresAt))
    return response
  } catch (error) {
    console.error('Auth POST error:', error)
    return NextResponse.json({ error: 'Failed to complete auth request' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const csrfBlocked = enforceSameOrigin(request)
    if (csrfBlocked) return csrfBlocked

    const token = request.cookies.get(AUTH_COOKIE_NAME)?.value
    if (token) {
      const tokenHash = hashSessionToken(token)
      const session = await db.userSession.findFirst({
        where: {
          token: tokenHash,
          isActive: true,
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              organizationId: true,
            },
          },
        },
      })

      await invalidateSessionToken(token)

      if (session?.user) {
        await db.auditLog.create({
          data: {
            organizationId: session.user.organizationId,
            action: 'logout',
            entityType: 'user_session',
            entityId: session.id,
            actorId: session.user.id,
            actorEmail: session.user.email,
            description: 'Signed out of the workspace',
          },
        })
      }
    }

    const response = NextResponse.json({ success: true })
    response.cookies.set(AUTH_COOKIE_NAME, '', buildSessionCookieOptions(new Date(0)))
    return response
  } catch (error) {
    console.error('Auth DELETE error:', error)
    return NextResponse.json({ error: 'Failed to sign out' }, { status: 500 })
  }
}
