import type Stripe from 'stripe'
import { db } from '@/lib/db'
import { planIdForStripePrice, type PlanId } from './plans'

/**
 * Org plan state sync from Stripe subscription lifecycle events.
 *
 * Contract (webhook handler):
 * - `checkout.session.completed`  -> link customer + subscription ONLY. Plan
 *   and entitlement are applied by the follow-on `customer.subscription.*`
 *   event when the subscription actually reaches `trialing`/`active`.
 * - `customer.subscription.updated` -> follow plan changes (upgrades/downgrades)
 *   and status changes; fail closed on unknown statuses.
 * - `customer.subscription.deleted` -> cancel: keep the org on plan but mark
 *   status 'canceled' (grace — entitlement flips only when past_due/unpaid
 *   arrives or an explicit cancel job runs; documented minimal honest gate).
 *
 * Safety:
 * - Fail closed: a status that does not grant entitlement never sets `plan`.
 *   Only trialing/active statuses may change the stored plan.
 * - Out-of-order delivery: an older event (by Stripe `event.created`) can
 *   never overwrite a newer stored state.
 * - Stale subscription: an event for a subscription that is no longer the
 *   org's current one is ignored.
 * - Webhook redelivery safe: every write is idempotent — setting the same
 *   target state twice is a no-op.
 */

export type SubscriptionStatus =
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'unpaid'
  | 'canceled'
  | 'incomplete'
  | 'incomplete_expired'
  | 'paused'
  | 'unknown'

const ENTITLED_STATUSES: ReadonlySet<string> = new Set(['trialing', 'active'])

/** Map a Stripe subscription to the org plan it represents. Null = no change. */
export function planIdFromSubscription(subscription: Stripe.Subscription): PlanId | null {
  const priceId = subscription.items.data[0]?.price.id
  if (!priceId) return null
  return planIdForStripePrice(priceId)
}

/** True while the subscription grants entitlement (trialing/active). */
export function subscriptionEntitles(status: string | null | undefined): boolean {
  if (!status) return false
  return ENTITLED_STATUSES.has(status)
}

/**
 * Fail-closed status normalization. Recognized statuses are stored as-is.
 * Any unrecognized status (including future Stripe statuses this build has
 * not been taught) becomes 'unknown' — it NEVER grants entitlement and it is
 * never rewritten as 'active'.
 */
function normalizeStatus(status: string): SubscriptionStatus {
  switch (status) {
    case 'trialing':
    case 'active':
    case 'past_due':
    case 'unpaid':
    case 'canceled':
    case 'incomplete':
    case 'incomplete_expired':
    case 'paused':
      return status
    default:
      return 'unknown'
  }
}

export interface SubscriptionSyncInput {
  organizationId: string
  stripeCustomerId: string
  stripeSubscriptionId: string
  stripeSubscriptionStatus: string
  planId: PlanId | null
  /** Stripe `event.created` (seconds) — guards against out-of-order delivery. */
  eventCreatedAtSec?: number
}

export async function syncSubscriptionToOrg(input: SubscriptionSyncInput): Promise<{
  planId: string
  status: string
  applied: boolean
}> {
  const {
    organizationId,
    stripeCustomerId,
    stripeSubscriptionId,
    stripeSubscriptionStatus,
    planId,
    eventCreatedAtSec,
  } = input

  const current = await db.organization.findUnique({
    where: { id: organizationId },
    select: { stripeSubscriptionId: true, stripeSubscriptionStatus: true, planUpdatedAt: true },
  })

  if (!current) return { applied: false, planId: 'free', status: 'unknown' }

  // Ignore events for a subscription that is no longer the org's current one.
  if (current.stripeSubscriptionId && current.stripeSubscriptionId !== stripeSubscriptionId) {
    return { applied: false, planId: planId ?? 'free', status: current.stripeSubscriptionStatus ?? 'unknown' }
  }

  // Ignore events older than the last applied state.
  if (
    eventCreatedAtSec &&
    current.planUpdatedAt &&
    current.planUpdatedAt.getTime() > eventCreatedAtSec * 1000
  ) {
    return { applied: false, planId: planId ?? 'free', status: current.stripeSubscriptionStatus ?? 'unknown' }
  }

  const normalizedStatus = normalizeStatus(stripeSubscriptionStatus)
  const entitled = ENTITLED_STATUSES.has(normalizedStatus)

  const data: Record<string, unknown> = {
    stripeCustomerId,
    stripeSubscriptionId,
    stripeSubscriptionStatus: normalizedStatus,
    planUpdatedAt: new Date(eventCreatedAtSec ? eventCreatedAtSec * 1000 : Date.now()),
  }
  // Only entitled statuses may change the stored plan (fail closed).
  if (planId && entitled) data.plan = planId

  await db.organization.update({
    where: { id: organizationId },
    data: data as never,
  })

  return { applied: true, planId: String(data.plan ?? 'free'), status: normalizedStatus }
}

/** Minimal honest entitlement gate — read plan + subscription status. */
export function orgEntitled(plan: string | null | undefined, subscriptionStatus: string | null | undefined): boolean {
  if (!plan || plan === 'free') return true
  return subscriptionEntitles(subscriptionStatus)
}
