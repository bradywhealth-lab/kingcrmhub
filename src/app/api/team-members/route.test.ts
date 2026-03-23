import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mockDb = vi.hoisted(() => ({
  teamMember: {
    findMany: vi.fn(),
    updateMany: vi.fn(),
  },
  user: {
    findUnique: vi.fn(),
  },
  auditLog: {
    create: vi.fn(),
  },
  $transaction: vi.fn(),
}))

const mockAuth = vi.hoisted(() => ({
  createSessionToken: vi.fn(() => 'invite_token'),
  hashSessionToken: vi.fn(() => 'hashed_invite_token'),
}))

vi.mock('@/lib/db', () => ({
  db: mockDb,
}))

vi.mock('@/lib/request-context', () => ({
  withRequestOrgContext: vi.fn(async (_request: NextRequest, handler: (context: { organizationId: string; userId: string }) => Promise<unknown>) =>
    handler({ organizationId: 'org_1', userId: 'user_1' }),
  ),
}))

vi.mock('@/lib/rate-limit', () => ({
  enforceRateLimit: vi.fn(() => null),
}))

vi.mock('@/lib/auth', () => mockAuth)

import { GET, PATCH, POST } from './route'

describe('/api/team-members', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('lists team members', async () => {
    mockDb.teamMember.findMany.mockResolvedValueOnce([
      {
        id: 'member_1',
        role: 'owner',
        isActive: true,
        user: {
          id: 'user_1',
          name: 'Owner',
          email: 'owner@example.com',
          role: 'owner',
        },
      },
    ])

    const response = await GET(new NextRequest('http://localhost/api/team-members'))
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.members).toHaveLength(1)
    expect(json.members[0].email).toBe('owner@example.com')
  })

  it('creates a team member with an invite link', async () => {
    mockDb.user.findUnique.mockResolvedValueOnce(null)
    mockDb.$transaction.mockImplementationOnce(async (callback: (tx: Record<string, unknown>) => Promise<unknown>) =>
      callback({
        user: {
          create: vi.fn(async () => ({
            id: 'user_2',
            name: 'Agent Smith',
            email: 'agent@example.com',
          })),
        },
        teamMember: {
          create: vi.fn(async () => ({
            id: 'member_2',
            role: 'agent',
            isActive: true,
          })),
        },
        auditLog: {
          create: vi.fn(async () => ({ id: 'audit_1' })),
        },
      }),
    )

    const request = new NextRequest('http://localhost/api/team-members', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Agent Smith',
        email: 'agent@example.com',
        role: 'agent',
      }),
      headers: { 'Content-Type': 'application/json' },
    })

    const response = await POST(request)
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.member.email).toBe('agent@example.com')
    expect(json.inviteLink).toContain('/auth/invite?email=')
    expect(json.inviteExpiresAt).toBeTruthy()
  })

  it('updates a team member role', async () => {
    mockDb.teamMember.updateMany.mockResolvedValueOnce({ count: 1 })
    mockDb.auditLog.create.mockResolvedValueOnce({ id: 'audit_1' })

    const request = new NextRequest('http://localhost/api/team-members?id=member_1', {
      method: 'PATCH',
      body: JSON.stringify({ role: 'admin' }),
      headers: { 'Content-Type': 'application/json' },
    })

    const response = await PATCH(request)
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.success).toBe(true)
  })
})
