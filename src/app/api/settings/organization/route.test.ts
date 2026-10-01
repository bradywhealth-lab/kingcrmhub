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
      plan: 'pro',
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

  // S10 regression: a bare domain used to fail the whole payload with a 400,
  // which silently blocked onboarding step 1.
  it('accepts a bare domain for logo and normalizes it to https://', async () => {
    mockDb.organization.findUnique.mockResolvedValueOnce({ settings: {} })
    mockDb.organization.update.mockResolvedValueOnce({ id: 'org_1', name: 'Solo', slug: 'solo', logo: 'https://mydomain.com', plan: 'free', settings: {} })

    const request = new NextRequest('http://localhost/api/settings/organization', {
      method: 'PATCH',
      body: JSON.stringify({ name: 'Solo', logo: 'mydomain.com' }),
      headers: { 'Content-Type': 'application/json' },
    })

    const response = await PATCH(request)
    expect(response.status).toBe(200)
    expect(mockDb.organization.update.mock.calls[0][0].data.logo).toBe('https://mydomain.com')
  })

  it('leaves a full URL untouched', async () => {
    mockDb.organization.findUnique.mockResolvedValueOnce({ settings: {} })
    mockDb.organization.update.mockResolvedValueOnce({ id: 'org_1', name: 'Solo', slug: 'solo', logo: 'https://keep.me/l.png', plan: 'free', settings: {} })

    const request = new NextRequest('http://localhost/api/settings/organization', {
      method: 'PATCH',
      body: JSON.stringify({ name: 'Solo', logo: 'https://keep.me/l.png' }),
      headers: { 'Content-Type': 'application/json' },
    })

    await PATCH(request)
    expect(mockDb.organization.update.mock.calls[0][0].data.logo).toBe('https://keep.me/l.png')
  })

  // cubic P2 regression: omitting logo must not erase existing branding.
  it('does not clear an existing logo when logo is omitted', async () => {
    mockDb.organization.findUnique.mockResolvedValueOnce({ settings: {} })
    mockDb.organization.update.mockResolvedValueOnce({ id: 'org_1', name: 'Solo', slug: 'solo', logo: 'https://keep.me/l.png', plan: 'free', settings: {} })

    const request = new NextRequest('http://localhost/api/settings/organization', {
      method: 'PATCH',
      body: JSON.stringify({ name: 'Solo' }),
      headers: { 'Content-Type': 'application/json' },
    })

    const response = await PATCH(request)
    expect(response.status).toBe(200)
    expect(mockDb.organization.update.mock.calls[0][0].data.logo).toBeUndefined()
  })

  it('clears the logo only on an explicit empty string', async () => {
    mockDb.organization.findUnique.mockResolvedValueOnce({ settings: {} })
    mockDb.organization.update.mockResolvedValueOnce({ id: 'org_1', name: 'Solo', slug: 'solo', logo: null, plan: 'free', settings: {} })

    const request = new NextRequest('http://localhost/api/settings/organization', {
      method: 'PATCH',
      body: JSON.stringify({ name: 'Solo', logo: '' }),
      headers: { 'Content-Type': 'application/json' },
    })

    const response = await PATCH(request)
    expect(response.status).toBe(200)
    expect(mockDb.organization.update.mock.calls[0][0].data.logo).toBeNull()
  })
})
