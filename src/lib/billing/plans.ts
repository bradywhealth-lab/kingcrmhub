/**
 * Canonical KingCRM Hub billing catalog — SINGLE SOURCE OF TRUTH.
 *
 * Vocabulary reconciliation (2026-09-19, task t_004fc492):
 * Customer-facing display names DO NOT equal internal stored plan IDs.
 *   Free   -> planId `free`        (rank 0)
 *   Pro    -> planId `starter`     (rank 1, $19/mo)
 *   Studio -> planId `pro`         (rank 2, $39/mo)
 *   Elite  -> planId `enterprise`  (rank 3, $59/mo — changed from $69)
 *
 * Every layer must speak this vocabulary:
 *   pricing UI -> checkout API -> Stripe price IDs -> Organization.plan -> gates.
 * Do NOT rename internal stored IDs (free/starter/pro/enterprise) — they are
 * persisted in the DB and read by server-side entitlement checks.
 *
 * Yearly billing is NOT built (Brady-confirmed 2026-09-19: monthly only for v1).
 * The seam for adding annual plans later is the env price ID itself: point
 * STRIPE_PRICE_*_MONTHLY at an annual Stripe price when the time comes.
 */

export type PlanId = 'free' | 'starter' | 'pro' | 'enterprise'

export type DisplayPlanId = 'free' | 'pro' | 'studio' | 'elite'

/** Environment key that resolves each paid plan's Stripe price (TEST or LIVE
 * depending on STRIPE_MODE — the value itself is never read into code). */
export type StripePriceEnvKey =
  | 'STRIPE_PRICE_PRO_MONTHLY'
  | 'STRIPE_PRICE_STUDIO_MONTHLY'
  | 'STRIPE_PRICE_ELITE_MONTHLY'

export interface PlanDefinition {
  /** Internal, stored plan ID — persisted on Organization.plan. */
  planId: PlanId
  /** Customer-facing display name (pricing page / marketing copy). */
  displayName: string
  /** Rank for entitlement comparisons; higher = more access. */
  rank: number
  /** Monthly price in USD for paid tiers (0 = free). */
  monthlyPrice: number
  /** One-line description shown on the pricing page. */
  description: string
  /**
   * Env var holding this plan's Stripe price ID. `null` for the free plan
   * (no payment required). The actual `price_...` value must never be
   * hardcoded here — it lives in deployment env only.
   */
  stripePriceEnvKey: StripePriceEnvKey | null
}

/** Internal stored plan IDs, ordered by entitlement rank. */
export const PAID_PLAN_IDS: readonly PlanId[] = ['starter', 'pro', 'enterprise']

export const PLANS: readonly PlanDefinition[] = [
  {
    planId: 'free',
    displayName: 'Free',
    rank: 0,
    monthlyPrice: 0,
    description: 'Get started with the basics. No credit card required.',
    stripePriceEnvKey: null,
  },
  {
    planId: 'starter',
    displayName: 'Pro',
    rank: 1,
    monthlyPrice: 19,
    description: 'For freelancers ready to systematize client work and follow-up.',
    stripePriceEnvKey: 'STRIPE_PRICE_PRO_MONTHLY',
  },
  {
    planId: 'pro',
    displayName: 'Studio',
    rank: 2,
    monthlyPrice: 39,
    description: 'The complete client operations stack for established solo businesses.',
    stripePriceEnvKey: 'STRIPE_PRICE_STUDIO_MONTHLY',
  },
  {
    planId: 'enterprise',
    displayName: 'Elite',
    rank: 3,
    monthlyPrice: 59,
    description: 'Advanced scale, support, and customization for growing studios.',
    stripePriceEnvKey: 'STRIPE_PRICE_ELITE_MONTHLY',
  },
]

/** Map for O(1) lookups by stored plan ID. A Map (not a plain object) so
 * inherited keys like `toString`/`__proto__` can never pass isPlanId. */
const PLAN_BY_ID: ReadonlyMap<PlanId, PlanDefinition> = new Map(
  PLANS.map((plan) => [plan.planId, plan] as const),
)

export function isPlanId(value: string): value is PlanId {
  return PLAN_BY_ID.has(value as PlanId)
}

export function getPlan(planId: string | null | undefined): PlanDefinition | null {
  if (!planId) return null
  return PLAN_BY_ID.get(planId as PlanId) ?? null
}

/** Strict rank comparison: true when `plan` has at least `required` access. */
export function planAtLeast(plan: string | null | undefined, required: PlanId): boolean {
  const current = getPlan(plan)
  if (!current) return false
  const requiredRank = PLAN_BY_ID.get(required)?.rank ?? 0
  return current.rank >= requiredRank
}

/** Price (in USD cents) Stripe should charge for a paid plan. */
export function monthlyPriceCents(planId: PlanId): number {
  const plan = PLAN_BY_ID.get(planId)
  if (!plan) throw new Error(`Cannot price unknown plan: ${planId}`)
  return plan.monthlyPrice * 100
}

/**
 * Resolve a Stripe price ID (as configured in env) to a stored plan ID.
 * Returns null when the price ID is unset/unknown — the webhook must treat
 * that as "no plan change" rather than guessing.
 */
export function planIdForStripePrice(priceId: string | null | undefined): PlanId | null {
  if (!priceId) return null
  for (const plan of PLANS) {
    if (!plan.stripePriceEnvKey) continue
    const configured = process.env[plan.stripePriceEnvKey]
    if (configured === priceId) return plan.planId
  }
  return null
}

/** Price-id env keys, for documented configuration and tests. */
export const STRIPE_PRICE_ENV_KEYS = PLANS.filter(
  (plan): plan is PlanDefinition & { stripePriceEnvKey: StripePriceEnvKey } =>
    plan.stripePriceEnvKey !== null,
).map((plan) => plan.stripePriceEnvKey)

/** Friendly plan summary for receipts / audit logs. */
export function planLabel(planId: string | null | undefined): string {
  return getPlan(planId)?.displayName ?? 'Free'
}
