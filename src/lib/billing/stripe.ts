import Stripe from 'stripe'

/**
 * Stripe client gateway.
 *
 * MODES (by design, task t_004fc492):
 * - No STRIPE_SECRET_KEY set            -> stripeMode() === 'off'     — checkout keeps its honest coming-soon stub; webhooks reject without a configured secret.
 * - STRIPE_SECRET_KEY = "sk_test_..."  -> stripeMode() === 'test'    — test-mode by default; safe to exercise with Stripe test cards.
 * - STRIPE_SECRET_KEY = "sk_live_..."  -> stripeMode() === 'live'    — INERT until Brady's explicit go (see LIVE_MODE_ACTIVATION guard).
 *
 * Hard rules:
 * - Never log key values. Only booleans / short prefixes / mode names may leave this module.
 * - Never hardcode `price_...` IDs. Price IDs arrive from env (see plans.ts).
 * - Live mode is a documented switch that stays inert: `stripe() === null`
 *   even in live mode until LIVE_MODE_ACTIVATION === '1' is set by Brady.
 */

export type StripeMode = 'off' | 'test' | 'live'

const SECRET_KEY = process.env.STRIPE_SECRET_KEY || ''
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || ''

/** Brady's explicit go for live activation. Anything else keeps live inert. */
const LIVE_MODE_ACTIVATION = process.env.STRIPE_LIVE_ACTIVATION || ''

export function stripeMode(): StripeMode {
  if (SECRET_KEY.startsWith('sk_live_')) return 'live'
  if (SECRET_KEY.startsWith('sk_test_')) return 'test'
  return 'off'
}

/**
 * Returns the Stripe client when a configured (non-live, or explicitly
 * activated live) mode is active. Returns null when billing is off OR when
 * live keys are configured without the explicit activation flag — in that
 * case callers must refuse to charge (inert live switch).
 */
export function stripe(): Stripe | null {
  if (!SECRET_KEY) return null
  const mode = stripeMode()
  // A nonempty key that is neither sk_test_ nor sk_live_ is malformed config:
  // treat it as billing-off so it can never bypass the gate.
  if (mode === 'off') return null
  if (mode === 'live' && LIVE_MODE_ACTIVATION !== '1') return null
  return new Stripe(SECRET_KEY, { apiVersion: '2026-08-26.dahlia' })
}

/** True when a charge-capable Stripe client exists (test or activated live). */
export function stripeActive(): boolean {
  return stripe() !== null
}

/** Mode name for the honest pricing-page label; never exposes key material. */
export function stripeModeLabel(): string {
  const mode = stripeMode()
  switch (mode) {
    case 'off':
      return 'off'
    case 'test':
      return 'test'
    case 'live':
      return stripeActive() ? 'live' : 'live-pending-activation'
  }
}

/** Webhook signing secret, or null when not configured. */
export function stripeWebhookSecret(): string | null {
  return WEBHOOK_SECRET || null
}

/** True when an unactivated live secret is present (flag to Brady, never use). */
export function isLivePendingActivation(): boolean {
  return stripeMode() === 'live' && LIVE_MODE_ACTIVATION !== '1'
}

/**
 * Stripe price IDs used by checkout. Never logged. Missing prices fail the
 * checkout request with a clear test-mode configuration error (no charge).
 */
export function stripePriceId(envKey: string): string | null {
  const value = process.env[envKey]
  return value && value.startsWith('price_') ? value : null
}
