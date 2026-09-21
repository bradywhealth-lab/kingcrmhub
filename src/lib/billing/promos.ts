import { getPlan, isPlanId, type PlanId } from './plans'

/**
 * Promotional plan grants (Gumroad prompt-buyer claim flow, t_55f06113).
 *
 * A promo is a TIME-BOUND entitlement overlay that NEVER overwrites the
 * org's stored `Organization.plan`:
 * - Stored plan stays `free` while a promo lifts the effective tier.
 * - `effectivePlanId(org)` is what entitlement checks must read going
 *   forward — it returns the higher of (stored plan, active promo).
 * - When the promo expires, the org falls back to its stored plan
 *   (decision record 2026-09-21: day-31 keeps data visible, blocks new
 *   adds — the entitlement ladder enforces that automatically because
 *   effectivePlanId returns the stored tier again).
 * - A paid org (e.g. Elite) claiming a Studio promo must never be
 *   downgraded — effectivePlanId takes the higher rank.
 *
 * WIRING LAW (v15 pricing spec): the promo targets EXACTLY the internal
 * stored plan `pro` (customer label "Studio"). `isPlanId` rejects any
 * label (`studio`/`elite`) at this boundary, so a leaked display label
 * can never grant access.
 */

export type PromoOrgFields = {
  plan: string | null | undefined
  promoPlanId?: string | null
  promoPlanExpiresAt?: Date | string | null
}

/** 30-day grant, per Brady decision record 2026-09-21 (grant targets Studio / $0). */
export const PROMO_DURATION_MS = 30 * 24 * 60 * 60 * 1000
export const PROMO_PLAN_ID: PlanId = 'pro'

/** Resolve the active promo plan for an org, or null when none is active. */
export function activePromoPlan(org: PromoOrgFields): PlanId | null {
  if (!org.promoPlanId || !org.promoPlanExpiresAt) return null
  // Labels never grant: the stored promoPlanId must be a real stored plan id.
  if (!isPlanId(org.promoPlanId)) return null
  const expiresAt = new Date(org.promoPlanExpiresAt)
  if (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) return null
  return org.promoPlanId
}

export function isPromoActive(org: PromoOrgFields): boolean {
  return activePromoPlan(org) !== null
}

/**
 * The tier entitlement checks must use. Returns the higher rank of the
 * stored plan and an active promo — never lower than the stored plan.
 */
export function effectivePlanId(org: PromoOrgFields): PlanId | null {
  const promo = activePromoPlan(org)
  const stored = org.plan && isPlanId(org.plan) ? (org.plan as PlanId) : null
  const storedRank = getPlan(stored)?.rank ?? -1
  const promoRank = getPlan(promo)?.rank ?? -1
  if (promoRank > storedRank) return promo
  return stored
}

/** Customer-facing promo tier label (never a bare stored id). */
export function promoLabel(planId: string | null | undefined): string | null {
  if (!planId || !isPlanId(planId)) return null
  return getPlan(planId)?.displayName ?? null
}

export const PROMO_COPY =
  'Your Studio plan is free for 1 month as a thank-you for buying the prompts. After that, the free plan continues unless you upgrade.'
