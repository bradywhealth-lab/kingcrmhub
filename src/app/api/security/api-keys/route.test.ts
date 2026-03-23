import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mockDb = vi.hoisted(() => ({
  organization: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  auditLog: {
    create: vi.fn(),
  },
}))

const mockSecurity = vi.hoisted(() => ({
  hashSessionToken: vi.fn(() => 'hashed_key'),
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

vi.mock("@/lib/security", () => mockSecurity)
vi.mock("@/lib/auth", () => ({ hashSessionToken: vi.fn(() => "hashed_key") }))

import { DELETE, GET, POST } from './route'

describe('/api/security/api-keys', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('lists API keys from organization settings', async () => {
    mockDb.organization.findUnique.mockResolvedValueOnce({
      settings: {
        apiKeys: [{ id: 'key_1', name: 'Server', preview: 'ifz_abcd...1234', createdAt: '2026-03-19T00:00:00.000Z' }],
      },
    })

    const response = await GET(new NextRequest('http://localhost/api/security/api-keys'))
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.apiKeys).toHaveLength(1)
    expect(json.apiKeys[0].name).toBe('Server')
  })

  it('creates an API key and returns the raw key once', async () => {
    mockDb.organization.findUnique.mockResolvedValueOnce({ settings: {} })
    mockDb.organization.update.mockResolvedValueOnce({})

    const request = new NextRequest('http://localhost/api/security/api-keys', {
      method: 'POST',
      body: JSON.stringify({ name: 'Server' }),
      headers: { 'Content-Type': 'application/json' },
    })

    const response = await POST(request)
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.apiKey.name).toBe('Server')
    expect(typeof json.rawKey).toBe('string')
    expect(mockDb.auditLog.create).toHaveBeenCalledOnce()
  })

  it('revokes an API key from organization settings and audits the action', async () => {
    mockDb.organization.findUnique.mockResolvedValueOnce({
      settings: {
        apiKeys: [
          { id: 'key_1', name: 'Server', preview: 'ifz_abcd...1234', createdAt: '2026-03-19T00:00:00.000Z' },
        ],
      },
    })
    mockDb.organization.update.mockResolvedValueOnce({})

    const request = new NextRequest('http://localhost/api/security/api-keys?id=key_1', {
      method: 'DELETE',
    })

    const response = await DELETE(request)
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.success).toBe(true)
    expect(mockDb.organization.update).toHaveBeenCalledWith({
      where: { id: 'org_1' },
      data: {
        settings: {
          apiKeys: [
            expect.objectContaining({
              id: 'key_1',
              revokedAt: expect.any(String),
            }),
          ],
        },
      },
    })
    expect(mockDb.auditLog.create).toHaveBeenCalledOnce()
  })
})
