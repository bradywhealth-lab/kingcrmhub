import { describe, expect, it, vi } from 'vitest'

/**
 * Env bindings for the Stripe gateway module. The module reads env at import
 * time, so each case resets the module registry and re-imports with the env
 * arranged for that case.
 */
describe('stripe gateway env bindings', () => {
  it('exposes the test-endpoint signing secret when STRIPE_WEBHOOK_SECRET_TEST is set', async () => {
    vi.resetModules()
    const previous = process.env.STRIPE_WEBHOOK_SECRET_TEST
    process.env.STRIPE_WEBHOOK_SECRET_TEST = 'whsec_test_example'
    try {
      const mod = await import('@/lib/billing/stripe')
      expect(mod.stripeWebhookSecretTest()).toBe('whsec_test_example')
    } finally {
      if (previous === undefined) delete process.env.STRIPE_WEBHOOK_SECRET_TEST
      else process.env.STRIPE_WEBHOOK_SECRET_TEST = previous
    }
  })

  it('returns null for the test-endpoint signing secret when STRIPE_WEBHOOK_SECRET_TEST is unset', async () => {
    vi.resetModules()
    delete process.env.STRIPE_WEBHOOK_SECRET_TEST
    const mod = await import('@/lib/billing/stripe')
    expect(mod.stripeWebhookSecretTest()).toBeNull()
  })

  it('does not expose secret values through mode labels', async () => {
    vi.resetModules()
    const previous = process.env.STRIPE_SECRET_KEY
    process.env.STRIPE_SECRET_KEY = 'sk_test_placeholder'
    try {
      const mod = await import('@/lib/billing/stripe')
      expect(mod.stripeMode()).toBe('test')
      expect(mod.stripeModeLabel()).not.toContain('sk_test_placeholder')
    } finally {
      if (previous === undefined) delete process.env.STRIPE_SECRET_KEY
      else process.env.STRIPE_SECRET_KEY = previous
    }
  })
})
