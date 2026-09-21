import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Zero-charge grant path law (spec t_7160ffb5 §3 — MANDATORY; STRIPE_LIVE_
 * ACTIVATION=1 is live):
 *
 * 1. The claim/banner/signup-redeem files must never import or call any
 *    Stripe symbol — the free month is a direct DB entitlement write.
 * 2. No `trial_period_days` / `discounts` / coupon language may appear in
 *    the grant path.
 * 3. Raw license keys are never stored or logged — only the SHA-256 hash
 *    (asserted via source scan: the ledger-write sites use hashLicenseKey).
 */
const repoRoot = join(import.meta.dirname, '..', '..', '..')
const GRANT_PATH_FILES = [
  'src/app/api/claim/route.ts',
  'src/lib/claim/gumroad.ts',
  'src/lib/claim/grant.ts',
  'src/lib/claim/redeem-signup.ts',
  'src/lib/claim/entitlement-info.ts',
  'src/app/api/billing/grant/route.ts',
  'src/app/api/auth/signup/route.ts',
  'src/components/app/claim-banner.tsx',
]

describe('claim grant path stays Stripe-free (zero-charge law)', () => {
  it.each(GRANT_PATH_FILES)('%s imports no Stripe client symbol', (file) => {
    const src = readFileSync(join(repoRoot, file), 'utf8')
    // Ban real value imports/requires of the Stripe SDK — comments may say
    // "Stripe" (they must), so the symbol-level ban only. Must cover BOTH
    // static and dynamic import forms, require(), the constructor, AND any
    // chained SDK call (`stripe.checkout.sessions.create`) — the chained form
    // is how the SDK is always invoked (cubic P3: the old /stripe\.\w+\(/
    // missed chained calls and `await import('stripe')` escaped entirely).
    expect(src).not.toMatch(/from ['"]stripe['"]/)
    expect(src).not.toMatch(/require\(['"]stripe['"]\)/)
    expect(src).not.toMatch(/import\(['"]stripe['"]\)/)
    expect(src).not.toMatch(/new Stripe\s*\(/)
    expect(src).not.toMatch(/stripe\.[a-zA-Z_$][\w$]*(?:\.[a-zA-Z_$][\w$]*)*\s*\(/)
    expect(src).not.toMatch(/trial_period_days|discounts|coupon/i)
  })

  it('the claim route never creates a Stripe subscription artifact', () => {
    const route = readFileSync(join(repoRoot, 'src/app/api/claim/route.ts'), 'utf8')
    expect(route).not.toMatch(/checkout\.sessions|subscriptions\.create|paymentMethods/i)
    expect(route).not.toMatch(/new Stripe|stripe\.checkout|stripe\.subscriptions/i)
  })

  it('license keys are hashed before any ledger write', () => {
    const grant = readFileSync(join(repoRoot, 'src/lib/claim/grant.ts'), 'utf8')
    expect(grant).toContain('hashLicenseKey(')
    const route = readFileSync(join(repoRoot, 'src/app/api/claim/route.ts'), 'utf8')
    expect(route).toContain('hashLicenseKey(')
  })

  it('the signup redemption passes the transaction client (atomic grant)', () => {
    const signup = readFileSync(join(repoRoot, 'src/app/api/auth/signup/route.ts'), 'utf8')
    expect(signup).toContain('redeemClaimGrantAtSignup(')
    expect(signup).toContain('tx,')
  })
})
