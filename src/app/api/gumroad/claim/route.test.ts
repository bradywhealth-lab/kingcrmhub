import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
vi.mock('next-auth', () => ({
  getServerSession: vi.fn(),
}))
vi.mock('@/lib/next-auth', () => ({
  buildNextAuthOptions: vi.fn(() => ({})),
}))
vi.mock('@/lib/security', () => ({
  enforceSameOrigin: vi.fn(() => null),
}))
vi.mock('@/lib/rate-limit', () => ({
  enforceRateLimit: vi.fn(() => null),
}))
vi.mock('@/lib/db', () => ({
  db: {
    gumroadClaim: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    organization: {
      update: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
  },
  // The claim route wraps signed-in org writes in the RLS transaction seam
  // (Organization/AuditLog are RLS-scoped). In tests the seam just runs the
  // callback so the underlying mocks observe every write.
  withOrgRlsTransaction: vi.fn(async (_orgId: string, callback: () => Promise<unknown>) => callback()),
}))
vi.mock('@/lib/gumroad/verify', () => ({
  createGumroadVerifier: vi.fn(() => verifyModule.mockVerifier),
  parseAllowlistEnv: vi.fn((raw?: string) =>
    (raw ?? '')
      .split(';')
      .filter(Boolean)
      .map((pair) => {
        const [email, key] = pair.split(',').map((s) => s.trim())
        return { email, key }
      }),
  ),
}))

const verifyModule = vi.hoisted(() => ({
  mockVerifier: { verify: vi.fn() },
}))

import { getServerSession } from 'next-auth'
import { db } from '@/lib/db'
import { createGumroadVerifier } from '@/lib/gumroad/verify'
import { POST } from './route'

const mockSession = getServerSession as unknown as ReturnType<typeof vi.fn>
const mockCreateVerifier = createGumroadVerifier as unknown as ReturnType<typeof vi.fn>
const mockVerifier = verifyModule.mockVerifier

function post(body: unknown, origin = 'http://localhost:3000') {
  return new Request('http://localhost:3000/api/gumroad/claim', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', origin },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

function okPurchase(overrides: Partial<{ email: string; saleId: string }> = {}) {
  return {
    ok: true as const,
    fromAllowlist: false,
    purchase: {
      email: 'buyer@example.com',
      productName: 'AI Prompt Arsenal',
      permalink: 'ai-prompt-arsenal',
      orderNumber: 123,
      saleId: 'SALE-1',
      refunded: false,
      disputed: false,
      chargebacked: false,
      subscriptionId: null,
      recurrence: null,
      ...overrides,
    },
  }
}

describe('/api/gumroad/claim — public claim flow, fail closed', () => {
  const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

  beforeEach(() => {
    vi.clearAllMocks()
    consoleSpy.mockClear()
    mockSession.mockResolvedValue(null)
    mockCreateVerifier.mockReturnValue(mockVerifier)
    process.env.GUMROAD_CLAIMS_ENABLED = '1'
    process.env.GUMROAD_PRODUCT_PERMALINK = 'ai-prompt-arsenal'
    delete process.env.GUMROAD_ALLOWLIST

    vi.mocked(db.gumroadClaim.findFirst).mockResolvedValue(null)
    vi.mocked(db.gumroadClaim.create).mockResolvedValue({
      id: 'claim-1',
      email: 'buyer@example.com',
      purchaseRef: 'gumroad:SALE-1',
      keyHash: 'deadbeef',
      planId: 'pro',
      expiresAt: new Date(),
      organizationId: null,
      status: 'pending',
    } as never)
    vi.mocked(db.organization.update).mockResolvedValue({} as never)
    vi.mocked(db.auditLog.create).mockResolvedValue({} as never)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    consoleSpy.mockClear()
  })

  it('grants an existing org the Studio promo and records a single-use claim', async () => {
    mockSession.mockResolvedValue({
      user: { id: 'u1', email: 'buyer@example.com', organizationId: 'org-1' },
    })
    mockVerifier.verify.mockResolvedValue(okPurchase())

    const res = await POST(post({ email: 'buyer@example.com', licenseKey: 'AAAA-BBBB-CCCC-DDDD' }))
    const json = (await res.json()) as Record<string, string>

    expect(res.status).toBe(200)
    expect(json.status).toBe('granted')
    expect(json.plan).toBe('pro')
    expect(json.label).toBe('Studio')
    expect(typeof json.expiresAt).toBe('string')
    expect(db.gumroadClaim.create).toHaveBeenCalledOnce()
    const created = vi.mocked(db.gumroadClaim.create).mock.calls[0][0]
    expect(created.data.expiresAt.getTime()).toBeGreaterThan(Date.now() + 29 * 24 * 60 * 60 * 1000)
    // Org is lifted to promo pro — the ONLY plan write allowed is the stored id.
    expect(vi.mocked(db.organization.update).mock.calls[0][0].data.promoPlanId).toBe('pro')
    // Raw license key must never be persisted.
    expect(JSON.stringify(created.data)).not.toContain('AAAA-BBBB-CCCC-DDDD')
  })

  it('returns 409 when the same purchase has already been claimed (single-use)', async () => {
    mockSession.mockResolvedValue({
      user: { id: 'u1', email: 'buyer@example.com', organizationId: 'org-1' },
    })
    mockVerifier.verify.mockResolvedValue(okPurchase())
    vi.mocked(db.gumroadClaim.findFirst).mockResolvedValue({
      id: 'old-claim',
      email: 'buyer@example.com',
      purchaseRef: 'gumroad:SALE-1',
      keyHash: 'x',
      planId: 'pro',
      expiresAt: new Date(),
      organizationId: 'org-0',
      status: 'granted',
    } as never)

    const res = await POST(post({ email: 'buyer@example.com', licenseKey: 'AAAA-BBBB-CCCC-DDDD' }))

    expect(res.status).toBe(409)
    expect(db.gumroadClaim.create).not.toHaveBeenCalled()
    expect(db.organization.update).not.toHaveBeenCalled()
  })

  it('maps a P2002 unique-race on the purchase ref to 409 (concurrent double claim)', async () => {
    mockVerifier.verify.mockResolvedValue(okPurchase())
    // findFirst misses the race (both requests past the guard), then the
    // UNIQUE(purchaseRef) constraint fires on create.
    vi.mocked(db.gumroadClaim.findFirst).mockResolvedValue(null)
    vi.mocked(db.gumroadClaim.create).mockRejectedValue(
      Object.assign(new Error('Unique constraint failed'), { code: 'P2002' }),
    )

    const res = await POST(post({ email: 'buyer@example.com', licenseKey: 'AAAA-BBBB-CCCC-DDDD' }))

    expect(res.status).toBe(409)
    const json = (await res.json()) as { error: string }
    expect(json.error).toContain('already been claimed')
  })

  it('returns 400 for an invalid key with a generic message (no key material)', async () => {
    mockVerifier.verify.mockResolvedValue({ ok: false, reason: 'invalid' })

    const res = await POST(post({ email: 'buyer@example.com', licenseKey: 'NOPE-NOPE-NOPE' }))
    const json = (await res.json()) as { error: string }

    expect(res.status).toBe(400)
    expect(json.error).not.toContain('NOPE-NOPE-NOPE')
    expect(json.error.length).toBeGreaterThan(0)
  })

  it('returns 403 for a refunded/chargebacked purchase (fail closed)', async () => {
    mockVerifier.verify.mockResolvedValue({ ok: false, reason: 'refunded' })

    const res = await POST(post({ email: 'buyer@example.com', licenseKey: 'AAAA-BBBB-CCCC-DDDD' }))

    expect(res.status).toBe(403)
  })

  it('returns 400 when the Gumroad purchase email does not match the claimed email', async () => {
    mockVerifier.verify.mockResolvedValue(okPurchase({ email: 'someone-else@example.com' }))

    const res = await POST(post({ email: 'buyer@example.com', licenseKey: 'AAAA-BBBB-CCCC-DDDD' }))

    expect(res.status).toBe(400)
    expect(db.gumroadClaim.create).not.toHaveBeenCalled()
  })

  it('returns 400 for malformed input (missing email or key)', async () => {
    const missingEmail = await POST(post({ licenseKey: 'AAAA-BBBB' }))
    const missingKey = await POST(post({ email: 'buyer@example.com' }))

    expect(missingEmail.status).toBe(400)
    expect(missingKey.status).toBe(400)
  })

  it('returns 503 when neither Gumroad HTTP nor the allowlist is configured', async () => {
    delete process.env.GUMROAD_CLAIMS_ENABLED
    delete process.env.GUMROAD_PRODUCT_PERMALINK
    // Real verifier behavior with no product id and no allowlist: unavailable.
    mockVerifier.verify.mockResolvedValue({ ok: false, reason: 'unavailable' })

    const res = await POST(post({ email: 'buyer@example.com', licenseKey: 'AAAA-BBBB-CCCC-DDDD' }))

    expect(res.status).toBe(503)
    expect(db.gumroadClaim.create).not.toHaveBeenCalled()
  })

  it('grants via the manual allowlist when Gumroad HTTP is disabled (real-key fallback)', async () => {
    delete process.env.GUMROAD_CLAIMS_ENABLED
    process.env.GUMROAD_ALLOWLIST = 'buyer@example.com,AAAA-BBBB-CCCC-DDDD'
    mockVerifier.verify.mockResolvedValue({
      ok: true,
      fromAllowlist: true,
      purchase: {
        email: 'buyer@example.com',
        productName: 'Manual allowlist grant',
        permalink: '',
        orderNumber: 0,
        saleId: 'ALLOWLIST',
        refunded: false,
        disputed: false,
        chargebacked: false,
        subscriptionId: null,
        recurrence: null,
      },
    })

    const res = await POST(post({ email: 'buyer@example.com', licenseKey: 'AAAA-BBBB-CCCC-DDDD' }))

    expect(res.status).toBe(200)
    const json = (await res.json()) as { status: string }
    expect(json.status).toBe('pending')
    expect(db.gumroadClaim.create).toHaveBeenCalledOnce()
  })

  it('never writes the license key to logs in any failure path', async () => {
    mockVerifier.verify.mockResolvedValue({ ok: false, reason: 'invalid' })
    const key = 'SECRET-KEY-1234-5678'

    await POST(post({ email: 'buyer@example.com', licenseKey: key }))
    mockVerifier.verify.mockResolvedValue({ ok: false, reason: 'refunded' })
    await POST(post({ email: 'buyer@example.com', licenseKey: key }))
    mockVerifier.verify.mockResolvedValue(okPurchase({ email: 'other@example.com' }))
    await POST(post({ email: 'buyer@example.com', licenseKey: key }))

    const logs = consoleSpy.mock.calls.flat().map(String).join('\n')
    expect(logs).not.toContain(key)
    expect(logs).not.toContain('SECRET-KEY')
  })
})
