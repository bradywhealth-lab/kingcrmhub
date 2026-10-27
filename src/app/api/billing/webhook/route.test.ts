import { beforeEach, describe, expect, it, vi } from 'vitest'

const constructEvent = vi.fn()

vi.mock('@/lib/billing/stripe', () => ({
  stripe: vi.fn(),
  stripeWebhookSecret: vi.fn(),
  stripeWebhookSecretTest: vi.fn(),
  stripeMode: vi.fn(() => 'test'),
}))

vi.mock('@/lib/db', () => ({
  db: {
    organization: {
      update: vi.fn(),
      findUnique: vi.fn(),
    },
  },
  withOrgRlsTransaction: vi.fn(async (_orgId: string, cb: () => Promise<unknown>) => cb()),
}))

import { POST } from './route'
import { stripe, stripeWebhookSecret, stripeWebhookSecretTest, stripeMode } from '@/lib/billing/stripe'
import { db } from '@/lib/db'

const mockStripeClient = stripe as unknown as ReturnType<typeof vi.fn>
const mockSecret = stripeWebhookSecret as unknown as ReturnType<typeof vi.fn>
const mockSecretTest = stripeWebhookSecretTest as unknown as ReturnType<typeof vi.fn>
const mockMode = stripeMode as unknown as ReturnType<typeof vi.fn>
const mockUpdate = db.organization.update as unknown as ReturnType<typeof vi.fn>
const mockFind = db.organization.findUnique as unknown as ReturnType<typeof vi.fn>

// Signature verification failure path controlled via a shared flag.
let signatureThrows = false

function webhookRequest(event: unknown, signature = 'test-sig') {
  return new Request('http://localhost/api/billing/webhook', {
    method: 'POST',
    headers: { 'stripe-signature': signature, 'content-type': 'application/json' },
    body: JSON.stringify(event),
  })
}

