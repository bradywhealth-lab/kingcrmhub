import { planAtLeast, type PlanId } from './plans'

/**
 * Minimal-but-honest entitlement gate.
 *
 * This file is the single documented place feature teams extend. For v1 the
 * gate is deliberately small: `hasEntitlement(org, FEATURE.X)` resolves the
 * org's stored plan (Organization.plan) against a rank table. Subscription
 * liveness (past-due/canceled) is layered by webhook status sync; the
 * combination `orgEntitled` + `hasEntitlement` is available for routes that
 * carry both fields.
 */

export const FEATURES = {
  /** Basic CRM + pipelines — every tier */
  CRM_CORE: 'crm_core',
  /** Kanban + 500-lead cap enforcement — Pro+ */
  PRO_ACCESS: 'pro_access',
  /** Unlimited leads, 3 seats, full automation — Studio+ */
  STUDIO_ACCESS: 'studio_access',
  /** Unlimited seats + custom onboarding — Elite */
  ELITE_ACCESS: 'elite_access',
  /** Prompt library tiers (mirrors prompts.ts behavior) */
  PROMPTS_PRO: 'prompts_pro',
  PROMPTS_STUDIO: 'prompts_studio',
} as const

type Feature = (typeof FEATURES)[keyof typeof FEATURES]

const MINIMUM_TIER: Readonly<Record<Feature, PlanId>> = {
  [FEATURES.CRM_CORE]: 'free',
  [FEATURES.PRO_ACCESS]: 'starter',
  [FEATURES.STUDIO_ACCESS]: 'pro',
  [FEATURES.ELITE_ACCESS]: 'enterprise',
  [FEATURES.PROMPTS_PRO]: 'starter',
  [FEATURES.PROMPTS_STUDIO]: 'pro',
}

/**
 * Server-side entitlement check. `plan` is the stored Organization.plan value
 * ('free' | 'starter' | 'pro' | 'enterprise'). Unknown plans deny access.
 */
export function hasEntitlement(plan: string | null | undefined, feature: Feature): boolean {
  const minimum = MINIMUM_TIER[feature]
  if (!minimum) return false
  return planAtLeast(plan, minimum)
}
