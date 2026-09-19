import { beforeEach, describe, expect, it, vi } from 'vitest'

const constructEvent = vi.fn()

vi.mock('@/lib/billing/stripe', () => ({
  stripe: vi.fn(() => ({
    webhooks: {
      constructEvent: (body: string, sig: string, secret: string) => constructEvent(body, sig, secret),
    },
  })),
  stripeWebhookSecret: vi.fn(() => 'whsec_test'),
  stripeMode: vi.fn(() => 'test'),
}))

vi.mock('@/lib/db', () => ({
  db: {
    organization: {
      update: vi.fn(),
    },
  },
  withOrgRlsTransaction: vi.fn(async (_orgId: string, cb: () => Promise<unknown>) => cb()),
}))

import { POST } from './route'
import { db } from '@/lib/db'

const mockUpdate = db.organization.update as unknown as ReturnType<typeof vi.fn>

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
    constructEvent.mockImplementation((body: string) => {
      const parsed = JSON.parse(body)
      if (signatureThrows) throw new Error('bad signature')
      return parsed
    })
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

  it('sets org plan on checkout.session.completed', async () => {
    mockUpdate.mockResolvedValue({})
    const event = {
      id: 'evt_1',
      type: 'checkout.session.completed',
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
        stripeSubscriptionStatus: 'active',
        plan: 'pro',
      }),
    })
  })

  it('syncs plan change on customer.subscription.updated', async () => {
    mockUpdate.mockResolvedValue({ plan: 'enterprise', status: 'active' })
    const previous = process.env.STRIPE_PRICE_ELITE_MONTHLY
    process.env.STRIPE_PRICE_ELITE_MONTHLY = 'price_elite_test'
    try {
      const event = {
        id: 'evt_2',
        type: 'customer.subscription.updated',
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
      process.env.STRIPE_PRICE_ELITE_MONTHLY = previous
    }
  })

  it('marks canceled on customer.subscription.deleted without changing plan', async () => {
    mockUpdate.mockResolvedValue({ plan: 'starter', status: 'canceled' })
    const event = {
      id: 'evt_3',
      type: 'customer.subscription.deleted',
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
