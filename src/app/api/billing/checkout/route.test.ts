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
import { stripe, stripeActive, stripeMode } from '@/lib/billing/stripe'
import { db } from '@/lib/db'
import { POST } from './route'

const mockSession = getServerSession as unknown as ReturnType<typeof vi.fn>
const mockStripe = stripe as unknown as ReturnType<typeof vi.fn>
const mockActive = stripeActive as unknown as ReturnType<typeof vi.fn>
const mockMode = stripeMode as unknown as ReturnType<typeof vi.fn>
const mockFindOrg = db.organization.findUnique as unknown as ReturnType<typeof vi.fn>
const mockUpdateOrg = db.organization.update as unknown as ReturnType<typeof vi.fn>

function post(body: unknown) {
  return new Request('http://localhost/api/billing/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

function buildStripeClient() {
  const customersCreate = vi.fn().mockResolvedValue({ id: 'cus_new' })
  const sessionsCreate = vi.fn().mockResolvedValue({ url: 'https://checkout.stripe.com/c/pay/abc' })
  const client = {
    customers: { create: customersCreate },
    checkout: { sessions: { create: sessionsCreate } },
  }
  return { client, customersCreate, sessionsCreate }
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
    mockMode.mockReturnValue('off')
    mockFindOrg.mockResolvedValue({
      stripeCustomerId: null,
      stripeSubscriptionId: null,
      stripeSubscriptionStatus: null,
      settings: null,
    })
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

  it('returns 409 when the org already has a live subscription', async () => {
    mockActive.mockReturnValue(true)
    mockMode.mockReturnValue('test')
    const { client, customersCreate, sessionsCreate } = buildStripeClient()
    mockStripe.mockReturnValue(client)
    mockFindOrg.mockResolvedValue({
      stripeCustomerId: 'cus_existing',
      stripeSubscriptionId: 'sub_existing',
      stripeSubscriptionStatus: 'active',
      settings: { stripeCustomers: { test: 'cus_existing' } },
    })

    const response = await POST(post({ planId: 'pro', interval: 'monthly' }))
    const json = await response.json()
    expect(response.status).toBe(409)
    expect(json.error).toContain('already has an active subscription')
    // The whole point of the guard: no second session, no second customer.
    expect(sessionsCreate).not.toHaveBeenCalled()
    expect(customersCreate).not.toHaveBeenCalled()
  })

  it('allows re-checkout after an incomplete_expired (never-billed) subscription', async () => {
    mockActive.mockReturnValue(true)
    mockMode.mockReturnValue('test')
    const { client, customersCreate, sessionsCreate } = buildStripeClient()
    mockStripe.mockReturnValue(client)
    mockFindOrg.mockResolvedValue({
      stripeCustomerId: 'cus_existing',
      stripeSubscriptionId: 'sub_expired',
      stripeSubscriptionStatus: 'incomplete_expired',
      settings: { stripeCustomers: { test: 'cus_existing' } },
    })

    const response = await POST(post({ planId: 'pro', interval: 'monthly' }))
    expect(response.status).toBe(200)
    expect(sessionsCreate).toHaveBeenCalledTimes(1)
    expect(customersCreate).not.toHaveBeenCalled()
  })

  it('backfills a legacy stripeCustomerId into the per-mode map instead of orphaning it', async () => {
    mockActive.mockReturnValue(true)
    mockMode.mockReturnValue('test')
    const { client, customersCreate, sessionsCreate } = buildStripeClient()
    mockStripe.mockReturnValue(client)
    mockFindOrg.mockResolvedValue({
      stripeCustomerId: 'cus_legacy',
      stripeSubscriptionId: null,
      stripeSubscriptionStatus: null,
      settings: null,
    })

    const response = await POST(post({ planId: 'pro', interval: 'monthly' }))
    expect(response.status).toBe(200)
    expect(customersCreate).not.toHaveBeenCalled()
    expect(sessionsCreate.mock.calls[0]![0]).toMatchObject({ customer: 'cus_legacy' })
    expect(mockUpdateOrg).toHaveBeenCalledWith({
      where: { id: 'org_1' },
      data: expect.objectContaining({
        settings: expect.objectContaining({
          stripeCustomers: { test: 'cus_legacy' },
        }),
      }),
    })
  })

  it('returns a checkout URL when test mode and price are configured, pinned to the env-price contract', async () => {
    mockActive.mockReturnValue(true)
    mockMode.mockReturnValue('test')
    const { client, customersCreate, sessionsCreate } = buildStripeClient()
    mockStripe.mockReturnValue(client)

    const response = await POST(post({ planId: 'pro', interval: 'monthly' }))
    const json = await response.json()
    expect(response.status).toBe(200)
    expect(json.status).toBe('checkout')
    expect(json.url).toContain('checkout.stripe.com')

    // Contract pinning (cubic P2 — the route must use the env-owned price,
    // pass org/plan metadata, and persist the customer it created).
    expect(sessionsCreate).toHaveBeenCalledTimes(1)
    const sessionArgs = sessionsCreate.mock.calls[0]![0] as Record<string, unknown>
    expect(sessionArgs.mode).toBe('subscription')
    expect(sessionArgs.line_items).toEqual([{ price: 'price_pro_test', quantity: 1 }])
    expect(sessionArgs.metadata).toMatchObject({ organizationId: 'org_1', planId: 'pro' })
    const subData = sessionArgs.subscription_data as Record<string, unknown>
    expect(subData.metadata).toMatchObject({ organizationId: 'org_1', planId: 'pro' })

    expect(customersCreate).toHaveBeenCalledTimes(1)
    expect(customersCreate).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'a@b.co', metadata: { organizationId: 'org_1' } }),
    )
    // The new customer is persisted + namespaced per Stripe mode (test/live separation).
    expect(mockUpdateOrg).toHaveBeenCalledWith({
      where: { id: 'org_1' },
      data: expect.objectContaining({
        stripeCustomerId: 'cus_new',
        settings: expect.objectContaining({
          stripeCustomers: { test: 'cus_new' },
        }),
      }),
    })
  })

  it('reuses an existing per-mode customer instead of creating a second one', async () => {
    mockActive.mockReturnValue(true)
    mockMode.mockReturnValue('test')
    const { client, customersCreate, sessionsCreate } = buildStripeClient()
    mockStripe.mockReturnValue(client)
    mockFindOrg.mockResolvedValue({
      stripeCustomerId: 'cus_existing',
      stripeSubscriptionId: null,
      stripeSubscriptionStatus: null,
      settings: { stripeCustomers: { test: 'cus_existing' } },
    })

    const response = await POST(post({ planId: 'pro', interval: 'monthly' }))
    expect(response.status).toBe(200)
    expect(customersCreate).not.toHaveBeenCalled()
    expect(sessionsCreate.mock.calls[0]![0]).toMatchObject({ customer: 'cus_existing' })
    expect(mockUpdateOrg).not.toHaveBeenCalled()
  })
})
