import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'
import { pbkdf2Sync } from 'node:crypto'

const mockDb = vi.hoisted(() => ({
  user: {
    findFirst: vi.fn(),
    create: vi.fn(),
  },
  organization: {
    create: vi.fn(),
    findUnique: vi.fn(),
  },
  userSession: {
    create: vi.fn(),
    updateMany: vi.fn(),
    findFirst: vi.fn(),
  },
}))

const mockEnforceRateLimit = vi.hoisted(() => vi.fn())

vi.mock('@/lib/db', () => ({
  db: mockDb,
}))

vi.mock('@/lib/rate-limit', () => ({
  enforceRateLimit: mockEnforceRateLimit,
}))

import { POST } from './route'

function hashPassword(password: string, salt: string) {
  return pbkdf2Sync(password, salt, 100_000, 32, 'sha256').toString('hex')
}

describe('POST /api/auth', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockEnforceRateLimit.mockReturnValue(null)
  })

  it('returns rate-limit response for signin when limit is exceeded', async () => {
    mockEnforceRateLimit.mockReturnValueOnce(
      NextResponse.json({ error: 'Too many requests, please retry later' }, { status: 429 })
    )

    const request = new NextRequest('http://localhost/api/auth', {
      method: 'POST',
      body: JSON.stringify({ action: 'signin', email: 'agent@example.com', password: 'secret' }),
    })

    const response = await POST(request)
    expect(response.status).toBe(429)
    await expect(response.json()).resolves.toEqual({ error: 'Too many requests, please retry later' })
    expect(mockDb.user.findFirst).not.toHaveBeenCalled()
  })

  it('returns 401 for invalid credentials', async () => {
    const salt = 'a'.repeat(32)
    mockDb.user.findFirst.mockResolvedValueOnce({
      id: 'user_1',
      email: 'agent@example.com',
      name: 'Agent',
      role: 'owner',
      organizationId: 'org_1',
      preferences: {
        salt,
        passwordHash: hashPassword('correct-password', salt),
      },
      organization: { id: 'org_1', name: 'Org', slug: 'org' },
    })

    const request = new NextRequest('http://localhost/api/auth', {
      method: 'POST',
      body: JSON.stringify({ action: 'signin', email: 'agent@example.com', password: 'wrong-password' }),
    })

    const response = await POST(request)
    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: 'Invalid email or password' })
    expect(mockDb.userSession.create).not.toHaveBeenCalled()
  })

  it('creates a session and sets secure cookie attributes on successful signin', async () => {
    const salt = 'b'.repeat(32)
    mockDb.user.findFirst.mockResolvedValueOnce({
      id: 'user_1',
      email: 'agent@example.com',
      name: 'Agent',
      role: 'owner',
      organizationId: 'org_1',
      preferences: {
        salt,
        passwordHash: hashPassword('correct-password', salt),
      },
      organization: { id: 'org_1', name: 'Org', slug: 'org' },
    })

    const request = new NextRequest('http://localhost/api/auth', {
      method: 'POST',
      body: JSON.stringify({ action: 'signin', email: 'agent@example.com', password: 'correct-password' }),
    })

    const response = await POST(request)

    expect(response.status).toBe(200)
    expect(mockDb.userSession.create).toHaveBeenCalledTimes(1)

    const setCookie = response.headers.get('set-cookie')
    expect(setCookie).toContain('session-token=')
    expect(setCookie).toContain('HttpOnly')
    expect(setCookie).toContain('SameSite=Lax')
    expect(setCookie).toContain('Path=/')
    expect(setCookie).toContain('Max-Age=604800')
  })
})
