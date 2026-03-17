import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { randomBytes, createHash } from 'node:crypto'

function hashPassword(password: string, salt: string): string {
  return createHash('sha256').update(password + salt).digest('hex')
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
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      })

      const response = NextResponse.json({
        user: { id: user.id, email: user.email, name: user.name, role: user.role, organizationId: org.id },
        organization: { id: org.id, name: org.name, slug: org.slug },
      })
      response.cookies.set('session-token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 30 * 24 * 60 * 60,
        path: '/',
      })
      return response
    }

    if (action === 'signin') {
      const { email, password } = body
      if (!email?.trim() || !password) {
        return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
      }

      const normalizedEmail = email.trim().toLowerCase()
      const user = await db.user.findFirst({
        where: { email: normalizedEmail },
        include: { organization: true },
      })
      if (!user) {
        return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
      }

      const prefs = (user.preferences || {}) as Record<string, string>
      const storedHash = prefs.passwordHash
      const salt = prefs.salt
      if (!storedHash || !salt) {
        return NextResponse.json({ error: 'Account not set up for password login' }, { status: 401 })
      }

      const attemptHash = hashPassword(password, salt)
      if (attemptHash !== storedHash) {
        return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
      }

      const token = generateToken()
      await db.userSession.create({
        data: {
          userId: user.id,
          token,
          isActive: true,
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      })

      const response = NextResponse.json({
        user: { id: user.id, email: user.email, name: user.name, role: user.role, organizationId: user.organizationId },
        organization: user.organization ? { id: user.organization.id, name: user.organization.name, slug: user.organization.slug } : null,
      })
      response.cookies.set('session-token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 30 * 24 * 60 * 60,
        path: '/',
      })
      return response
    }

    if (action === 'signout') {
      const token = request.cookies.get('session-token')?.value
      if (token) {
        await db.userSession.updateMany({ where: { token }, data: { isActive: false } })
      }
      const response = NextResponse.json({ success: true })
      response.cookies.set('session-token', '', { maxAge: 0, path: '/' })
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
  } catch (error) {
    console.error('Auth GET error:', error)
    return NextResponse.json({ user: null })
  }
}