describe('/api/billing/webhook — subscription lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    signatureThrows = false
    mockMode.mockReturnValue('test')
    mockSecret.mockReturnValue('whsec_test')
    // The subscription sync reads the org's current subscription state to
    // guard stale/out-of-order events — default to a matching current state.
    mockFind.mockResolvedValue({
      stripeSubscriptionId: 'sub_1',
      stripeSubscriptionStatus: 'active',
      planUpdatedAt: new Date(1699999999 * 1000),
    })
    mockStripeClient.mockReturnValue({
      webhooks: {
        constructEvent: (body: string, sig: string, secret: string) => constructEvent(body, sig, secret),
      },
    })
    constructEvent.mockImplementation((body: string) => {
      const parsed = JSON.parse(body)
      if (signatureThrows) throw new Error('bad signature')
      return parsed
    })
  })

  it('acknowledges with 200 and performs no DB writes when billing is off (default state)', async () => {
    mockStripeClient.mockReturnValue(null)
    mockSecret.mockReturnValue(null)
    mockSecretTest.mockReturnValue(null)
    const res = await POST(webhookRequest({ id: 'evt_off', type: 'customer.subscription.updated' }))
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ received: true })
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('acknowledges with 200 and performs no DB writes when live keys lack activation', async () => {
    mockStripeClient.mockReturnValue(null)
    mockMode.mockReturnValue('live')
    const res = await POST(webhookRequest({ id: 'evt_live', type: 'customer.subscription.updated' }))
    expect(res.status).toBe(200)
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('rejects requests without a stripe-signature header', async () => {
    const res = await POST(new Request('http://localhost/api/billing/webhook', {
      method: 'POST',
      body: '{}',
    }))
    expect(res.status).toBe(400)
  })

  it('rejects unverifiable signatures with 400', async () => {
    signatureThrows = true
    const res = await POST(webhookRequest({ type: 'checkout.session.completed' }))
    expect(res.status).toBe(400)
  })

  it('accepts a valid test-endpoint signature by falling back to STRIPE_WEBHOOK_SECRET_TEST', async () => {
    // Each Stripe webhook endpoint has its OWN signing secret: test-mode
    // deliveries are signed with the test endpoint's whsec_, which never
    // matches the primary secret. The route must try the primary secret
    // first, then fall back to the test secret, and accept the delivery.
    mockSecret.mockReturnValue('whsec_primary')
    mockSecretTest.mockReturnValue('whsec_test_endpoint')
    constructEvent.mockImplementation((body: string, _sig: string, secret: string) => {
      if (secret !== 'whsec_test_endpoint') {
        throw new Error('No signatures found matching the expected signature.')
      }
      return JSON.parse(body)
    })
    const res = await POST(webhookRequest({ id: 'evt_test_sig', type: 'invoice.paid' }))
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ received: true })
    expect(mockUpdate).not.toHaveBeenCalled()
    // Primary attempted first, then the test endpoint secret.
    const attemptedSecrets = constructEvent.mock.calls.map((call) => call[2])
    expect(attemptedSecrets).toEqual(['whsec_primary', 'whsec_test_endpoint'])
  })

  it('accepts a test-endpoint signature when only STRIPE_WEBHOOK_SECRET_TEST is configured', async () => {
    // Test-only configuration (no primary secret): the single configured
    // secret must be attempted — and accepted — on its own.
    mockSecret.mockReturnValue(null)
    mockSecretTest.mockReturnValue('whsec_test_endpoint')
    constructEvent.mockImplementation((body: string, _sig: string, secret: string) => {
      if (secret !== 'whsec_test_endpoint') {
        throw new Error('No signatures found matching the expected signature.')
      }
      return JSON.parse(body)
    })
    const res = await POST(webhookRequest({ id: 'evt_test_only', type: 'invoice.paid', livemode: false }))
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ received: true })
    expect(constructEvent.mock.calls.map((call) => call[2])).toEqual(['whsec_test_endpoint'])
  })

  it('rejects with 400 when neither the primary nor the test secret verifies', async () => {
    mockSecret.mockReturnValue('whsec_primary')
    mockSecretTest.mockReturnValue('whsec_test_endpoint')
    constructEvent.mockImplementation(() => {
      throw new Error('No signatures found matching the expected signature.')
    })
    const res = await POST(webhookRequest({ id: 'evt_bad_sig', type: 'invoice.paid' }))
    expect(res.status).toBe(400)
    const attemptedSecrets = constructEvent.mock.calls.map((call) => call[2])
    expect(attemptedSecrets).toEqual(['whsec_primary', 'whsec_test_endpoint'])
  })

  it('returns 400 when the client is configured but no signing secret is set (signature present)', async () => {
    // Billing client active + signature header + zero configured secrets:
    // the endpoint must refuse the delivery instead of silently inert-acking,
    // otherwise a dropped secret looks like successful webhook handling.
    mockSecret.mockReturnValue(null)
    mockSecretTest.mockReturnValue(null)
    const res = await POST(webhookRequest({ id: 'evt_no_secret', type: 'invoice.paid' }))
    expect(res.status).toBe(400)
    expect(constructEvent).not.toHaveBeenCalled()
  })

  it('ignores live-mode events delivered while billing runs in test mode', async () => {
    // Mode isolation: a correctly-signed event from the wrong Stripe mode
    // must never touch billing state (200-ack so Stripe stops retrying).
    mockSecret.mockReturnValue('whsec_primary')
    mockSecretTest.mockReturnValue(null)
    const res = await POST(webhookRequest({
      id: 'evt_live_in_test',
      type: 'customer.subscription.updated',
      livemode: true,
      created: 1700000001,
      data: {
        object: {
          id: 'sub_1',
          status: 'active',
          customer: 'cus_1',
          metadata: { organizationId: 'org_1' },
          items: { data: [{ price: { id: 'price_any' } }] },
        },
      },
    }))
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ received: true })
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('ignores test-mode events delivered while billing runs in live mode, even with a valid test-endpoint signature', async () => {
    // The dangerous case: live billing active + both endpoint secrets set.
    // A test checkout.session.completed carrying a real org's metadata must
    // NOT overwrite that org's live customer/subscription IDs.
    mockMode.mockReturnValue('live')
    mockSecret.mockReturnValue('whsec_primary')
    mockSecretTest.mockReturnValue('whsec_test_endpoint')
    constructEvent.mockImplementation((body: string, _sig: string, secret: string) => {
      if (secret !== 'whsec_test_endpoint') {
        throw new Error('No signatures found matching the expected signature.')
      }
      return JSON.parse(body)
    })
    const res = await POST(webhookRequest({
      id: 'evt_test_in_live',
      type: 'checkout.session.completed',
      livemode: false,
      data: {
        object: {
          id: 'cs_test_1',
          metadata: { organizationId: 'org_1' },
          customer: 'cus_test_1',
          subscription: 'sub_test_1',
        },
      },
    }))
    expect(res.status).toBe(200)
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('processes events whose livemode matches the active billing mode', async () => {
    mockUpdate.mockResolvedValue({ plan: 'enterprise', status: 'active' })
    const previous = process.env.STRIPE_PRICE_ELITE_MONTHLY
    process.env.STRIPE_PRICE_ELITE_MONTHLY = 'price_elite_test'
    try {
      const event = {
        id: 'evt_match_mode',
        type: 'customer.subscription.updated',
        livemode: false,
        created: 1700000001,
        data: {
          object: {
            id: 'sub_1',
            status: 'active',
            customer: 'cus_1',
            metadata: { organizationId: 'org_1' },
            items: { data: [{ price: { id: 'price_elite_test' } }] },
          },
        },
      }
      const res = await POST(webhookRequest(event))
      expect(res.status).toBe(200)
      expect(mockUpdate).toHaveBeenCalledWith({
        where: { id: 'org_1' },
        data: expect.objectContaining({ plan: 'enterprise' }),
      })
    } finally {
      if (previous === undefined) delete process.env.STRIPE_PRICE_ELITE_MONTHLY
      else process.env.STRIPE_PRICE_ELITE_MONTHLY = previous
    }
  })

  it('links customer + subscription on checkout.session.completed but does NOT grant the plan', async () => {
    mockUpdate.mockResolvedValue({})
    // No pre-existing granted status — the link write stores 'incomplete'.
    mockFind.mockResolvedValue({
      stripeSubscriptionId: 'sub_1',
      stripeSubscriptionStatus: null,
      planUpdatedAt: new Date(1699999999 * 1000),
    })
    const event = {
      id: 'evt_1',
      type: 'checkout.session.completed',
      created: 1700000000,
      data: {
        object: {
          id: 'cs_1',
          metadata: { organizationId: 'org_1', planId: 'pro' },
          customer: 'cus_1',
          subscription: 'sub_1',
        },
      },
    }
    const res = await POST(webhookRequest(event))
    expect(res.status).toBe(200)
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 'org_1' },
      data: expect.objectContaining({
        stripeCustomerId: 'cus_1',
        stripeSubscriptionId: 'sub_1',
        stripeSubscriptionStatus: 'incomplete',
      }),
    })
    // The paid plan must NOT be set from a checkout session — entitlement is
    // granted only by a verified trialing/active subscription event.
    const call = mockUpdate.mock.calls[0]?.[0] as { data: Record<string, unknown> }
    expect(call.data.plan).toBeUndefined()
  })

  it('preserves an already-granted active status when completion arrives after subscription.created', async () => {
    mockUpdate.mockResolvedValue({})
    mockFind.mockResolvedValue({
      stripeSubscriptionId: 'sub_1',
      stripeSubscriptionStatus: 'active',
      planUpdatedAt: new Date(1699999999 * 1000),
    })
    const event = {
      id: 'evt_1b',
      type: 'checkout.session.completed',
      created: 1700000000,
      data: {
        object: {
          id: 'cs_1',
          metadata: { organizationId: 'org_1', planId: 'pro' },
          customer: 'cus_1',
          subscription: 'sub_1',
        },
      },
    }
    const res = await POST(webhookRequest(event))
    expect(res.status).toBe(200)
    const call = mockUpdate.mock.calls[0]?.[0] as { data: Record<string, unknown> }
    // Stripe emits subscription.created BEFORE checkout.session.completed for
    // instant payments — the link write must never downgrade granted state.
    expect(call.data.stripeSubscriptionStatus).toBe('active')
    expect(call.data.plan).toBeUndefined()
  })

  it('sets org plan on customer.subscription.created when the status is active', async () => {
    // Stripe creates subscriptions directly in active/trialing for instant card
    // payments and may emit ONLY customer.subscription.created — no updated
    // event follows. The plan grant path must cover it or first-time buyers
    // never get entitled (cubic P1 round 2).
    mockUpdate.mockResolvedValue({ plan: 'enterprise', status: 'active' })
    const previous = process.env.STRIPE_PRICE_ELITE_MONTHLY
    process.env.STRIPE_PRICE_ELITE_MONTHLY = 'price_elite_test'
    try {
      const event = {
        id: 'evt_2c',
        type: 'customer.subscription.created',
        created: 1700000001,
        data: {
          object: {
            id: 'sub_1',
            status: 'active',
            customer: 'cus_1',
            metadata: { organizationId: 'org_1' },
            items: { data: [{ price: { id: 'price_elite_test' } }] },
          },
        },
      }
      const res = await POST(webhookRequest(event))
      expect(res.status).toBe(200)
      expect(mockUpdate).toHaveBeenCalledWith({
        where: { id: 'org_1' },
        data: expect.objectContaining({
          stripeSubscriptionId: 'sub_1',
          stripeSubscriptionStatus: 'active',
          plan: 'enterprise',
        }),
      })
    } finally {
      if (previous === undefined) delete process.env.STRIPE_PRICE_ELITE_MONTHLY
      else process.env.STRIPE_PRICE_ELITE_MONTHLY = previous
    }
  })

  it('ignores stale- or out-of-order subscription events without DB writes', async () => {
    // Guard negative paths: an event for a subscription that is no longer the
    // org's current one (or older than the last applied state) must never
    // overwrite org state, and must still acknowledge with 200.
    mockFind.mockResolvedValue({
      stripeSubscriptionId: 'sub_NEWER',
      stripeSubscriptionStatus: 'active',
      planUpdatedAt: new Date(1700000010 * 1000),
    })
    const event = {
      id: 'evt_stale',
      type: 'customer.subscription.updated',
      created: 1700000001,
      data: {
        object: {
          id: 'sub_OLD',
          status: 'canceled',
          customer: 'cus_1',
          metadata: { organizationId: 'org_1' },
          items: { data: [{ price: { id: 'price_any' } }] },
        },
      },
    }
    const res = await POST(webhookRequest(event))
    expect(res.status).toBe(200)
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('sets org plan on customer.subscription.updated when the status is active', async () => {
    mockUpdate.mockResolvedValue({ plan: 'enterprise', status: 'active' })
    const previous = process.env.STRIPE_PRICE_ELITE_MONTHLY
    process.env.STRIPE_PRICE_ELITE_MONTHLY = 'price_elite_test'
    try {
      const event = {
        id: 'evt_2',
        type: 'customer.subscription.updated',
        created: 1700000001,
        data: {
          object: {
            id: 'sub_1',
            status: 'active',
            customer: 'cus_1',
            metadata: { organizationId: 'org_1' },
            items: { data: [{ price: { id: 'price_elite_test' } }] },
          },
        },
      }
      const res = await POST(webhookRequest(event))
      expect(res.status).toBe(200)
      expect(mockUpdate).toHaveBeenCalledWith({
        where: { id: 'org_1' },
        data: expect.objectContaining({
          stripeSubscriptionId: 'sub_1',
          stripeSubscriptionStatus: 'active',
          plan: 'enterprise',
        }),
      })
    } finally {
      if (previous === undefined) delete process.env.STRIPE_PRICE_ELITE_MONTHLY
      else process.env.STRIPE_PRICE_ELITE_MONTHLY = previous
    }
  })

  it('marks canceled on customer.subscription.deleted without changing plan', async () => {
    mockUpdate.mockResolvedValue({ plan: 'starter', status: 'canceled' })
    const event = {
      id: 'evt_3',
      type: 'customer.subscription.deleted',
      created: 1700000002,
      data: {
        object: {
          id: 'sub_1',
          status: 'canceled',
          customer: 'cus_1',
          metadata: { organizationId: 'org_1' },
          items: { data: [{ price: { id: 'price_any' } }] },
        },
      },
    }
    const res = await POST(webhookRequest(event))
    expect(res.status).toBe(200)
    const call = mockUpdate.mock.calls[0]?.[0] as { data: Record<string, unknown> }
    expect(call.data.stripeSubscriptionStatus).toBe('canceled')
    expect(call.data.plan).toBeUndefined()
  })

  it('acks unknown events without DB writes', async () => {
    const res = await POST(webhookRequest({ id: 'evt_x', type: 'invoice.payment_failed' }))
    expect(res.status).toBe(200)
    expect(mockUpdate).not.toHaveBeenCalled()
  })
})
