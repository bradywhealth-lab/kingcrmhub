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

import { GET, PATCH } from './route'

describe('/api/settings/organization', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('loads organization settings', async () => {
    mockDb.organization.findUnique.mockResolvedValueOnce({
      id: 'org_1',
      name: 'My Company',
      slug: 'my-company',
      logo: null,
      plan: 'free',
      promoPlanId: 'pro',
      promoPlanExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      settings: {
        sessionTimeoutMinutes: 90,
        twoFactorRequired: true,
      },
      _count: {
        leads: 42,
        users: 3,
        teamMembers: 3,
      },
    })

    const response = await GET(new NextRequest('http://localhost/api/settings/organization'))
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.organization.slug).toBe('my-company')
    expect(json.organization.twoFactorRequired).toBe(true)
    // Gumroad promo reflection (t_55f06113): effective tier reads the overlay,
    // the in-app nudge gets honest label + expiry.
    expect(json.organization.promo.active).toBe(true)
    expect(json.organization.promo.label).toBe('Studio')
    expect(json.organization.effectivePlan).toBe('pro')
  })

  it('reports no active promo when the org has none', async () => {
    mockDb.organization.findUnique.mockResolvedValueOnce({
      id: 'org_1',
      name: 'My Company',
      slug: 'my-company',
      logo: null,
      plan: 'pro',
      promoPlanId: null,
      promoPlanExpiresAt: null,
      settings: {},
      _count: { leads: 0, users: 1, teamMembers: 1 },
    })

    const response = await GET(new NextRequest('http://localhost/api/settings/organization'))
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.organization.promo.active).toBe(false)
    expect(json.organization.effectivePlan).toBe('pro')
  })

  it('updates organization settings, never the plan, and logs the change', async () => {
    mockDb.organization.findUnique.mockResolvedValueOnce({
      settings: { sessionTimeoutMinutes: 60 },
    })
    mockDb.organization.update.mockResolvedValueOnce({
      id: 'org_1',
      name: 'Solo Studio',
      slug: 'solo-studio',
      logo: null,
      plan: 'free',
      settings: { sessionTimeoutMinutes: 120, twoFactorRequired: true },
    })

    const request = new NextRequest('http://localhost/api/settings/organization', {
      method: 'PATCH',
      body: JSON.stringify({
        name: 'Solo Studio',
        plan: 'enterprise',
        sessionTimeoutMinutes: 120,
        twoFactorRequired: true,
      }),
      headers: { 'Content-Type': 'application/json' },
    })

    const response = await PATCH(request)
    const json = await response.json()

    expect(response.status).toBe(200)
    // Plan changes are NOT this endpoint's job — entitlements move only via
    // verified billing flows. A client-sent plan must never reach the DB write.
    expect(mockDb.organization.update.mock.calls[0][0].data).not.toHaveProperty('plan')
    expect(mockDb.auditLog.create).toHaveBeenCalledOnce()
    void json
  })
})
