import { NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { db, withOrgRlsTransaction } from '@/lib/db'
import { stripe, stripeWebhookSecret, stripeWebhookSecretTest, stripeMode } from '@/lib/billing/stripe'
import { planIdFromSubscription, syncSubscriptionToOrg } from '@/lib/billing/subscription'

/**
 * Stripe webhook — subscription lifecycle sync.
 *
 * Handled events:
 * - checkout.session.completed    -> link customer/subscription (no plan grant)
 * - customer.subscription.created -> grant plan when status is trialing/active
 * - customer.subscription.updated -> follow plan changes (upgrades/downgrades)
 * - customer.subscription.deleted -> mark canceled (entitlement stays until
 *                                    past_due/unpaid or a cancel job runs)
 *
 * Safety:
 * - Signature verification is REQUIRED; unverifiable payloads -> 400.
 * - Each Stripe webhook endpoint (live and test) has its OWN signing secret.
 *   A valid signature from EITHER endpoint is accepted: the primary
 *   STRIPE_WEBHOOK_SECRET is tried first, then STRIPE_WEBHOOK_SECRET_TEST.
 *   400 only when every configured secret fails — or when the billing client
 *   is active but no signing secret is configured at all.
 * - Mode isolation: a verified event whose livemode does not match the active
 *   billing mode is acknowledged (200) and dropped — a test-mode event must
 *   never touch live billing state, and vice versa.
 * - Without a charge-capable client (billing off, live-pending-activation)
 *   the route is inert (200 + skip).
 * - Every DB write is idempotent for webhook redelivery.
 * - Never logs key material; only event type + org id on failure paths.
 */

export async function POST(request: Request) {
  const client = stripe()
  const primarySecret = stripeWebhookSecret()
  const testSecret = stripeWebhookSecretTest()

  // Inert when billing is not configured (off, or live-pending-activation):
  // no charge-capable client exists, so there is nothing to verify against.
  if (!client) {
    if (stripeMode() === 'live') {
      console.error('Stripe webhook: live key configured without activation — webhook inert')
    }
    return NextResponse.json({ received: true })
  }

  const signature = request.headers.get('stripe-signature')
  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe-signature' }, { status: 400 })
  }

  // Live/primary deliveries are signed with the primary endpoint's secret;
  // test-mode deliveries with the TEST endpoint's secret. Accept a valid
  // signature from either endpoint; only reject when all fail or none is set.
  const secrets = Array.from(new Set([primarySecret, testSecret].filter((s): s is string => Boolean(s))))
  if (secrets.length === 0) {
    console.error('Stripe webhook: billing client configured but no webhook signing secret is set')
    return NextResponse.json({ error: 'Webhook signing secret not configured' }, { status: 400 })
  }

  const body = await request.text()

  let event: Stripe.Event | undefined
  for (const secret of secrets) {
    try {
      event = client.webhooks.constructEvent(body, signature, secret)
      break
    } catch {
      // Signature did not verify against this endpoint's secret; try the next.
    }
  }
  if (!event) {
    console.error('Stripe webhook signature verification failed against all configured signing secrets')
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  // Mode isolation (codex P1): a correctly-signed event from the OTHER Stripe
  // mode must never touch billing state — once live billing activates, a test
  // checkout carrying a real org's metadata could otherwise overwrite that
  // org's live customer/subscription IDs. Acknowledge with 200 (never 400 —
  // repeated non-2xx would get the endpoint disabled by Stripe again).
  const mode = stripeMode()
  const eventIsLiveMode = event.livemode === true
  if ((mode === 'live') !== eventIsLiveMode) {
    console.error('Stripe webhook: event Stripe-mode does not match active billing mode — ignored', {
      eventId: event.id,
      type: event.type,
    })
    return NextResponse.json({ received: true })
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const organizationId = String(session.metadata?.organizationId ?? '')
        const subscriptionId = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id
        const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id

        if (!organizationId || !subscriptionId || !customerId) {
          console.error('Stripe webhook: checkout.session.completed missing org/subscription/customer', {
            eventId: event.id,
            hasOrg: Boolean(organizationId),
            hasSub: Boolean(subscriptionId),
            hasCustomer: Boolean(customerId),
          })
          return NextResponse.json({ error: 'Incomplete checkout session' }, { status: 200 })
        }

        // Link-only: the customer/subscription association is recorded, but the
        // paid plan is NOT applied here. A checkout may complete while the
        // initial payment is incomplete/pending; entitlement must only be
        // granted by a verified trialing/active customer.subscription.* event.
        // planUpdatedAt is intentionally NOT advanced: Stripe typically emits
        // the subscription event BEFORE session completion, so stamping the
        // session timestamp here would make the out-of-order guard in
        // syncSubscriptionToOrg reject the follow-on subscription event and the
        // paid plan would never be granted.
        //
        // Ordering guard (cubic P1 round 3): if subscription.created already
        // arrived BEFORE session completion (instant card payments/trials), the
        // plan/status is already granted — do not downgrade an active/trialing
        // status to 'incomplete' here.
        await withOrgRlsTransaction(organizationId, async () => {
          const current = await db.organization.findUnique({
            where: { id: organizationId },
            select: { stripeSubscriptionStatus: true },
          })
          const status = current?.stripeSubscriptionStatus === 'active' || current?.stripeSubscriptionStatus === 'trialing'
            ? current.stripeSubscriptionStatus
            : 'incomplete'
          await db.organization.update({
            where: { id: organizationId },
            data: {
              stripeCustomerId: customerId,
              stripeSubscriptionId: subscriptionId,
              stripeSubscriptionStatus: status,
            },
          })
        })
        break
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        const organizationId = String(subscription.metadata?.organizationId ?? '')
        const id = subscription.id
        const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id

        if (!organizationId) {
          console.error('Stripe webhook: subscription event missing org metadata', {
            eventId: event.id,
            subscriptionId: id,
          })
          return NextResponse.json({ error: 'Subscription missing organization metadata' }, { status: 200 })
        }

        // Organization writes must run inside the org RLS transaction so the
        // update is scoped to the org row we own (never rely on the Stripe
        // event payload for cross-tenant access).
        await withOrgRlsTransaction(organizationId, () =>
          syncSubscriptionToOrg({
            organizationId,
            stripeCustomerId: customerId ?? '',
            stripeSubscriptionId: id,
            stripeSubscriptionStatus: event.type === 'customer.subscription.deleted' ? 'canceled' : subscription.status,
            planId: event.type === 'customer.subscription.deleted' ? null : planIdFromSubscription(subscription),
            eventCreatedAtSec: event.created,
          }),
        )
        break
      }

      default:
        // Acknowledge unknown events so Stripe stops retrying.
        break
    }
  } catch (error) {
    console.error('Stripe webhook processing error', {
      eventId: event.id,
      type: event.type,
      message: error instanceof Error ? error.message : 'unknown',
    })
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
