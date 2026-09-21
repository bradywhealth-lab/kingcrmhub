import { CLAIM_GRANT_WINDOW_DAYS, CLAIM_NUDGE_DAYS } from './gumroad'

export type ClaimGrantInfo = {
  active: boolean
  plan: string
  startsAt: string
  expiresAt: string
  source: string
  daysLeft: number
  nudgeAt: number
  expired: boolean
}

/**
 * Read the grant info embedded in Organization.settings by the redeem write.
 * Used for the day-21 nudge banner. Pure reducer over stored JSON — safe for
 * client components (no DB import).
 */
export function readClaimGrantInfo(settings: unknown): ClaimGrantInfo | null {
  const raw =
    settings && typeof settings === 'object' && !Array.isArray(settings)
      ? (settings as Record<string, unknown>).grant
      : undefined
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null

  const g = raw as Record<string, unknown>
  const expiresAt = typeof g.expiresAt === 'string' ? new Date(g.expiresAt) : null
  if (!expiresAt || Number.isNaN(expiresAt.getTime())) return null

  const now = Date.now()
  const remainingMs = expiresAt.getTime() - now
  const daysLeft = Math.max(0, Math.ceil(remainingMs / (24 * 60 * 60 * 1000)))

  return {
    active: remainingMs > 0,
    plan: typeof g.plan === 'string' ? g.plan : 'pro',
    startsAt: typeof g.startsAt === 'string' ? g.startsAt : '',
    expiresAt: expiresAt.toISOString(),
    source: typeof g.source === 'string' ? g.source : 'gumroad-license',
    daysLeft,
    nudgeAt: Math.max(0, daysLeft - CLAIM_NUDGE_DAYS),
    expired: remainingMs <= 0,
  }
}

/**
 * Day-31 policy (spec t_7160ffb5 §4/§5, Brady recommendation: keep data
 * visible, block new adds): the org's EFFECTIVE plan for gates, after the
 * promo grant is applied.
 *
 * While a grant is active the stored plan (which the redeem set to 'pro') is
 * used directly. Once the grant expires the org falls back to Free — unless a
 * Stripe subscription still grants entitlement (trialing/active), because a
 * paying Studio customer's stored plan is also 'pro' and must NOT be snapped
 * to free by a dead promo flag. No write is performed here: the lazy read is
 * the policy (no cron needed for v1).
 */
export function resolveEffectivePlan(input: {
  plan: string | null | undefined
  settings: unknown
  stripeSubscriptionStatus?: string | null
}): { plan: string; grantActive: boolean; grantExpired: boolean } {
  const grant = readClaimGrantInfo(input.settings)

  if (grant?.active) {
    return { plan: grant.plan, grantActive: true, grantExpired: false }
  }

  if (grant?.expired) {
    const subscriptionGrants =
      input.stripeSubscriptionStatus === 'trialing' || input.stripeSubscriptionStatus === 'active'
    if (subscriptionGrants) {
      return { plan: input.plan ?? 'free', grantActive: false, grantExpired: true }
    }
    return { plan: 'free', grantActive: false, grantExpired: true }
  }

  return { plan: input.plan ?? 'free', grantActive: false, grantExpired: false }
}

export const CLAIM_BANNER = {
  windowDays: CLAIM_GRANT_WINDOW_DAYS,
  nudgeDays: CLAIM_NUDGE_DAYS,
}
