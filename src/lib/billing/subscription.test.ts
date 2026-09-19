import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/db', () => ({
  db: {
    organization: {
      update: vi.fn(),
    },
  },
}))

import { db } from '@/lib/db'
import {
  planIdFromSubscription,
  subscriptionEntitles,
  syncSubscriptionToOrg,
  clearSubscriptionFromOrg,
  orgEntitled,
} from './subscription'

const mockUpdate = db.organization.update as unknown as ReturnType<typeof vi.fn>

function subscriptionWithPrice(priceId: string | null) {
  return {
    id: 'sub_123',
    status: 'active',
    customer: 'cus_123',
    items: { data: [{ price: priceId ? { id: priceId } : {} }] },
  } as unknown as Parameters<typeof planIdFromSubscription>[0]
}

describe('subscription -> org plan sync', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('maps Stripe price IDs to stored plan IDs via env (reconciled vocabulary)', () => {
    const previous = [
      process.env.STRIPE_PRICE_PRO_MONTHLY,
      process.env.STRIPE_PRICE_STUDIO_MONTHLY,
      process.env.STRIPE_PRICE_ELITE_MONTHLY,
    ]
    try {
      process.env.STRIPE_PRICE_PRO_MONTHLY = 'price_pro_test'
      process.env.STRIPE_PRICE_STUDIO_MONTHLY = 'price_studio_test'
      process.env.STRIPE_PRICE_ELITE_MONTHLY = 'price_elite_test'

      expect(planIdFromSubscription(subscriptionWithPrice('price_pro_test'))).toBe('starter')
      expect(planIdFromSubscription(subscriptionWithPrice('price_studio_test'))).toBe('pro')
      expect(planIdFromSubscription(subscriptionWithPrice('price_elite_test'))).toBe('enterprise')
      expect(planIdFromSubscription(subscriptionWithPrice('price_unknown'))).toBeNull()
      expect(planIdFromSubscription(subscriptionWithPrice(null))).toBeNull()
    } finally {
      process.env.STRIPE_PRICE_PRO_MONTHLY = previous[0]
      process.env.STRIPE_PRICE_STUDIO_MONTHLY = previous[1]
      process.env.STRIPE_PRICE_ELITE_MONTHLY = previous[2]
    }
  })

  it('gates entitlement on trialing/active status only', () => {
    expect(subscriptionEntitles('trialing')).toBe(true)
    expect(subscriptionEntitles('active')).toBe(true)
    expect(subscriptionEntitles('past_due')).toBe(false)
    expect(subscriptionEntitles('unpaid')).toBe(false)
    expect(subscriptionEntitles('canceled')).toBe(false)
    expect(subscriptionEntitles(null)).toBe(false)
  })

  it('writes plan + subscription state idempotently', async () => {
    mockUpdate.mockResolvedValue({ plan: 'pro', status: 'active' })
    const result = await syncSubscriptionToOrg({
      organizationId: 'org_1',
      stripeCustomerId: 'cus_123',
      stripeSubscriptionId: 'sub_123',
      stripeSubscriptionStatus: 'active',
      planId: 'pro',
    })

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 'org_1' },
      data: expect.objectContaining({
        stripeCustomerId: 'cus_123',
        stripeSubscriptionId: 'sub_123',
        stripeSubscriptionStatus: 'active',
        plan: 'pro',
        planUpdatedAt: expect.any(Date),
      }),
    })
    expect(result.planId).toBe('pro')
    expect(result.status).toBe('active')
  })

  it('keeps current plan when the subscription price is unknown', async () => {
    mockUpdate.mockResolvedValue({ plan: 'free', status: 'canceled' })
    const result = await syncSubscriptionToOrg({
      organizationId: 'org_1',
      stripeCustomerId: 'cus_123',
      stripeSubscriptionId: 'sub_123',
      stripeSubscriptionStatus: 'canceled',
      planId: null,
    })

    const call = mockUpdate.mock.calls[0]?.[0] as { data: Record<string, unknown> }
    expect(call.data.plan).toBeUndefined()
    expect(result.planId).toBe('free')
  })

  it('normalizes unknown statuses to active', async () => {
    await syncSubscriptionToOrg({
      organizationId: 'org_1',
      stripeCustomerId: 'cus_1',
      stripeSubscriptionId: 'sub_1',
      stripeSubscriptionStatus: 'weird',
      planId: 'starter',
    })
    const call = mockUpdate.mock.calls[0]?.[0] as { data: Record<string, unknown> }
    expect(call.data.stripeSubscriptionStatus).toBe('active')
  })

  it('clears the subscription link on cancel', async () => {
    await clearSubscriptionFromOrg('org_1', 'sub_123')
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 'org_1' },
      data: expect.objectContaining({
        stripeSubscriptionId: null,
        stripeSubscriptionStatus: 'canceled',
      }),
    })
  })

  it('free orgs are always entitled; paid orgs need active subscription', () => {
    expect(orgEntitled('free', null)).toBe(true)
    expect(orgEntitled('starter', 'active')).toBe(true)
    expect(orgEntitled('starter', 'past_due')).toBe(false)
    expect(orgEntitled('pro', 'canceled')).toBe(false)
    expect(orgEntitled(null, null)).toBe(true)
  })
})
