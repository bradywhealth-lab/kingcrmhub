import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/db', () => ({
  db: {
    organization: {
      update: vi.fn(),
      findUnique: vi.fn(),
    },
  },
}))

import { db } from '@/lib/db'
import {
  planIdFromSubscription,
  subscriptionEntitles,
  syncSubscriptionToOrg,
  orgEntitled,
} from './subscription'

const mockUpdate = db.organization.update as unknown as ReturnType<typeof vi.fn>
const mockFind = db.organization.findUnique as unknown as ReturnType<typeof vi.fn>

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
    mockFind.mockResolvedValue({
      stripeSubscriptionId: 'sub_123',
      stripeSubscriptionStatus: 'active',
      planUpdatedAt: new Date(1700000001 * 1000),
    })
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
      // Restore unset vars to unset — assigning undefined creates the string
      // "undefined" and pollutes later tests in the same worker.
      if (previous[0] === undefined) delete process.env.STRIPE_PRICE_PRO_MONTHLY
      else process.env.STRIPE_PRICE_PRO_MONTHLY = previous[0]
      if (previous[1] === undefined) delete process.env.STRIPE_PRICE_STUDIO_MONTHLY
      else process.env.STRIPE_PRICE_STUDIO_MONTHLY = previous[1]
      if (previous[2] === undefined) delete process.env.STRIPE_PRICE_ELITE_MONTHLY
      else process.env.STRIPE_PRICE_ELITE_MONTHLY = previous[2]
    }
  })

  it('gates entitlement on trialing/active status only', () => {
    expect(subscriptionEntitles('trialing')).toBe(true)
    expect(subscriptionEntitles('active')).toBe(true)
    expect(subscriptionEntitles('past_due')).toBe(false)
    expect(subscriptionEntitles('unpaid')).toBe(false)
    expect(subscriptionEntitles('canceled')).toBe(false)
    expect(subscriptionEntitles('incomplete')).toBe(false)
    expect(subscriptionEntitles('incomplete_expired')).toBe(false)
    expect(subscriptionEntitles('paused')).toBe(false)
    expect(subscriptionEntitles('weird')).toBe(false)
    expect(subscriptionEntitles(null)).toBe(false)
  })

  it('writes plan + subscription state idempotently when entitled', async () => {
    mockUpdate.mockResolvedValue({ plan: 'pro', status: 'active' })
    const result = await syncSubscriptionToOrg({
      organizationId: 'org_1',
      stripeCustomerId: 'cus_123',
      stripeSubscriptionId: 'sub_123',
      stripeSubscriptionStatus: 'active',
      planId: 'pro',
      eventCreatedAtSec: 1700000002,
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
    expect(result.applied).toBe(true)
  })

  it('keeps current plan when the subscription price is unknown but status is entitled', async () => {
    mockUpdate.mockResolvedValue({ plan: 'free', status: 'active' })
    const result = await syncSubscriptionToOrg({
      organizationId: 'org_1',
      stripeCustomerId: 'cus_123',
      stripeSubscriptionId: 'sub_123',
      stripeSubscriptionStatus: 'active',
      planId: null,
      eventCreatedAtSec: 1700000002,
    })

    const call = mockUpdate.mock.calls[0]?.[0] as { data: Record<string, unknown> }
    expect(call.data.plan).toBeUndefined()
    expect(result.planId).toBe('free')
  })

  it('fails closed: unknown status is stored as-is but never grants the plan', async () => {
    mockFind.mockResolvedValue({
      stripeSubscriptionId: 'sub_1',
      stripeSubscriptionStatus: 'active',
      planUpdatedAt: new Date(1700000001 * 1000),
    })
    mockUpdate.mockResolvedValue({ plan: 'free', status: 'unknown' })
    const result = await syncSubscriptionToOrg({
      organizationId: 'org_1',
      stripeCustomerId: 'cus_1',
      stripeSubscriptionId: 'sub_1',
      stripeSubscriptionStatus: 'weird',
      planId: 'starter',
      eventCreatedAtSec: 1700000002,
    })
    const call = mockUpdate.mock.calls[0]?.[0] as { data: Record<string, unknown> }
    expect(call.data.stripeSubscriptionStatus).toBe('unknown')
    expect(call.data.plan).toBeUndefined()
    expect(result.status).toBe('unknown')
    expect(result.applied).toBe(true)
  })

  it('fails closed: incomplete status does not set the paid plan', async () => {
    mockFind.mockResolvedValue({
      stripeSubscriptionId: 'sub_1',
      stripeSubscriptionStatus: 'active',
      planUpdatedAt: new Date(1700000001 * 1000),
    })
    mockUpdate.mockResolvedValue({ plan: 'free', status: 'incomplete' })
    await syncSubscriptionToOrg({
      organizationId: 'org_1',
      stripeCustomerId: 'cus_1',
      stripeSubscriptionId: 'sub_1',
      stripeSubscriptionStatus: 'incomplete',
      planId: 'starter',
      eventCreatedAtSec: 1700000002,
    })
    const call = mockUpdate.mock.calls[0]?.[0] as { data: Record<string, unknown> }
    expect(call.data.stripeSubscriptionStatus).toBe('incomplete')
    expect(call.data.plan).toBeUndefined()
  })

  it('ignores events for a subscription that is no longer the org current one', async () => {
    mockFind.mockResolvedValue({
      stripeSubscriptionId: 'sub_NEW',
      stripeSubscriptionStatus: 'active',
      planUpdatedAt: new Date(1700000001 * 1000),
    })
    const result = await syncSubscriptionToOrg({
      organizationId: 'org_1',
      stripeCustomerId: 'cus_1',
      stripeSubscriptionId: 'sub_OLD',
      stripeSubscriptionStatus: 'canceled',
      planId: null,
      eventCreatedAtSec: 1700000003,
    })
    expect(mockUpdate).not.toHaveBeenCalled()
    expect(result.applied).toBe(false)
  })

  it('ignores out-of-order events older than the last applied state', async () => {
    mockFind.mockResolvedValue({
      stripeSubscriptionId: 'sub_1',
      stripeSubscriptionStatus: 'active',
      planUpdatedAt: new Date(1700000005 * 1000),
    })
    const result = await syncSubscriptionToOrg({
      organizationId: 'org_1',
      stripeCustomerId: 'cus_1',
      stripeSubscriptionId: 'sub_1',
      stripeSubscriptionStatus: 'canceled',
      planId: null,
      eventCreatedAtSec: 1700000001,
    })
    expect(mockUpdate).not.toHaveBeenCalled()
    expect(result.applied).toBe(false)
  })

  it('free orgs are always entitled; paid orgs need active subscription', () => {
    expect(orgEntitled('free', null)).toBe(true)
    expect(orgEntitled('starter', 'active')).toBe(true)
    expect(orgEntitled('starter', 'trialing')).toBe(true)
    expect(orgEntitled('starter', 'past_due')).toBe(false)
    expect(orgEntitled('pro', 'canceled')).toBe(false)
    expect(orgEntitled('pro', 'incomplete')).toBe(false)
    expect(orgEntitled(null, null)).toBe(true)
  })
})
