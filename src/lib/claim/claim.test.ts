import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import {
  CLAIM_GRANT_WINDOW_DAYS,
  CLAIM_NUDGE_DAYS,
  claimProductCatalog,
  eligibleGumroadProductIds,
  hashLicenseKey,
  isEligibleGumroadProduct,
  verifyGumroadLicense,
} from './gumroad'
import { readClaimGrantInfo, resolveEffectivePlan } from './entitlement-info'
import { decodeClaimToken } from './redeem-signup'

describe('hashLicenseKey', () => {
  it('produces a stable 64-hex SHA-256 digest', () => {
    const hash = hashLicenseKey('ABCD-1234-EFGH-5678')
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
    expect(hashLicenseKey('ABCD-1234-EFGH-5678')).toBe(hash)
    expect(hashLicenseKey('different-key')).not.toBe(hash)
  })
})

describe('eligibleGumroadProductIds', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('reads GUMROAD_PRODUCT_ID_1..N and drops blank values', () => {
    vi.stubEnv('GUMROAD_PRODUCT_ID_1', 'abc-123')
    vi.stubEnv('GUMROAD_PRODUCT_ID_2', '')
    vi.stubEnv('GUMROAD_PRODUCT_ID_3', 'xyz-789')
    expect(eligibleGumroadProductIds()).toEqual(['abc-123', 'xyz-789'])
  })

  it('isEligibleGumroadProduct only accepts configured ids', () => {
    vi.stubEnv('GUMROAD_PRODUCT_ID_1', 'abc-123')
    expect(isEligibleGumroadProduct('abc-123')).toBe(true)
    expect(isEligibleGumroadProduct('nope')).toBe(false)
    expect(isEligibleGumroadProduct(null)).toBe(false)
  })

  it('never exposes ids when env is unset', () => {
    expect(eligibleGumroadProductIds({} as NodeJS.ProcessEnv)).toEqual([])
    expect(isEligibleGumroadProduct('abc-123', {} as NodeJS.ProcessEnv)).toBe(false)
  })

  it('catalogs only configured products (no phantom Freelancer OS)', () => {
    vi.stubEnv('GUMROAD_PRODUCT_ID_1', 'abc-123')
    vi.stubEnv('GUMROAD_PRODUCT_ID_2', '')
    const catalog = claimProductCatalog()
    expect(catalog).toEqual([{ id: 'abc-123', name: 'AI Prompt Arsenal' }])
  })

  it('catalogs both eligible products when both ids are configured', () => {
    vi.stubEnv('GUMROAD_PRODUCT_ID_1', 'abc-123')
    vi.stubEnv('GUMROAD_PRODUCT_ID_2', 'xyz-789')
    expect(claimProductCatalog()).toEqual([
      { id: 'abc-123', name: 'AI Prompt Arsenal' },
      { id: 'xyz-789', name: 'Freelancer OS' },
    ])
  })
})

describe('verifyGumroadLicense (fetch stub)', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    vi.stubEnv('GUMROAD_ACCESS_TOKEN', 'secret-token-12345')
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it('posts product_id + license_key (+ access token) as form fields', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ success: true, purchase: { email: 'Buyer@Example.com', product_id: 'pid-1' } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    const result = await verifyGumroadLicense('KEY-1234', 'pid-1')

    expect(result.ok).toBe(true)
    expect(result.email).toBe('buyer@example.com')
    expect(result.productId).toBe('pid-1')

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, { body: URLSearchParams }]
    expect(url).toBe('https://api.gumroad.com/v2/licenses/verify')
    expect(init.body.get('product_id')).toBe('pid-1')
    expect(init.body.get('license_key')).toBe('KEY-1234')
    // The wire path must read the access token from env, never print it.
    expect(init.body.get('access_token')).toBe('secret-token-12345')
    expect(init).toHaveProperty('signal') // bounded timeout
  })

  it('returns ok:false on transport failure', async () => {
    fetchMock.mockRejectedValue(new Error('network down'))
    await expect(verifyGumroadLicense('KEY', 'pid')).resolves.toEqual({ ok: false })
  })

  it('returns ok:false on non-200', async () => {
    fetchMock.mockResolvedValue(new Response('{}', { status: 500 }))
    await expect(verifyGumroadLicense('KEY', 'pid')).resolves.toEqual({ ok: false })
  })

  it('returns ok:false on Gumroad success:false', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ success: false, message: 'That license key does not exist.' }), { status: 200 }))
    await expect(verifyGumroadLicense('KEY', 'pid')).resolves.toEqual({ ok: false })
  })

  it('surfaces refunded/disputed purchase flags', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ success: true, purchase: { email: 'a@b.co', product_id: 'pid', refunded: true, disputed: false } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    const result = await verifyGumroadLicense('KEY', 'pid')
    expect(result.ok).toBe(true)
    expect(result.refunded).toBe(true)
    expect(result.disputed).toBe(false)
  })
})

