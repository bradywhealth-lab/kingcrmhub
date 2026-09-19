import { describe, expect, it } from 'vitest'
import { FEATURES, hasEntitlement } from './entitlements'

describe('entitlement gate (canonical rank ladder)', () => {
  it('grants free-tier core features to every stored plan', () => {
    for (const plan of ['free', 'starter', 'pro', 'enterprise']) {
      expect(hasEntitlement(plan, FEATURES.CRM_CORE)).toBe(true)
    }
  })

  it('Pro (starter) unlocks prompts-pro but not studio access', () => {
    expect(hasEntitlement('starter', FEATURES.PROMPTS_PRO)).toBe(true)
    expect(hasEntitlement('starter', FEATURES.PROMPTS_STUDIO)).toBe(false)
    expect(hasEntitlement('starter', FEATURES.STUDIO_ACCESS)).toBe(false)
  })

  it('Studio (pro) unlocks studio access; Elite (enterprise) unlocks elite', () => {
    expect(hasEntitlement('pro', FEATURES.STUDIO_ACCESS)).toBe(true)
    expect(hasEntitlement('pro', FEATURES.ELITE_ACCESS)).toBe(false)
    expect(hasEntitlement('enterprise', FEATURES.ELITE_ACCESS)).toBe(true)
    expect(hasEntitlement('enterprise', FEATURES.PROMPTS_STUDIO)).toBe(true)
  })

  it('denies unknown plans and unknown features', () => {
    expect(hasEntitlement('studio', FEATURES.PRO_ACCESS)).toBe(false)
    expect(hasEntitlement('enterprise', 'not_a_feature' as (typeof FEATURES)['STUDIO_ACCESS'])).toBe(false)
    expect(hasEntitlement(null, FEATURES.PRO_ACCESS)).toBe(false)
  })
})
