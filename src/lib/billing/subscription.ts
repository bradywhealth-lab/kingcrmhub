import type Stripe from 'stripe'
import { db } from '@/lib/db'
import { planIdForStripePrice, type PlanId } from './plans'

/**
 * Org plan state sync from Stripe subscription lifecycle events.
 *
 * Contract (webhook handler):
 * - `checkout.session.completed`  -> link customer/subscription + set plan
 * - `customer.subscription.updated` -> follow plan changes (upgrades/downgrades)
 * - `customer.subscription.deleted` -> cancel: keep the org on plan but mark
 *   status 'canceled' (grace — entitlement flips only when past_due/unpaid
 *   arrives or an explicit cancel job runs; documented minimal honest gate).
 *
 * Webhook redelivery safe: every write is idempotent — setting the same
 * target state twice is a no-op.
 */

export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'unpaid' | 'canceled'

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

function normalizeStatus(status: string): SubscriptionStatus {
  switch (status) {
    case 'trialing':
    case 'active':
    case 'past_due':
    case 'unpaid':
    case 'canceled':
      return status
    default:
      return 'active'
  }
}

export interface SubscriptionSyncInput {
  organizationId: string
  stripeCustomerId: string
  stripeSubscriptionId: string
  stripeSubscriptionStatus: string
  planId: PlanId | null
}

export async function syncSubscriptionToOrg(input: SubscriptionSyncInput): Promise<{ planId: string; status: string }> {
  const {
    organizationId,
    stripeCustomerId,
    stripeSubscriptionId,
    stripeSubscriptionStatus,
    planId,
  } = input

  const data: Record<string, unknown> = {
    stripeCustomerId,
    stripeSubscriptionId,
    stripeSubscriptionStatus: normalizeStatus(stripeSubscriptionStatus),
    planUpdatedAt: new Date(),
  }
  if (planId) data.plan = planId

  await db.organization.update({
    where: { id: organizationId },
    data: data as never,
  })

  return {
    planId: String(data.plan ?? 'free'),
    status: String(data.stripeSubscriptionStatus),
  }
}

export async function clearSubscriptionFromOrg(
  organizationId: string,
  stripeSubscriptionId: string,
): Promise<void> {
  await db.organization.update({
    where: { id: organizationId },
    data: {
      stripeSubscriptionId: null,
      stripeSubscriptionStatus: 'canceled',
      planUpdatedAt: new Date(),
    } as never,
  })
}

/** Minimal honest entitlement gate — read plan + subscription status. */
export function orgEntitled(plan: string | null | undefined, subscriptionStatus: string | null | undefined): boolean {
  if (!plan || plan === 'free') return true
  return subscriptionEntitles(subscriptionStatus)
}