describe('readClaimGrantInfo / resolveEffectivePlan (day-31 policy)', () => {
  const future = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString()
  const future25d = new Date(Date.now() + 25 * 24 * 60 * 60 * 1000).toISOString()
  const past = new Date(Date.now() - 60_000).toISOString()
  const settingsWithGrant = (expiresAt: string) => ({ grant: { plan: 'pro', expiresAt } })

  it('treats an active grant as its plan tier', () => {
    const info = readClaimGrantInfo(settingsWithGrant(future))
    expect(info?.active).toBe(true)
    expect(info?.daysLeft).toBeGreaterThan(0)
    expect(resolveEffectivePlan({ plan: 'pro', settings: settingsWithGrant(future) }).plan).toBe('pro')
  })

  it('lazily falls back to Free on expiration when no Stripe tier grants', () => {
    const expiry = resolveEffectivePlan({ plan: 'pro', settings: settingsWithGrant(past) })
    expect(expiry.grantExpired).toBe(true)
    expect(expiry.plan).toBe('free')
  })

  it('keeps a paid subscriber tier even after a promo grant expires', () => {
    const expiry = resolveEffectivePlan({
      plan: 'pro',
      settings: settingsWithGrant(past),
      stripeSubscriptionStatus: 'active',
    })
    expect(expiry.plan).toBe('pro')
    expect(expiry.grantExpired).toBe(true)
  })

  it('returns null info for orgs with no grant settings', () => {
    expect(readClaimGrantInfo(null)).toBeNull()
    expect(readClaimGrantInfo({})).toBeNull()
    expect(readClaimGrantInfo({ grant: 'not-an-object' })).toBeNull()
  })

  it('exposes the day-21 nudge seam', () => {
    // 25 days out → banner due (nudgeAt = 4); at 10 days it stays 0. The
    // clamp is deliberate: past day-21 there is nothing to nudge toward.
    const info = readClaimGrantInfo({ grant: { plan: 'pro', expiresAt: future25d } })!
    expect(info.nudgeAt).toBe(4)
    const nearEnd = readClaimGrantInfo({ grant: { plan: 'pro', expiresAt: future } })!
    expect(nearEnd.nudgeAt).toBe(0)
    expect(CLAIM_GRANT_WINDOW_DAYS).toBe(30)
  })
})

describe('decodeClaimToken', () => {
  it('accepts a server-issued grant id (opaque handle, not the key)', () => {
    const token = 'cmxxxxxxx000000000000001'
    expect(decodeClaimToken(token)).toBe(token)
  })

  it('returns null for empty / garbage / short / wrong-shape tokens', () => {
    expect(decodeClaimToken(undefined)).toBeNull()
    expect(decodeClaimToken('')).toBeNull()
    expect(decodeClaimToken('not-a-cuid')).toBeNull()
    expect(decodeClaimToken('a'.repeat(5))).toBeNull()
    expect(decodeClaimToken('A1B2C3D4-E5F60718-9ABCDEF0-1234ABCD')).toBeNull()
    // A base64 key envelope is NO LONGER a valid token — the server-issued id
    // replaced it, so the raw license key never travels through a URL (cubic
    // P2 round 1).
    const oldEnvelope = Buffer.from(JSON.stringify({ licenseKey: 'KEY-1234-5678' })).toString('base64')
    expect(decodeClaimToken(oldEnvelope)).toBeNull()
  })
})
