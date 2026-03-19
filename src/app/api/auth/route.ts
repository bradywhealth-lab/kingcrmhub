import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { randomBytes, pbkdf2Sync, timingSafeEqual } from 'node:crypto'
import { enforceRateLimit } from '@/lib/rate-limit'

const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60
const FAILED_SIGNIN_LOCKOUT_BASE_MS = 15_000
const FAILED_SIGNIN_LOCKOUT_MAX_MS = 5 * 60_000
const failedSigninAttempts = new Map<string, { count: number; lockoutUntil: number }>()

function setSessionCookie(response: NextResponse, token: string, maxAge = SESSION_MAX_AGE_SECONDS) {
  response.cookies.set('session-token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge,
  })
}

function clearSessionCookie(response: NextResponse) {
  response.cookies.set('session-token', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  })
}

function isLockedOut(email: string) {
  const now = Date.now()
  const attempt = failedSigninAttempts.get(email)
  if (!attempt) return null
  if (attempt.lockoutUntil <= now) {
    failedSigninAttempts.delete(email)
    return null
  }
  return Math.ceil((attempt.lockoutUntil - now) / 1000)
}

function recordFailedSignin(email: string) {
  const now = Date.now()
  const existing = failedSigninAttempts.get(email)
  const nextCount = (existing?.count || 0) + 1
  const backoff = Math.min(FAILED_SIGNIN_LOCKOUT_BASE_MS * Math.max(1, nextCount - 2), FAILED_SIGNIN_LOCKOUT_MAX_MS)
  failedSigninAttempts.set(email, {
    count: nextCount,
    lockoutUntil: now + backoff,
  })
}

function resetFailedSignin(email: string) {
  failedSigninAttempts.delete(email)
}

function hashesMatch(attemptHash: string, storedHash: string) {
  if (attemptHash.length !== storedHash.length) return false
  return timingSafeEqual(Buffer.from(attemptHash, 'utf8'), Buffer.from(storedHash, 'utf8'))
}

function hashPassword(password: string, salt: string): string {
  // Derive a password hash using PBKDF2 to make brute-force attacks more expensive.
  // Note: increase the iteration count over time as hardware gets faster.
  const iterations = 100_000
  const keyLength = 32 // 256-bit derived key
  const derivedKey = pbkdf2Sync(password, salt, iterations, keyLength, 'sha256')
  return derivedKey.toString('hex')
}

function generateToken(): string {
  return randomBytes(48).toString('base64url')
}

