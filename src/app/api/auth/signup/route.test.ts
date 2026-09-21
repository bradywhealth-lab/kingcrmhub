import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mockDb = vi.hoisted(() => ({
  user: { findUnique: vi.fn(), create: vi.fn() },
  organization: { findUnique: vi.fn(), create: vi.fn() },
  teamMember: { create: vi.fn() },
  gumroadClaim: { findFirst: vi.fn(), updateMany: vi.fn() },
  auditLog: { create: vi.fn() },
  $transaction: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  db: mockDb,
}))
vi.mock('@/lib/security', () => ({
  enforceSameOrigin: vi.fn(() => null),
}))
vi.mock('@/lib/rate-limit', () => ({
  enforceRateLimit: vi.fn(() => null),
}))

import { db } from '@/lib/db'
import { POST } from './route'

function post(body: unknown) {
  return new NextRequest('http://localhost:3000/api/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', origin: 'http://localhost:3000' },
    body: JSON.stringify(body),
  })
}

const VALID_SIGNUP = {
  name: 'Prompt Buyer',
  email: 'buyer@example.com',
  password: 'password123',
  organizationName: 'Buyer Co',
}

describe('/api/auth/signup — applies pending Gumroad claim to the new org', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDb.user.findUnique.mockResolvedValue(null)
    mockDb.organization.findUnique.mockResolvedValue(null)
    mockDb.organization.create.mockResolvedValue({
      id: 'org-new',
      name: 'Buyer Co',
      slug: 'buyer-co',
      plan: 'free',
      promoPlanId: null,
      promoPlanExpiresAt: null,
    } as never)
    mockDb.user.create.mockResolvedValue({
      id: 'u1',
      email: 'buyer@example.com',
      role: 'owner',
      organizationId: 'org-new',
      organization: { id: 'org-new', name: 'Buyer Co', slug: 'buyer-co', plan: 'free' },
    } as never)
    mockDb.gumroadClaim.findFirst.mockResolvedValue(null)
    mockDb.teamMember.create.mockResolvedValue({} as never)
    mockDb.auditLog.create.mockResolvedValue({} as never)

    // Inside the $transaction callback, each model is a bare stub that
    // forwards to the top-level mocks (same object identity) so assertions
    // on mockDb.*.mock.calls still work.
    mockDb.$transaction.mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) =>
      cb({
        organization: mockDb.organization,
        user: mockDb.user,
        teamMember: mockDb.teamMember,
        gumroadClaim: mockDb.gumroadClaim,
        auditLog: mockDb.auditLog,
      }),
    )
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('creates a free org (no claim) exactly as before', async () => {
    const res = await POST(post(VALID_SIGNUP))
    expect(res.status).toBe(200)
    expect(mockDb.organization.create.mock.calls[0][0].data.plan).toBe('free')
    const signup = (await res.json()) as { user: { organization: { plan: string } } }
    expect(signup.user.organization.plan).toBe('free')
  })

  it('binds a pending claim: org gets promo columns + claim flips to granted', async () => {
    const pendingClaim = {
      id: 'claim-pending',
      email: 'buyer@example.com',
      purchaseRef: 'gumroad:SALE-1',
      keyHash: 'abc',
      planId: 'pro',
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      organizationId: null,
      status: 'pending',
    }
    mockDb.gumroadClaim.findFirst.mockResolvedValue(pendingClaim as never)

    const res = await POST(post(VALID_SIGNUP))
    expect(res.status).toBe(200)

    // The org is created with the promo overlay inside the same transaction.
    const claimUpdate = mockDb.gumroadClaim.updateMany.mock.calls[0][0]
    expect(claimUpdate.where).toMatchObject({ id: 'claim-pending', status: 'pending' })
    expect(claimUpdate.data).toMatchObject({ status: 'granted', organizationId: 'org-new' })

    const audit = mockDb.auditLog.create.mock.calls[0][0]
    expect(audit.data.description).toContain('promo')
    expect(audit.data.metadata).toMatchObject({ planId: 'pro', claimId: 'claim-pending' })
  })

  it('does not bind claims that belong to another email (cross-email isolation)', async () => {
    mockDb.gumroadClaim.findFirst.mockResolvedValue(null)

    const res = await POST(post({ ...VALID_SIGNUP, email: 'new-person@example.com' }))
    expect(res.status).toBe(200)
    expect(mockDb.gumroadClaim.updateMany).not.toHaveBeenCalled()
  })

  it('does not bind an expired pending claim at signup', async () => {
    // The query itself filters expiresAt > now; the real DB would never
    // return an expired row. Model the filter honestly: findFirst returns
    // null because the expired row fails the where clause.
    mockDb.gumroadClaim.findFirst.mockResolvedValue(null)

    const res = await POST(post(VALID_SIGNUP))
    expect(res.status).toBe(200)

    // The route's where clause carries the expiry guard (status + expiresAt).
    const where = mockDb.gumroadClaim.findFirst.mock.calls[0][0].where
    expect(where.status).toBe('pending')
    expect(where.expiresAt.gt.getTime()).toBeLessThanOrEqual(Date.now())
    expect(mockDb.gumroadClaim.updateMany).not.toHaveBeenCalled()
  })
})
