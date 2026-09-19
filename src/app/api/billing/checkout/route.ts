import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { buildNextAuthOptions } from '@/lib/next-auth'
import { db, withOrgRlsTransaction } from '@/lib/db'
import { PAID_PLAN_IDS, getPlan, type PlanId } from '@/lib/billing/plans'
import { stripe, stripeActive, stripePriceId, stripeMode } from '@/lib/billing/stripe'

/**
 * Checkout endpoint — creates a Stripe Checkout Session for a paid plan.
 *
 * Behavior (task t_004fc492):
 * - Billing OFF (no STRIPE_SECRET_KEY) -> honest coming-soon stub (existing
 *   contract preserved; nobody is charged).
 * - Billing TEST (sk_test_...)        -> real Checkout Session with test-mode
 *   prices; safe to exercise with Stripe test cards.
 * - Billing LIVE                      -> real Checkout Session only after
 *   STRIPE_LIVE_ACTIVATION=1 (Brady's explicit go). Without it, the response
 *   tells the user billing is not active — never a charge path.
 *
 * Hard rules: never log key material; price IDs come from env (plans.ts
 * vocabulary), never from the client. Only monthly interval (yearly is not
 * built for v1).
 */

const BILLING_OFFLINE_MESSAGE =
  'Paid upgrades are not active yet. Your account has not been charged, and we will publish billing terms before checkout opens.'

export async function POST(request: Request) {
  const session = await getServerSession(buildNextAuthOptions())
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const user = session.user as {
    id?: string
    email?: string | null
    organizationId?: string
    organization?: { id?: string; plan?: string } | null
  }

  const organizationId = user.organizationId ?? user.organization?.id

  let planId: string | undefined
  let interval: string | undefined
  try {
    const body = (await request.json()) as { planId?: unknown; interval?: unknown }
    if (typeof body.planId === 'string') planId = body.planId
    if (body.interval === 'monthly') interval = body.interval
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!planId || interval !== 'monthly') {
    return NextResponse.json(
      { error: 'planId and interval are required (monthly only for v1)' },
      { status: 400 },
    )
  }
  if (!PAID_PLAN_IDS.includes(planId as PlanId)) {
    return NextResponse.json({ error: 'Invalid paid plan' }, { status: 400 })
  }

  const client = stripe()
  if (!client || !stripeActive()) {
    // Honest off/live-inert path — no charge possible.
    const message =
      stripeMode() === 'live'
        ? 'Live billing is not active yet. Your account has not been charged.'
        : BILLING_OFFLINE_MESSAGE
    return NextResponse.json({ status: 'coming_soon', url: null, message, planId, interval })
  }

  const plan = getPlan(planId)
  if (!plan?.stripePriceEnvKey) {
    return NextResponse.json({ error: 'Plan has no billing price configured' }, { status: 500 })
  }
  const priceId = stripePriceId(plan.stripePriceEnvKey)
  if (!priceId) {
    return NextResponse.json(
      { error: `Billing is not configured for this plan yet (missing ${plan.stripePriceEnvKey})` },
      { status: 500 },
    )
  }

  try {
    if (!organizationId) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    // Redirect target must come from a validated, allowlisted application URL —
    // never an arbitrary Origin header the caller controls.
    const appBaseUrl = process.env.APP_BASE_URL?.trim().replace(/\/+$/, '')
    if (!appBaseUrl) {
      return NextResponse.json(
        { error: 'Billing is not configured (missing APP_BASE_URL)' },
        { status: 500 },
      )
    }

    // Note: withOrgRlsTransaction must be awaited — an unawaited rejection
    // escapes this try/catch as an opaque empty-body 500 (see repo pitfall:
    // `return withRequestOrgContext` / transaction helpers).
    return await withOrgRlsTransaction(organizationId, async () => {
      const existing = await db.organization.findUnique({
        where: { id: organizationId },
        select: { stripeCustomerId: true, stripeSubscriptionId: true, stripeSubscriptionStatus: true, settings: true },
      })
      if (!existing) {
        return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
      }

      // Repeated paid-plan clicks must not mint multiple billable subscriptions.
      // If the org already has an active/pending subscription, refuse a second
      // checkout (Stripe itself dedupes identical sessions, but the guard here
      // keeps the API honest).
      if (existing.stripeSubscriptionId && existing.stripeSubscriptionStatus !== 'canceled') {
        return NextResponse.json(
          { error: 'Your organization already has an active subscription. Manage it from the billing page.' },
          { status: 409 },
        )
      }

      const stripeModeName = stripeMode()
      const settings = (existing.settings ?? {}) as Record<string, unknown>
      const perModeCustomers = (settings.stripeCustomers ?? {}) as Record<string, string>

      // Stripe customers live in either the test or live environment — never both.
      // A customer created against test keys cannot be reused once live keys are
      // activated, so each mode maintains its own customer ID namespace.
      let customerId: string | null = perModeCustomers[stripeModeName] ?? null

      const email = user.email ?? undefined
      if (!customerId && email) {
        const customer = await client.customers.create({
          email,
          metadata: { organizationId },
        })
        customerId = customer.id
        const nextSettings = { ...settings, stripeCustomers: { ...perModeCustomers, [stripeModeName]: customer.id } }
        await db.organization.update({
          where: { id: organizationId },
          data: {
            stripeCustomerId: customer.id,
            settings: nextSettings,
          },
        })
      }

      const sessionRes = await client.checkout.sessions.create({
        mode: 'subscription',
        customer: customerId ?? undefined,
        customer_email: customerId ? undefined : email,
        line_items: [{ price: priceId, quantity: 1 }],
        metadata: {
          organizationId,
          planId,
        },
        subscription_data: {
          metadata: { organizationId, planId },
        },
        success_url: `${appBaseUrl}/pricing?checkout=success&plan=${planId}`,
        cancel_url: `${appBaseUrl}/pricing?checkout=canceled&plan=${planId}`,
      })

      return NextResponse.json({ status: 'checkout', url: sessionRes.url, planId, interval })
    })
  } catch (error) {
    console.error('Billing checkout error', error)
    return NextResponse.json(
      { error: 'Checkout could not be started. Please try again.' },
      { status: 500 },
    )
  }
}
