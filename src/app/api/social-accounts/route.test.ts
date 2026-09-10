import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mockDb = vi.hoisted(() => ({
  socialAccount: {
    findMany: vi.fn(),
    upsert: vi.fn(),
    updateMany: vi.fn(),
    findUnique: vi.fn(),
  },
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

import { GET, PATCH, POST } from './route'

describe('/api/social-accounts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('lists connected social accounts', async () => {
    mockDb.socialAccount.findMany.mockResolvedValueOnce([
      {
        id: 'acct_1',
        platform: 'linkedin',
        accountId: 'company_1',
        accountName: 'My Company',
        tokenExpiresAt: null,
        profileData: { followers: 1200 },
        isActive: true,
        lastSyncedAt: new Date('2026-03-19T00:00:00.000Z'),
        createdAt: new Date('2026-03-19T00:00:00.000Z'),
        updatedAt: new Date('2026-03-19T00:00:00.000Z'),
      },
    ])

    const response = await GET(new NextRequest('http://localhost/api/social-accounts'))
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.accounts).toHaveLength(1)
    expect(json.accounts[0].platform).toBe('linkedin')
    expect(json.accounts[0].accessTokenConfigured).toBe(true)
  })

  it('creates or updates a social account connection', async () => {
    mockDb.socialAccount.upsert.mockResolvedValueOnce({
      id: 'acct_1',
      platform: 'linkedin',
      accountId: 'company_1',
      accountName: 'My Company',
      tokenExpiresAt: null,
      profileData: null,
      isActive: true,
      lastSyncedAt: new Date('2026-03-19T00:00:00.000Z'),
      createdAt: new Date('2026-03-19T00:00:00.000Z'),
      updatedAt: new Date('2026-03-19T00:00:00.000Z'),
    })

    const request = new NextRequest('http://localhost/api/social-accounts', {
      method: 'POST',
      body: JSON.stringify({
        platform: 'linkedin',
        accountId: 'company_1',
        accountName: 'My Company',
        accessToken: 'token_123',
      }),
      headers: { 'Content-Type': 'application/json' },
    })

    const response = await POST(request)
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.account.accountName).toBe('My Company')
    expect(mockDb.socialAccount.upsert).toHaveBeenCalledOnce()
  })

  it('toggles a social account active state', async () => {
    mockDb.socialAccount.updateMany.mockResolvedValueOnce({ count: 1 })
    mockDb.socialAccount.findUnique.mockResolvedValueOnce({
      id: 'acct_1',
      platform: 'linkedin',
      accountId: 'company_1',
      accountName: 'My Company',
      tokenExpiresAt: null,
      profileData: null,
      isActive: false,
      lastSyncedAt: new Date('2026-03-19T00:00:00.000Z'),
      createdAt: new Date('2026-03-19T00:00:00.000Z'),
      updatedAt: new Date('2026-03-19T00:00:00.000Z'),
    })

    const request = new NextRequest('http://localhost/api/social-accounts?id=acct_1', {
      method: 'PATCH',
      body: JSON.stringify({ isActive: false }),
      headers: { 'Content-Type': 'application/json' },
    })

    const response = await PATCH(request)
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.account.isActive).toBe(false)
  })
})