function generateSalt(): string {
  return randomBytes(16).toString('hex')
}

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'org'
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action } = body

    if (action === 'signup') {
      const limited = enforceRateLimit(request, { key: 'auth-signup', limit: 5, windowMs: 10 * 60_000 })
      if (limited) return limited

      const { email, password, name, orgName } = body
      if (!email?.trim() || !password || password.length < 6) {
        return NextResponse.json({ error: 'Email and password (min 6 chars) are required' }, { status: 400 })
      }

      const normalizedEmail = email.trim().toLowerCase()
      const existing = await db.user.findFirst({ where: { email: normalizedEmail } })
      if (existing) {
        return NextResponse.json({ error: 'An account with this email already exists' }, { status: 409 })
      }

      const salt = generateSalt()
      const passwordHash = hashPassword(password, salt)
      const organizationName = orgName?.trim() || `${(name || email.split('@')[0])}'s Agency`
      const baseSlug = slugify(organizationName)
      const slug = `${baseSlug}-${randomBytes(3).toString('hex')}`

      const org = await db.organization.create({
        data: {
          name: organizationName,
          slug,
          plan: 'free',
        },
      })

      const user = await db.user.create({
        data: {
          email: normalizedEmail,
          name: name?.trim() || null,
          role: 'owner',
          organizationId: org.id,
          preferences: { passwordHash, salt },
        },
      })

      const token = generateToken()
      await db.userSession.create({
        data: {
          userId: user.id,
          token,
          isActive: true,
          expiresAt: new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000),
        },
      })

      const response = NextResponse.json({
        user: { id: user.id, email: user.email, name: user.name, role: user.role, organizationId: org.id },
        organization: { id: org.id, name: org.name, slug: org.slug },
      })
      setSessionCookie(response, token)
      return response
    }

    if (action === 'signin') {
      const limited = enforceRateLimit(request, { key: 'auth-signin', limit: 10, windowMs: 5 * 60_000 })
      if (limited) return limited

      const { email, password } = body
      if (!email?.trim() || !password) {
        return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
      }

      const normalizedEmail = email.trim().toLowerCase()
      const retryAfterSec = isLockedOut(normalizedEmail)
      if (retryAfterSec) {
        return NextResponse.json(
          { error: 'Too many failed sign-in attempts. Please wait and try again.' },
          { status: 429, headers: { 'Retry-After': String(retryAfterSec) } }
        )
      }

      const user = await db.user.findFirst({
        where: { email: normalizedEmail },
        include: { organization: true },
      })
      if (!user) {
        recordFailedSignin(normalizedEmail)
        return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
      }

      const prefs = (user.preferences || {}) as Record<string, string>
      const storedHash = prefs.passwordHash
      const salt = prefs.salt
      if (!storedHash || !salt) {
        recordFailedSignin(normalizedEmail)
        return NextResponse.json({ error: 'Account not set up for password login' }, { status: 401 })
      }

      const attemptHash = hashPassword(password, salt)
      if (!hashesMatch(attemptHash, storedHash)) {
        recordFailedSignin(normalizedEmail)
        return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
      }

      resetFailedSignin(normalizedEmail)

      const token = generateToken()
      await db.userSession.create({
        data: {
          userId: user.id,
          token,
          isActive: true,
          expiresAt: new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000),
        },
      })

      const response = NextResponse.json({
        user: { id: user.id, email: user.email, name: user.name, role: user.role, organizationId: user.organizationId },
        organization: user.organization ? { id: user.organization.id, name: user.organization.name, slug: user.organization.slug } : null,
      })
      setSessionCookie(response, token)
      return response
    }

    if (action === 'signout') {
      const token = request.cookies.get('session-token')?.value
      if (token) {
        await db.userSession.updateMany({ where: { token }, data: { isActive: false } })
      }
      const response = NextResponse.json({ success: true })
      clearSessionCookie(response)
      return response
    }

    if (action === 'me') {
      const token = request.cookies.get('session-token')?.value
      if (!token) return NextResponse.json({ user: null })

      const session = await db.userSession.findFirst({
        where: { token, isActive: true, expiresAt: { gt: new Date() } },
        include: { user: { include: { organization: true } } },
      })
      if (!session?.user) return NextResponse.json({ user: null })

      return NextResponse.json({
        user: { id: session.user.id, email: session.user.email, name: session.user.name, role: session.user.role, organizationId: session.user.organizationId },
        organization: session.user.organization ? { id: session.user.organization.id, name: session.user.organization.name, slug: session.user.organization.slug } : null,
      })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('Auth error:', error)
    return NextResponse.json({ error: 'Authentication failed' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('session-token')?.value
    if (!token) {
      if (process.env.NODE_ENV !== 'production' && process.env.DEV_DEFAULT_ORG_ID) {
        const org = await db.organization.findUnique({
          where: { id: process.env.DEV_DEFAULT_ORG_ID },
        })
        if (org) {
          const devUser = await db.user.findFirst({ where: { organizationId: org.id } })
          return NextResponse.json({
            user: devUser
              ? { id: devUser.id, email: devUser.email, name: devUser.name, role: devUser.role, organizationId: devUser.organizationId }
              : { id: 'dev', email: 'dev@local', name: 'Dev User', role: 'owner', organizationId: org.id },
            organization: { id: org.id, name: org.name, slug: org.slug },
          })
        }
      }
      return NextResponse.json({ user: null })
    }

    const session = await db.userSession.findFirst({
      where: { token, isActive: true, expiresAt: { gt: new Date() } },
      include: { user: { include: { organization: true } } },
    })
    if (!session?.user) return NextResponse.json({ user: null })

    return NextResponse.json({
      user: { id: session.user.id, email: session.user.email, name: session.user.name, role: session.user.role, organizationId: session.user.organizationId },
      organization: session.user.organization ? { id: session.user.organization.id, name: session.user.organization.name, slug: session.user.organization.slug } : null,
    })
  } catch (error) {
    console.error('Auth GET error:', error)
    return NextResponse.json({ user: null })
  }
}
