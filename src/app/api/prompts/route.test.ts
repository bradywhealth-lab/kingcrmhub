import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mockDb = vi.hoisted(() => ({
  organization: {
    findUnique: vi.fn(),
  },
}))

vi.mock('@/lib/db', () => ({ db: mockDb }))

vi.mock('@/lib/request-context', () => ({
  withRequestOrgContext: vi.fn(async (_request: NextRequest, handler: (context: { organizationId: string; userId: string }) => Promise<unknown>) =>
    handler({ organizationId: 'org_1', userId: 'user_1' }),
  ),
}))

import { GET } from './route'

describe('/api/prompts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('omits bodies for locked prompts and keeps them for a free plan', async () => {
    mockDb.organization.findUnique.mockResolvedValueOnce({ plan: 'free' })

    const response = await GET(new NextRequest('http://localhost/api/prompts'))
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.prompts).toHaveLength(22)
    const unlocked = json.prompts.filter((p: { unlocked: boolean }) => p.unlocked)
    const locked = json.prompts.filter((p: { unlocked: boolean }) => !p.unlocked)
    expect(unlocked).toHaveLength(6)
    expect(locked).toHaveLength(16)
    expect(locked.every((p: Record<string, unknown>) => !Object.hasOwn(p, 'body'))).toBe(true)
    expect(unlocked.every((p: { body?: string }) => typeof p.body === 'string' && p.body.length > 0)).toBe(true)
  })

  it('unlocks all 22 bodies for the top stored plan (enterprise → Elite)', async () => {
    mockDb.organization.findUnique.mockResolvedValueOnce({ plan: 'enterprise' })

    const response = await GET(new NextRequest('http://localhost/api/prompts'))
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.prompts.filter((p: { unlocked: boolean }) => p.unlocked)).toHaveLength(22)
    expect(json.prompts.every((p: { body?: string }) => typeof p.body === 'string')).toBe(true)
  })

  it('404s when the organization is missing', async () => {
    mockDb.organization.findUnique.mockResolvedValueOnce(null)

    const response = await GET(new NextRequest('http://localhost/api/prompts'))
    expect(response.status).toBe(404)
  })

  it('serves private, no-store responses so paid bodies never hit shared caches', async () => {
    mockDb.organization.findUnique.mockResolvedValueOnce({ plan: 'pro' })
    const response = await GET(new NextRequest('http://localhost/api/prompts'))
    expect(response.headers.get('cache-control')).toContain('no-store')
  })
})
