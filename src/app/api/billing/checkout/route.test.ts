import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('next-auth', () => ({
  getServerSession: vi.fn(),
}))

vi.mock('@/lib/next-auth', () => ({
  buildNextAuthOptions: vi.fn(() => ({})),
}))

vi.mock('@/lib/billing/stripe', () => ({
  stripe: vi.fn(),
  stripeActive: vi.fn(),
  stripePriceId: vi.fn((key: string) => (key.startsWith('STRIPE_PRICE_') ? 'price_pro_test' : null)),
  stripeMode: vi.fn(() => 'off'),
}))

vi.mock('@/lib/db', () => ({
  db: {
    organization: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
  withOrgRlsTransaction: vi.fn(async (_orgId: string, cb: () => Promise<unknown>) => cb()),
}))

import { getServerSession } from 'next-auth'
import { stripe, stripeActive } from '@/lib/billing/stripe'
import { db } from '@/lib/db'
import { POST } from './route'

const mockSession = getServerSession as unknown as ReturnType<typeof vi.fn>
const mockStripe = stripe as unknown as ReturnType<typeof vi.fn>
const mockActive = stripeActive as unknown as ReturnType<typeof vi.fn>
const mockFindOrg = db.organization.findUnique as unknown as ReturnType<typeof vi.fn>
const mockUpdateOrg = db.organization.update as unknown as ReturnType<typeof vi.fn>

function post(body: unknown) {
  return new Request('http://localhost/api/billing/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

describe('/api/billing/checkout — honest gate + real checkout when configured', () => {
  const previousBaseUrl = process.env.APP_BASE_URL

  beforeEach(() => {
    vi.clearAllMocks()
    process.env.APP_BASE_URL = 'http://localhost:3000'
    mockSession.mockResolvedValue({
      user: { id: 'u1', email: 'a@b.co', organizationId: 'org_1' },
    })
    mockStripe.mockReturnValue(null)
    mockActive.mockReturnValue(false)
    mockFindOrg.mockResolvedValue({ stripeCustomerId: null })
    mockUpdateOrg.mockResolvedValue({})
  })

  afterEach(() => {
    if (previousBaseUrl === undefined) delete process.env.APP_BASE_URL
    else process.env.APP_BASE_URL = previousBaseUrl
  })

  it('rejects unauthenticated callers with 401', async () => {
    mockSession.mockResolvedValueOnce(null)
    const response = await POST(post({ planId: 'pro', interval: 'monthly' }))
    expect(response.status).toBe(401)
  })

  it('returns honest coming_soon when billing is off (no charge possible)', async () => {
    const response = await POST(post({ planId: 'pro', interval: 'monthly' }))
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.status).toBe('coming_soon')
    expect(json.url).toBeNull()
    expect(json.message).toContain('not active yet')
  })

  it('400s on malformed JSON, missing fields, year-only interval, and unknown plans', async () => {
    expect((await POST(post('{oops'))).status).toBe(400)
    expect((await POST(post({ planId: 'pro' }))).status).toBe(400)
    expect((await POST(post({ planId: 'pro', interval: 'yearly' }))).status).toBe(400)
    expect((await POST(post({ planId: 'hacked', interval: 'monthly' }))).status).toBe(400)
    expect((await POST(post({ planId: 'free', interval: 'monthly' }))).status).toBe(400)
  })

  it('returns a checkout URL when test mode and price are configured', async () => {
    mockActive.mockReturnValue(true)
    mockStripe.mockReturnValue({
      customers: {
        create: vi.fn().mockResolvedValue({ id: 'cus_new' }),
      },
      checkout: {
        sessions: {
          create: vi.fn().mockResolvedValue({ url: 'https://checkout.stripe.com/c/pay/abc' }),
        },
      },
    })

    const response = await POST(post({ planId: 'pro', interval: 'monthly' }))
    const json = await response.json()
    expect(response.status).toBe(200)
    expect(json.status).toBe('checkout')
    expect(json.url).toContain('checkout.stripe.com')
  })
})
