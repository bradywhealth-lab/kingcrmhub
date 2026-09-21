import { describe, expect, it } from 'vitest'
import {
  activePromoPlan,
  effectivePlanId,
  isPromoActive,
  promoLabel,
  type PromoOrgFields,
} from './promos'

const PLAIN_ORG: PromoOrgFields = { plan: 'free' }
const PRO_ORG: PromoOrgFields = { plan: 'pro' }
const ELITE_ORG: PromoOrgFields = { plan: 'enterprise' }

function promoOrg(
  overrides: Partial<PromoOrgFields> & { expiresAt: Date },
): PromoOrgFields {
  return {
    plan: 'free',
    promoPlanId: 'pro',
    promoPlanExpiresAt: overrides.expiresAt,
    ...overrides,
  }
}

describe('promo entitlement math (Studio promo never touches stored plan)', () => {
  it('has no active promo when promo fields are absent', () => {
    expect(activePromoPlan(PLAIN_ORG)).toBeNull()
    expect(isPromoActive(PLAIN_ORG)).toBe(false)
  })

  it('is active while the expiry timestamp is in the future', () => {
    const org = promoOrg({ expiresAt: new Date(Date.now() + 86_400_000) })
    expect(isPromoActive(org)).toBe(true)
    expect(activePromoPlan(org)).toBe('pro')
  })

  it('expires: no promo once the expiry timestamp passes', () => {
    const org = promoOrg({ expiresAt: new Date(Date.now() - 1_000) })
    expect(isPromoActive(org)).toBe(false)
    expect(activePromoPlan(org)).toBeNull()
  })

  it('treats an unknown promoPlanId as inactive (fail closed)', () => {
    const org: PromoOrgFields = {
      plan: 'free',
      promoPlanId: 'studio', // label leaked through the write boundary — must not grant
      promoPlanExpiresAt: new Date(Date.now() + 86_400_000),
    }
    expect(isPromoActive(org)).toBe(false)
    expect(activePromoPlan(org)).toBeNull()
  })

  it('effective plan falls back to the stored plan when no promo is active', () => {
    expect(effectivePlanId(PLAIN_ORG)).toBe('free')
    expect(effectivePlanId(PRO_ORG)).toBe('pro')
    expect(effectivePlanId(promoOrg({ expiresAt: new Date(Date.now() - 1_000) }))).toBe('free')
  })

  it('effective plan is the promo grant while active', () => {
    const org = promoOrg({ expiresAt: new Date(Date.now() + 86_400_000) })
    expect(effectivePlanId(org)).toBe('pro')
  })

  it('effective plan never DROPS someone below their stored paid plan', () => {
    const org = promoOrg({ plan: 'enterprise', expiresAt: new Date(Date.now() + 86_400_000) })
    expect(effectivePlanId(org)).toBe('enterprise')
  })

  it('promo label is the customer-facing Studio name, never a bare plan id', () => {
    expect(promoLabel('pro')).toBe('Studio')
    expect(promoLabel('enterprise')).toBe('Elite')
    expect(promoLabel('studio')).toBeNull()
  })
})
