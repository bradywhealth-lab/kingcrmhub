import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { hashLicenseKey } from '@/lib/claim/gumroad'

/**
 * POST /api/claim — public Gumroad License API verification → pre-signup
 * ClaimGrant minting. The grant path must NEVER touch Stripe (spec
 * t_7160ffb5 §3: STRIPE_LIVE_ACTIVATION=1 live, zero-charge path by design).
 * All DB access goes through the mocked db; the License API call is stubbed
 * via global fetch so no real Gumroad request is ever made in tests.
 */

const mockDb = vi.hoisted(() => ({
  claimGrant: {
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
}))

vi.mock('@/lib/db', () => ({ db: mockDb }))

vi.mock('@/lib/rate-limit', () => ({
  enforceRateLimit: vi.fn(() => null),
}))

vi.mock('@/lib/security', () => ({
  enforceSameOrigin: vi.fn(() => null),
}))

// Resolved AFTER mocks so the route's imports see them.
const { POST } = await import('./route')

const VALID_KEY = 'A1B2C3D4-E5F60718-9ABCDEF0-1234ABCD'
const PRODUCT_ID = '32-nPAicqbLj8B_WswVlMw=='
const EMAIL = 'buyer@example.com'

function makeRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost/api/claim', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'http://localhost' },
    body: JSON.stringify(body),
  })
}

function stubValidVerification() {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
    new Response(
      JSON.stringify({
        success: true,
        purchase: { email: EMAIL, product_id: PRODUCT_ID, product_name: 'AI Prompt Arsenal', refunded: false, disputed: false },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    ),
  ))
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.stubEnv('GUMROAD_PRODUCT_ID_1', PRODUCT_ID)
  mockDb.claimGrant.findFirst.mockResolvedValue(null)
})

describe('POST /api/claim', () => {
  it('verifies a valid license and mints a single-use grant (hash only)', async () => {
    stubValidVerification()
    mockDb.claimGrant.create.mockResolvedValue({ id: 'grant-1', expiresAt: new Date(Date.now() + 30 * 86_400_000) })

    const res = await POST(makeRequest({ email: EMAIL, licenseKey: VALID_KEY }))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.expiresAt).toBeTruthy()
    // The raw key must NEVER reach the ledger — only the SHA-256 hash.
    expect(mockDb.claimGrant.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          licenseKeyHash: hashLicenseKey(VALID_KEY),
          orderEmail: EMAIL,
        }),
      }),
    )
    const createCall = mockDb.claimGrant.create.mock.calls[0][0] as { data: Record<string, string> }
    expect(createCall.data).not.toHaveProperty('licenseKey')
    expect(JSON.stringify(createCall)).not.toContain(VALID_KEY)
  })

  it('rejects an invalid license key with 400', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ success: false, message: 'That license key does not exist.' }), { status: 200 }),
    ))
    const res = await POST(makeRequest({ email: EMAIL, licenseKey: VALID_KEY }))
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toContain('license key')
  })

  it('rejects mismatched purchase email (key bought under a different address)', async () => {
    stubValidVerification()
    const res = await POST(makeRequest({ email: 'other@example.com', licenseKey: VALID_KEY }))
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toContain('does not match')
  })

  it('rejects a license already claimed (single-use, pre-verification gate)', async () => {
    mockDb.claimGrant.findFirst.mockResolvedValue({ id: 'grant-1', redeemedAt: new Date() })
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    const res = await POST(makeRequest({ email: EMAIL, licenseKey: VALID_KEY }))
    expect(res.status).toBe(409)
    const data = await res.json()
    expect(data.error).toContain('already been claimed')
    // No Gumroad round trip should happen for an already-consumed key.
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('tells a verified-but-not-yet-redeemed buyer to finish signup (409, no Gumroad call)', async () => {
    // Realistic retry path: the buyer verified a key, abandoned signup, and
    // returns to /claim with the same key+email (cubic P3: the
    // redeemedAt === null branch was untested).
    mockDb.claimGrant.findFirst.mockResolvedValue({ id: 'grant-1', redeemedAt: null })
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    const res = await POST(makeRequest({ email: EMAIL, licenseKey: VALID_KEY }))
    expect(res.status).toBe(409)
    const data = await res.json()
    expect(data.error).toContain('already been verified')
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('never mints a grant for a disputed purchase', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          purchase: { email: EMAIL, product_id: PRODUCT_ID, product_name: 'AI Prompt Arsenal', refunded: false, disputed: true },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    ))
    const res = await POST(makeRequest({ email: EMAIL, licenseKey: VALID_KEY }))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toContain('no longer eligible')
    expect(mockDb.claimGrant.create).not.toHaveBeenCalled()
  })

  it('returns the opaque server-issued grant id as the claim token', async () => {
    stubValidVerification()
    mockDb.claimGrant.create.mockResolvedValue({ id: 'cmxxxxxxx000000000000001', expiresAt: new Date(Date.now() + 30 * 86_400_000) })
    const res = await POST(makeRequest({ email: EMAIL, licenseKey: VALID_KEY }))
    const data = await res.json()
    expect(res.status).toBe(200)
    expect(data.claimToken).toBe('cmxxxxxxx000000000000001')
    // The token must never be the raw license key — it is a server-issued id.
    expect(data.claimToken).not.toContain(VALID_KEY)
  })

  it('rejects an eligible product id that is not configured', async () => {
    const res = await POST(makeRequest({ email: EMAIL, licenseKey: VALID_KEY, productId: 'some-other-product' }))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toContain('eligible product')
  })

  it('rejects an invalid body', async () => {
    const res = await POST(makeRequest({ email: 'not-an-email', licenseKey: 'short' }))
    expect(res.status).toBe(400)
  })

  it('returns 503 when no eligible product is configured', async () => {
    vi.stubEnv('GUMROAD_PRODUCT_ID_1', '')
    const res = await POST(makeRequest({ email: EMAIL, licenseKey: VALID_KEY }))
    expect(res.status).toBe(503)
  })

  it('never mints a grant for a refunded purchase', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          purchase: { email: EMAIL, product_id: PRODUCT_ID, product_name: 'AI Prompt Arsenal', refunded: true, disputed: false },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    ))
    const res = await POST(makeRequest({ email: EMAIL, licenseKey: VALID_KEY }))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toContain('no longer eligible')
    expect(mockDb.claimGrant.create).not.toHaveBeenCalled()
  })
})
