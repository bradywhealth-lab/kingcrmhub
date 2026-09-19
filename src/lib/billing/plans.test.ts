import { describe, expect, it } from 'vitest'
import {
  PLANS,
  PAID_PLAN_IDS,
  getPlan,
  isPlanId,
  planAtLeast,
  monthlyPriceCents,
  planIdForStripePrice,
  planLabel,
  STRIPE_PRICE_ENV_KEYS,
} from './plans'

describe('canonical billing catalog (reconciled vocabulary)', () => {
  it('exposes exactly the 4 display tiers with Brady-confirmed monthly pricing', () => {
    const byId = Object.fromEntries(PLANS.map((p) => [p.planId, p]))
    expect(PLANS).toHaveLength(4)
    expect(byId.free?.displayName).toBe('Free')
    expect(byId.free?.monthlyPrice).toBe(0)
    expect(byId.starter?.displayName).toBe('Pro')
    expect(byId.starter?.monthlyPrice).toBe(19)
    expect(byId.pro?.displayName).toBe('Studio')
    expect(byId.pro?.monthlyPrice).toBe(39)
    // Elite changed from $69 -> $59 (Brady-confirmed 2026-09-19).
    expect(byId.enterprise?.displayName).toBe('Elite')
    expect(byId.enterprise?.monthlyPrice).toBe(59)
  })

  it('keeps internal stored plan IDs: free/starter/pro/enterprise', () => {
    expect(PAID_PLAN_IDS).toEqual(['starter', 'pro', 'enterprise'])
    expect(PLANS.map((p) => p.planId)).toEqual(['free', 'starter', 'pro', 'enterprise'])
    expect(isPlanId('starter')).toBe(true)
    expect(isPlanId('pro')).toBe(true)
    expect(isPlanId('enterprise')).toBe(true)
    expect(isPlanId('studio')).toBe(false)
    expect(isPlanId('elite')).toBe(false)
  })

  it('rejects inherited object keys (Map lookup, not object indexing)', () => {
    // Regression pin for the PLAN_BY_ID Map: `value in obj` would accept
    // inherited prototype keys and getPlan would return Object.prototype
    // functions as plan definitions. A refactor back to object indexing
    // must fail CI.
    expect(isPlanId('toString')).toBe(false)
    expect(isPlanId('__proto__')).toBe(false)
    expect(isPlanId('constructor')).toBe(false)
    expect(getPlan('toString')).toBeNull()
    expect(getPlan('__proto__')).toBeNull()
    expect(getPlan('constructor')).toBeNull()
  })

  it('ranks entitlement from free -> enterprise', () => {
    expect(planAtLeast('free', 'free')).toBe(true)
    expect(planAtLeast('free', 'starter')).toBe(false)
    expect(planAtLeast('starter', 'starter')).toBe(true)
    expect(planAtLeast('starter', 'pro')).toBe(false)
    expect(planAtLeast('pro', 'starter')).toBe(true)
    expect(planAtLeast('enterprise', 'enterprise')).toBe(true)
    expect(planAtLeast('unknown', 'free')).toBe(false)
  })

  it('prices paid plans in cents and rejects unknown plans', () => {
    expect(monthlyPriceCents('starter')).toBe(1900)
    expect(monthlyPriceCents('pro')).toBe(3900)
    expect(monthlyPriceCents('enterprise')).toBe(5900)
    expect(monthlyPriceCents('free')).toBe(0)
    // Unknown plan ids must throw — this is the actual rejection path.
    // Anything not in the frozen catalog is a programming error, not a price.
    expect(() => monthlyPriceCents('bogus' as never)).toThrow(/Cannot price unknown plan/)
  })

  it('resolves configured Stripe prices to stored plan IDs (single vocabulary)', () => {
    // Fresh env per case: no price ids configured.
    const previous = Object.fromEntries(STRIPE_PRICE_ENV_KEYS.map((k) => [k, process.env[k]]))
    try {
      for (const key of STRIPE_PRICE_ENV_KEYS) delete process.env[key]
      expect(planIdForStripePrice('price_live_abc')).toBeNull()

      // The single-vocabulary mapping under test must resolve positively:
      // env price -> stored plan id (Pro->starter, Studio->pro, Elite->enterprise).
      process.env.STRIPE_PRICE_PRO_MONTHLY = 'price_pro_test'
      process.env.STRIPE_PRICE_STUDIO_MONTHLY = 'price_studio_test'
      process.env.STRIPE_PRICE_ELITE_MONTHLY = 'price_elite_test'
      expect(planIdForStripePrice('price_pro_test')).toBe('starter')
      expect(planIdForStripePrice('price_studio_test')).toBe('pro')
      expect(planIdForStripePrice('price_elite_test')).toBe('enterprise')
      expect(planIdForStripePrice('price_unmapped')).toBeNull()
    } finally {
      for (const key of STRIPE_PRICE_ENV_KEYS) {
        if (previous[key] === undefined) delete process.env[key]
        else process.env[key] = previous[key]
      }
    }
  })

  it('labels plans with display names and falls back to Free', () => {
    expect(planLabel('starter')).toBe('Pro')
    expect(planLabel('pro')).toBe('Studio')
    expect(planLabel('enterprise')).toBe('Elite')
    expect(planLabel(null)).toBe('Free')
    expect(planLabel('unknown')).toBe('Free')
    expect(getPlan('starter')?.description).toContain('freelancers')
  })
})
