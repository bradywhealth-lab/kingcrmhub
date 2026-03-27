import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import type { Prisma } from '@prisma/client'
import { decode as decodeJwt } from 'next-auth/jwt'
import { NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import { db } from '@/lib/db'

// Moved here from security.ts to keep node:crypto out of the Edge middleware bundle
export function hashSessionToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

const AUTH_COOKIE_NAME = 'session-token'
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30

type SessionLookup = {
  id: string
  token: string
  expiresAt: Date
  lastActiveAt: Date
  user: {
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
      settings?: unknown
    }
  }
}

type SerializableAuthUser = {
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
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex')
  const derived = scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${derived}`
}

export function verifyPassword(password: string, passwordHash: string | null | undefined): boolean {
  if (!passwordHash) return false
  const [salt, stored] = passwordHash.split(':')
  if (!salt || !stored) return false
  const derived = scryptSync(password, salt, 64)
  const storedBuffer = Buffer.from(stored, 'hex')
  if (derived.length !== storedBuffer.length) return false
  return timingSafeEqual(derived, storedBuffer)
}

export function createSessionToken(): string {
  return randomBytes(32).toString('hex')
}

export function serializeAuthUser(user: SerializableAuthUser) {
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

function readJsonObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

export function readUserPreferences(value: unknown): Record<string, unknown> {
  return readJsonObject(value)
}

function readSessionTimeoutMinutes(settings: unknown): number {
  const raw = readJsonObject(settings).sessionTimeoutMinutes
  return typeof raw === 'number' && Number.isFinite(raw) ? Math.min(1440, Math.max(5, raw)) : 60
}

function isInactiveSessionExpired(session: SessionLookup): boolean {
  const timeoutMinutes = readSessionTimeoutMinutes(session.user.organization?.settings)
  const lastSeenAt =
    session.lastActiveAt instanceof Date
      ? session.lastActiveAt
      : session.expiresAt instanceof Date
        ? session.expiresAt
        : new Date()
  return lastSeenAt.getTime() + timeoutMinutes * 60_000 <= Date.now()
}

async function touchSessionActivity(sessionId: string, lastActiveAt: Date) {
  const lastSeenAt = lastActiveAt instanceof Date ? lastActiveAt : new Date(0)
  if (Date.now() - lastSeenAt.getTime() < 60_000) return
  if (typeof db.userSession.update !== 'function') return
  await db.userSession.update({
    where: { id: sessionId },
    data: { lastActiveAt: new Date() },
  })
}

export function readIpAddress(request: NextRequest): string | null {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  if (forwarded) return forwarded
  const realIp = request.headers.get('x-real-ip')?.trim()
  return realIp || null
}

export function readSessionClientDetails(request: NextRequest) {
  const userAgent = request.headers.get('user-agent')?.trim() || ''
  const browser =
    /edg\//i.test(userAgent) ? 'Edge'
      : /chrome\//i.test(userAgent) ? 'Chrome'
        : /safari\//i.test(userAgent) && !/chrome\//i.test(userAgent) ? 'Safari'
          : /firefox\//i.test(userAgent) ? 'Firefox'
            : null
  const os =
    /iphone|ipad|ios/i.test(userAgent) ? 'iOS'
      : /android/i.test(userAgent) ? 'Android'
        : /macintosh|mac os x/i.test(userAgent) ? 'macOS'
          : /windows/i.test(userAgent) ? 'Windows'
            : /linux/i.test(userAgent) ? 'Linux'
              : null
  const device = /mobile/i.test(userAgent) ? 'Mobile device' : os ? `${os} device` : null

  return {
    device,
    browser,
    os,
    ip: readIpAddress(request),
  }
}

export async function getCurrentSessionFromToken(token: string) {
  let lookupToken = token

  const authSecret = process.env.NEXTAUTH_SECRET?.trim()
  if (authSecret) {
    const decoded = await decodeJwt({
      token,
      secret: authSecret,
    }).catch(() => null)
    if (decoded && typeof decoded.sessionToken === 'string' && decoded.sessionToken.length > 0) {
      lookupToken = decoded.sessionToken
    }
  }

  const tokenHash = hashSessionToken(lookupToken)

  const session = await db.userSession.findFirst({
    where: {
      token: tokenHash,
      isActive: true,
      expiresAt: { gt: new Date() },
    },
    select: {
      id: true,
      token: true,
      expiresAt: true,
      lastActiveAt: true,
      user: {
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          organizationId: true,
          preferences: true,
          organization: {
            select: {
              id: true,
              name: true,
              slug: true,
              plan: true,
              settings: true,
            },
          },
        },
      },
    },
  })

  if (!session) return null

  if (isInactiveSessionExpired(session)) {
    await db.userSession.update({
      where: { id: session.id },
      data: { isActive: false },
    })
    return null
  }

  await touchSessionActivity(session.id, session.lastActiveAt)

  return {
    sessionId: session.id,
    sessionToken: lookupToken,
    sessionTokenHash: session.token,
    expiresAt: session.expiresAt,
    user: session.user,
  }
}

export function slugifyOrganizationName(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50) || `org-${randomBytes(4).toString('hex')}`
}

export async function ensureUniqueOrganizationSlug(baseSlug: string) {
  let candidate = baseSlug
  let counter = 1

  while (await db.organization.findUnique({ where: { slug: candidate }, select: { id: true } })) {
    counter += 1
    candidate = `${baseSlug}-${counter}`
  }

  return candidate
}

export async function getCurrentUserFromCookies() {
  const cookieStore = await cookies()
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value?.trim()
  if (!token) return null
  return getCurrentSessionFromToken(token)
}

export async function invalidateSessionToken(token: string) {
  const tokenHash = hashSessionToken(token)
  await db.userSession.updateMany({
    where: { token: tokenHash },
    data: { isActive: false },
  })
}

export async function invalidateUserSessions(userId: string) {
  await db.userSession.updateMany({
    where: { userId, isActive: true },
    data: { isActive: false },
  })
}

export async function createUserSession(
  userId: string,
  sessionToken: string,
  request?: NextRequest,
  overrides?: Partial<Pick<Prisma.UserSessionUncheckedCreateInput, 'expiresAt'>>,
) {
  const sessionClient = request ? readSessionClientDetails(request) : null
  const expiresAt = overrides?.expiresAt ?? new Date(Date.now() + SESSION_TTL_MS)

  return db.userSession.create({
    data: {
      userId,
      token: hashSessionToken(sessionToken),
      isActive: true,
      expiresAt,
      lastActiveAt: new Date(),
      device: sessionClient?.device,
      browser: sessionClient?.browser,
      os: sessionClient?.os,
      ip: sessionClient?.ip,
    },
  })
}

export { AUTH_COOKIE_NAME, SESSION_TTL_MS }
