import type { Prisma } from '@prisma/client'
import type { Adapter } from 'next-auth/adapters'
import type { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import type { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { getAuthSecret } from '@/lib/auth-env'
import {
  AUTH_COOKIE_NAME,
  SESSION_TTL_MS,
  hashSessionToken,
  readUserPreferences,
  readSessionClientDetails,
  serializeAuthUser,
  verifyPassword,
} from '@/lib/auth'

function mapUser(user: {
  id: string
  email: string
  name: string | null
  avatar: string | null
  role: string
  organizationId: string
  preferences: Prisma.JsonValue | null
  organization: {
    id: string
    name: string
    slug: string
    plan: string
  }
}) {
  const serialized = serializeAuthUser({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    organizationId: user.organizationId,
    preferences: user.preferences,
    organization: user.organization,
  })

  return {
    ...serialized,
    image: user.avatar,
    emailVerified: null,
  }
}

function createPrismaAuthAdapter(request?: NextRequest): Adapter {
  const sessionClient = request ? readSessionClientDetails(request) : null

  return {
    async createUser() {
      throw new Error('NextAuth createUser is not supported for this credentials-only flow')
    },
    async getUser(id) {
      const user = await db.user.findUnique({
        where: { id },
        include: {
          organization: {
            select: { id: true, name: true, slug: true, plan: true },
          },
        },
      })

      return user ? mapUser(user) : null
    },
    async getUserByEmail(email) {
      const user = await db.user.findUnique({
        where: { email },
        include: {
          organization: {
            select: { id: true, name: true, slug: true, plan: true },
          },
        },
      })

      return user ? mapUser(user) : null
    },
    async getUserByAccount() {
      return null
    },
    async updateUser(user) {
      const updated = await db.user.update({
        where: { id: user.id },
        data: {
          email: user.email,
          name: user.name,
          avatar: user.image,
        },
        include: {
          organization: {
            select: { id: true, name: true, slug: true, plan: true },
          },
        },
      })

      return mapUser(updated)
    },
    async deleteUser(id) {
      await db.user.delete({ where: { id } })
    },
    async linkAccount() {
      throw new Error('OAuth account linking is not supported for this credentials-only flow')
    },
    async unlinkAccount() {
      return undefined
    },
    async createSession(session) {
      const created = await db.userSession.create({
        data: {
          userId: session.userId,
          token: hashSessionToken(session.sessionToken),
          isActive: true,
          expiresAt: session.expires,
          lastActiveAt: new Date(),
          device: sessionClient?.device,
          browser: sessionClient?.browser,
          os: sessionClient?.os,
          ip: sessionClient?.ip,
        },
      })

      const user = await db.user.findUnique({
        where: { id: session.userId },
        select: { id: true, email: true, organizationId: true },
      })

      if (user) {
        await db.auditLog.create({
          data: {
            organizationId: user.organizationId,
            action: 'login',
            entityType: 'user_session',
            entityId: created.id,
            actorId: user.id,
            actorEmail: user.email,
            description: 'Signed in to the workspace',
          },
        })
      }

      return session
    },
    async getSessionAndUser(sessionToken) {
      const session = await db.userSession.findFirst({
        where: {
          token: hashSessionToken(sessionToken),
          isActive: true,
          expiresAt: { gt: new Date() },
        },
        include: {
          user: {
            include: {
              organization: {
                select: { id: true, name: true, slug: true, plan: true, settings: true },
              },
            },
          },
        },
      })

      if (!session) return null

      const preferences = readUserPreferences(session.user.preferences)
      const timeoutMinutes =
        typeof readUserPreferences(session.user.organization.settings).sessionTimeoutMinutes === 'number' &&
          Number.isFinite(readUserPreferences(session.user.organization.settings).sessionTimeoutMinutes)
          ? Math.min(1440, Math.max(5, readUserPreferences(session.user.organization.settings).sessionTimeoutMinutes as number))
          : typeof preferences.sessionTimeoutMinutes === 'number' && Number.isFinite(preferences.sessionTimeoutMinutes)
            ? Math.min(1440, Math.max(5, preferences.sessionTimeoutMinutes))
            : 60
      const lastSeenAt = session.lastActiveAt instanceof Date ? session.lastActiveAt : session.expiresAt

      if (lastSeenAt.getTime() + timeoutMinutes * 60_000 <= Date.now()) {
        await db.userSession.update({
          where: { id: session.id },
          data: { isActive: false },
        })
        return null
      }

      if (Date.now() - lastSeenAt.getTime() >= 60_000) {
        await db.userSession.update({
          where: { id: session.id },
          data: { lastActiveAt: new Date() },
        })
      }

      return {
        session: {
          sessionToken,
          userId: session.userId,
          expires: session.expiresAt,
        },
        user: mapUser(session.user),
      }
    },
    async updateSession(session) {
      const updated = await db.userSession.updateMany({
        where: {
          token: hashSessionToken(session.sessionToken),
          isActive: true,
        },
        data: {
          ...(session.expires ? { expiresAt: session.expires } : {}),
          lastActiveAt: new Date(),
        },
      })

      if (updated.count === 0) return null
      return {
        sessionToken: session.sessionToken,
        userId: session.userId ?? '',
        expires: session.expires ?? new Date(Date.now() + SESSION_TTL_MS),
      }
    },
    async deleteSession(sessionToken) {
      const existing = await db.userSession.findFirst({
        where: { token: hashSessionToken(sessionToken), isActive: true },
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

      await db.userSession.updateMany({
        where: { token: hashSessionToken(sessionToken) },
        data: { isActive: false },
      })

      if (existing?.user) {
        await db.auditLog.create({
          data: {
            organizationId: existing.user.organizationId,
            action: 'logout',
            entityType: 'user_session',
            entityId: existing.id,
            actorId: existing.user.id,
            actorEmail: existing.user.email,
            description: 'Signed out of the workspace',
          },
        })
      }
    },
    async createVerificationToken() {
      throw new Error('Verification tokens are not supported for this credentials-only flow')
    },
    async useVerificationToken() {
      return null
    },
  }
}

export function buildNextAuthOptions(request?: NextRequest): NextAuthOptions {
  return {
    secret: getAuthSecret(),
    adapter: createPrismaAuthAdapter(request),
    session: {
      strategy: 'database',
      maxAge: Math.floor(SESSION_TTL_MS / 1000),
    },
    providers: [
      CredentialsProvider({
        name: 'Email and Password',
        credentials: {
          email: { label: 'Email', type: 'email' },
          password: { label: 'Password', type: 'password' },
        },
        async authorize(credentials) {
          const email = typeof credentials?.email === 'string' ? credentials.email.trim().toLowerCase() : ''
          const password = typeof credentials?.password === 'string' ? credentials.password : ''
          if (!email || !password) return null

          const user = await db.user.findUnique({
            where: { email },
            include: {
              organization: {
                select: { id: true, name: true, slug: true, plan: true },
              },
            },
          })

          if (!user || !verifyPassword(password, user.passwordHash)) return null

          return mapUser(user)
        },
      }),
    ],
    pages: {
      signIn: '/auth',
    },
    cookies: {
      sessionToken: {
        name: AUTH_COOKIE_NAME,
        options: {
          httpOnly: true,
          sameSite: 'lax',
          path: '/',
          secure: process.env.NODE_ENV === 'production',
        },
      },
    },
    callbacks: {
      async jwt({ token, user }) {
        if (!user) return token

        const u = user as typeof user & {
          role: string
          organizationId: string
          organization: { id: string; name: string; slug: string; plan: string }
          preferences: unknown
        }

        token.sub = u.id
        token.email = u.email
        token.name = u.name
        token.picture = u.image
        token.role = u.role
        token.organizationId = u.organizationId
        token.organization = u.organization
        token.preferences = u.preferences

        return token
      },
      async session({ session, token, user }) {
        const t = token as typeof token & {
          role: string
          organizationId: string
          organization: { id: string; name: string; slug: string; plan: string }
          preferences: unknown
        }
        const u = user as typeof user & {
          id?: string
          email?: string | null
          name?: string | null
          image?: string | null
          role?: string
          organizationId?: string
          organization?: { id: string; name: string; slug: string; plan: string }
          preferences?: unknown
        }

        const id = typeof t?.sub === 'string' ? t.sub : typeof u?.id === 'string' ? u.id : ''
        const email = typeof t?.email === 'string' ? t.email : typeof u?.email === 'string' ? u.email : ''
        const name = typeof t?.name === 'string' ? t.name : typeof u?.name === 'string' ? u.name : null
        const image = typeof t?.picture === 'string' ? t.picture : typeof u?.image === 'string' ? u.image : null
        const role = typeof t?.role === 'string' ? t.role : typeof u?.role === 'string' ? u.role : ''
        const organizationId =
          typeof t?.organizationId === 'string'
            ? t.organizationId
            : typeof u?.organizationId === 'string'
              ? u.organizationId
              : ''
        const organization = t?.organization ?? u?.organization ?? { id: '', name: '', slug: '', plan: '' }
        const preferences = t?.preferences ?? u?.preferences ?? {}

        session.user.id = id
        session.user.email = email
        session.user.name = name
        session.user.image = image
        session.user.role = role
        session.user.organizationId = organizationId
        session.user.organization = organization
        session.user.preferences = preferences
        session.user.mustChangePassword = readUserPreferences(preferences).requirePasswordChange === true
        return session
      },
    },
  }
}
