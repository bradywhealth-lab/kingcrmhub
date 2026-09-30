import { describe, expect, it } from 'vitest'
import { PLANS as PLANS_SOURCE, PAID_PLAN_IDS, isPlanId as catalogIsPlanId } from './plans'
import {
  buildPricingCallbackUrl,
  isPlanId,
  parsePlanIntent,
  PLAN_INTENT_INTERVALS,
  buildResumePrompt,
  resolveResumeIntent,
} from './plan-intent'

// ---------------------------------------------------------------------------
// DEFECT-1 (routed by Sentinel from OpsForge's audit) was reported as:
//   "/pricing CTAs silently 401 for signed-out visitors (needs redirect to
//    /auth?callbackUrl)"
//
// That literal claim was FALSIFIED by live measurement on production:
//   POST /api/billing/checkout (signed out)
//     -> HTTP 401, content-type: application/json, body {"error":"Unauthorized"}
// so `await res.json()` does not throw and the existing redirect at
// crm-pricing-page.tsx:206 DOES run.
//
// The REAL defect, found by reading the source:
//   grep -rn "useSearchParams|searchParams" src/components/pricing/ -> NOTHING
// The redirect sends the user to /pricing?plan=pro&interval=monthly, but no code
// anywhere consumes those params. After signing in the user lands back on
// /pricing and checkout never resumes — the purchase intent is silently dropped.
// That is the dead end the audit was seeing.
//
// These tests pin the intent contract: parse, validate, and rebuild it.
// ---------------------------------------------------------------------------

describe('isPlanId', () => {
  it('accepts every id in the canonical billing catalog', () => {
    for (const id of ['free', 'starter', 'pro', 'enterprise']) {
      expect(isPlanId(id), `${id} should be a valid PlanId`).toBe(true)
    }
  })

  it('rejects marketing names that are NOT catalog ids', () => {
    // The catalog maps Free->free, Pro->starter, Studio->pro, Elite->enterprise.
    // Passing a display name through would silently select nothing.
    for (const bad of ['Pro', 'Studio', 'Elite', 'Free', 'PRO', 'starter ', '', 'null', 'undefined']) {
      expect(isPlanId(bad), `"${bad}" must not be accepted`).toBe(false)
    }
  })

  it('rejects non-strings', () => {
    for (const bad of [null, undefined, 0, 1, {}, [], true]) {
      expect(isPlanId(bad)).toBe(false)
    }
  })
})

describe('PLAN_INTENT_INTERVALS', () => {
  it('is monthly-only, matching the catalog (yearly is not built in v1)', () => {
    expect(PLAN_INTENT_INTERVALS).toEqual(['monthly'])
  })
})

describe('parsePlanIntent', () => {
  it('parses a well-formed intent', () => {
    const params = new URLSearchParams('plan=pro&interval=monthly')
    expect(parsePlanIntent(params)).toEqual({ planId: 'pro', interval: 'monthly' })
  })

  it('REQUIRES an explicit interval — deliberately changed from defaulting to monthly', () => {
    // CHANGED ON PURPOSE (was: "defaults a missing interval to monthly").
    // The old expectation encoded the P1 duplicate-subscription bug: defaulting a
    // missing interval made Stripe's success_url (/pricing?checkout=success&plan=X,
    // which carries NO interval) parse as a resumable intent. That assertion was
    // wrong, so it is inverted rather than deleted — see the P1 describe block.
    expect(parsePlanIntent(new URLSearchParams('plan=starter'))).toBeNull()
    expect(parsePlanIntent(new URLSearchParams('plan=starter&interval=monthly'))).toEqual({
      planId: 'starter',
      interval: 'monthly',
    })
  })

  it('rejects an unknown or unsupported interval rather than guessing', () => {
    expect(parsePlanIntent(new URLSearchParams('plan=pro&interval=yearly'))).toBeNull()
    expect(parsePlanIntent(new URLSearchParams('plan=pro&interval=weekly'))).toBeNull()
  })

  it('rejects an invalid plan id rather than starting a bogus checkout', () => {
    expect(parsePlanIntent(new URLSearchParams('plan=Studio&interval=monthly'))).toBeNull()
    expect(parsePlanIntent(new URLSearchParams('plan=&interval=monthly'))).toBeNull()
    expect(parsePlanIntent(new URLSearchParams('interval=monthly'))).toBeNull()
  })

  it('rejects the free plan — it has no checkout to resume', () => {
    // Resuming "checkout" for free would POST /api/billing/checkout with planId
    // free, which the route rejects as "Invalid paid plan" (route.ts:61). The
    // free CTA should just send the user to sign up, not into a failing request.
    expect(parsePlanIntent(new URLSearchParams('plan=free&interval=monthly'))).toBeNull()
  })

  it('returns null for empty params', () => {
    expect(parsePlanIntent(new URLSearchParams(''))).toBeNull()
  })

  it('ignores extra unrelated params', () => {
    expect(parsePlanIntent(new URLSearchParams('utm=ads&plan=enterprise&interval=monthly&x=1'))).toEqual({
      planId: 'enterprise',
      interval: 'monthly',
    })
  })

  it('takes the first value when a param is repeated (no array coercion)', () => {
    // Updated alongside the interval change above: the URL now carries an explicit
    // interval, because a missing one is (correctly) rejected.
    expect(parsePlanIntent(new URLSearchParams('plan=pro&plan=starter&interval=monthly'))).toEqual({
      planId: 'pro',
      interval: 'monthly',
    })
  })

  it('is case-sensitive on interval, matching the catalog', () => {
    expect(parsePlanIntent(new URLSearchParams('plan=pro&interval=Monthly'))).toBeNull()
  })
})

describe('buildPricingCallbackUrl', () => {
  it('produces the same-origin path the redirect already sends users to', () => {
    expect(buildPricingCallbackUrl('pro', 'monthly')).toBe('/pricing?plan=pro&interval=monthly')
  })

  it('stays a relative same-origin path (auth only honours those)', () => {
    // src/app/auth/page.tsx:193-197 rejects anything not starting with a single
    // '/' — a protocol-relative '//evil.com' or absolute URL would be dropped.
    const url = buildPricingCallbackUrl('starter', 'monthly')
    expect(url.startsWith('/')).toBe(true)
    expect(url.startsWith('//')).toBe(false)
    expect(url.includes('\\')).toBe(false)
  })

  it('percent-encodes so the intent survives the callbackUrl nesting', () => {
    // The redirect wraps this in encodeURIComponent for /auth?callbackUrl=...
    // auth then decodes it. Verify the round trip preserves the intent.
    const inner = buildPricingCallbackUrl('enterprise', 'monthly')
    const nested = `/auth?callbackUrl=${encodeURIComponent(inner)}`
    const roundTripped = new URL(nested, 'https://kingcrmhub.net').searchParams.get('callbackUrl')
    expect(roundTripped).toBe(inner)
    expect(parsePlanIntent(new URL(inner, 'https://kingcrmhub.net').searchParams)).toEqual({
      planId: 'enterprise',
      interval: 'monthly',
    })
  })

  it('rejects an invalid plan id instead of emitting a broken URL', () => {
    // @ts-expect-error deliberately passing an invalid id to prove runtime guarding
    expect(() => buildPricingCallbackUrl('Studio', 'monthly')).toThrow()
  })
})

describe('resolveResumeIntent (the mount-time seam the pricing page calls)', () => {
  it('resumes from a raw location.search with a leading ?', () => {
    expect(resolveResumeIntent('?plan=pro&interval=monthly')).toEqual({
      planId: 'pro',
      interval: 'monthly',
    })
  })

  it('also accepts a search string without the leading ?', () => {
    expect(resolveResumeIntent('plan=starter&interval=monthly')).toEqual({
      planId: 'starter',
      interval: 'monthly',
    })
  })

  it('returns null for an empty/absent search (the normal signed-out visit)', () => {
    expect(resolveResumeIntent('')).toBeNull()
    expect(resolveResumeIntent('?')).toBeNull()
    expect(resolveResumeIntent(null)).toBeNull()
    expect(resolveResumeIntent(undefined)).toBeNull()
  })

  it('returns null for unrelated marketing params', () => {
    expect(resolveResumeIntent('?utm_source=ads&ref=twitter')).toBeNull()
  })

  it('never throws on a malformed search string — a throw in a mount effect would break /pricing for every visitor', () => {
    for (const bad of ['???', '%E0%A4%A', 'plan=%FF&interval=%FF', '&&&', 'plan']) {
      expect(() => resolveResumeIntent(bad)).not.toThrow()
    }
    expect(resolveResumeIntent('%E0%A4%A')).toBeNull()
  })

  it('does not resume a free-plan intent', () => {
    expect(resolveResumeIntent('?plan=free&interval=monthly')).toBeNull()
  })

  it('does not resume a display name (Pro/Studio/Elite) — only catalog ids', () => {
    expect(resolveResumeIntent('?plan=Studio&interval=monthly')).toBeNull()
    expect(resolveResumeIntent('?plan=Elite')).toBeNull()
  })

  it('does not resume an unbuilt yearly interval', () => {
    expect(resolveResumeIntent('?plan=pro&interval=yearly')).toBeNull()
  })

  it('round-trips what buildPricingCallbackUrl produces', () => {
    for (const planId of ['starter', 'pro', 'enterprise'] as const) {
      const url = buildPricingCallbackUrl(planId, 'monthly')
      const search = url.slice(url.indexOf('?'))
      expect(resolveResumeIntent(search), `round trip for ${planId}`).toEqual({
        planId,
        interval: 'monthly',
      })
    }
  })
})

describe('buildResumePrompt', () => {
  // cubic P3: do NOT re-hardcode the plan-id -> display-name mapping. Deriving it
  // from the canonical catalog means these tests fail if the mapping changes,
  // instead of passing against stale names while the real prompt renders new ones.
  const CATALOG = PLANS_SOURCE.map((plan) => ({ id: plan.planId, name: plan.displayName }))

  it('is hidden when there is no intent (the normal visit)', () => {
    expect(buildResumePrompt(null, CATALOG)).toEqual({ visible: false, planName: null })
  })

  it('shows and maps the catalog id to its DISPLAY name, not the id', () => {
    // The catalog deliberately differs: Pro->starter, Studio->pro, Elite->enterprise.
    // Showing "pro" to a customer would be wrong.
    expect(buildResumePrompt({ planId: 'pro', interval: 'monthly' }, CATALOG)).toEqual({
      visible: true,
      planName: 'Studio',
    })
    expect(buildResumePrompt({ planId: 'starter', interval: 'monthly' }, CATALOG)).toEqual({
      visible: true,
      planName: 'Pro',
    })
    expect(buildResumePrompt({ planId: 'enterprise', interval: 'monthly' }, CATALOG)).toEqual({
      visible: true,
      planName: 'Elite',
    })
  })

  it('yields to a visible toast so the two never stack on screen', () => {
    expect(
      buildResumePrompt({ planId: 'pro', interval: 'monthly' }, CATALOG, true),
    ).toEqual({ visible: false, planName: null })
  })

  it('falls back to the raw id when the catalog and a bookmarked link disagree', () => {
    // Still surfaces the visitor's intent instead of rendering nothing.
    expect(
      buildResumePrompt({ planId: 'enterprise', interval: 'monthly' }, [
        { id: 'starter', name: 'Pro' },
      ]),
    ).toEqual({ visible: true, planName: 'enterprise' })
  })

  it('handles an empty catalog without throwing', () => {
    expect(buildResumePrompt({ planId: 'pro', interval: 'monthly' }, [])).toEqual({
      visible: true,
      planName: 'pro',
    })
  })
})

describe('producer/consumer cannot drift', () => {
  it('every plan the CTA can send round-trips back into a resumable intent', () => {
    // The redirect (producer) and the mount effect (consumer) both go through
    // plan-intent, so a paid plan can never be sent to /auth and then dropped.
    for (const planId of ['starter', 'pro', 'enterprise'] as const) {
      const callback = buildPricingCallbackUrl(planId, 'monthly')
      const nested = `/auth?callbackUrl=${encodeURIComponent(callback)}`
      const url = new URL(nested, 'https://kingcrmhub.net')
      const restored = url.searchParams.get('callbackUrl')
      const search = restored?.slice(restored.indexOf('?')) ?? ''
      expect(resolveResumeIntent(search), `drift for ${planId}`).toEqual({
        planId,
        interval: 'monthly',
      })
    }
  })
})

// ---------------------------------------------------------------------------
// WIRING GUARD — the PR #220/#221 lesson, applied up front this time.
//
// Every test above exercises pure functions. They would ALL still pass if
// crm-pricing-page.tsx never imported plan-intent at all, which is precisely the
// defect being fixed (a producer with no consumer). So the integration is asserted
// too.
//
// HONEST LIMITATION: this repo has no jsdom/testing-library, so a mount effect
// cannot be executed in a test. This guard is a source-level assertion — weaker
// than a render test, and it would NOT catch a handler that is rendered but never
// invoked. It does catch the failure mode that actually shipped: the module
// existing while nothing consumes it.
// ---------------------------------------------------------------------------
import { readFileSync } from 'node:fs'
import { join } from 'node:path'


const COMPONENT_PATH = join(
  process.cwd(),
  'src',
  'components',
  'pricing',
  'crm-pricing-page.tsx',
)

describe('crm-pricing-page consumes the intent contract (wiring guard)', () => {
  const source = readFileSync(COMPONENT_PATH, 'utf8')

  it('imports the shared contract instead of re-implementing it', () => {
    expect(source).toContain('from "@/lib/billing/plan-intent"')
    expect(source).toContain('resolveResumeIntent')
    expect(source).toContain('buildResumePrompt')
    expect(source).toContain('buildPricingCallbackUrl')
  })

  it('actually READS the query string on mount (the missing consumer)', () => {
    // The original defect: no `location.search` read existed anywhere in pricing.
    expect(source).toContain('window.location.search')
    expect(source).toMatch(/resolveResumeIntent\(window\.location\.search\)/)
  })

  it('renders the prompt through the tested view-model, not inline duplication', () => {
    // Guards against the #221 defect class: logic copied into the component while
    // the tested pure function goes unused.
    expect(source).toContain('buildResumePrompt(resumeIntent, PLANS')
    expect(source).toContain('resumePrompt.visible')
    expect(source).not.toMatch(/PLANS\.find\(\(plan\) => plan\.id === resumeIntent\.planId\)/)
  })

  it('routes the signed-out 401 through the shared builder', () => {
    // Producer side: the redirect and the consumer must build the same URL shape.
    expect(source).toContain('buildPricingCallbackUrl(planId, "monthly")')
    expect(source).not.toMatch(/callbackUrl=\$\{encodeURIComponent\(`\/pricing\?plan=/)
  })

  it('offers Continue and Not-now, and never auto-submits checkout on load', () => {
    expect(source).toContain('data-testid="resume-checkout-continue"')
    expect(source).toContain('data-testid="resume-checkout-dismiss"')
    // The mount effect must only SET state; an auto-POST would bounce a visitor to
    // Stripe with no click. Assert handleCta is invoked from the click handler.
    const mountEffect = source.slice(
      source.indexOf('Read a checkout intent that survived a login redirect'),
      source.indexOf('fetch("/api/billing/status")'),
    )
    expect(mountEffect).toContain('setResumeIntent(intent)')
    expect(mountEffect).not.toContain('handleCta')
    expect(source).toContain('void handleCta(intent.planId)')
  })
})

// ---------------------------------------------------------------------------
// P1 — codex AND cubic found this independently, and it is a MONEY bug I
// introduced. Verified in source:
//   src/app/api/billing/checkout/route.ts:215
//     success_url: `${appBaseUrl}/pricing?checkout=success&plan=${planId}`
//   :216 cancel_url: `${appBaseUrl}/pricing?checkout=canceled&plan=${planId}`
// Neither carries `interval`. My parsePlanIntent defaulted a missing interval to
// monthly, so a COMPLETED checkout's return URL parsed as a valid resume intent —
// the page would offer "Continue your Studio checkout?" on a purchase that had
// just succeeded. Clicking it before Stripe's webhook persists the subscription
// creates a SECOND Checkout Session and exposes the customer to a duplicate
// subscription.
// ---------------------------------------------------------------------------
describe('P1: Stripe return URLs must never resume a checkout', () => {
  it('rejects the checkout=success return URL (plan present, interval absent)', () => {
    expect(resolveResumeIntent('?checkout=success&plan=pro')).toBeNull()
    expect(resolveResumeIntent('?checkout=success&plan=starter')).toBeNull()
    expect(resolveResumeIntent('?checkout=success&plan=enterprise')).toBeNull()
  })

  it('rejects checkout=success even if an interval is appended', () => {
    // Belt and braces: the marker alone disqualifies the intent.
    expect(resolveResumeIntent('?checkout=success&plan=pro&interval=monthly')).toBeNull()
  })

  it('rejects the checkout=canceled return URL', () => {
    expect(resolveResumeIntent('?checkout=canceled&plan=pro')).toBeNull()
  })

  it('requires an EXPLICIT interval for a resume intent — no defaulting', () => {
    // The default-to-monthly behaviour is what made the success URL parse. A
    // resume must carry both halves of the intent it is resuming.
    expect(parsePlanIntent(new URLSearchParams('plan=pro'))).toBeNull()
    expect(parsePlanIntent(new URLSearchParams('plan=pro&interval='))).toBeNull()
    expect(parsePlanIntent(new URLSearchParams('plan=pro&interval=monthly'))).toEqual({
      planId: 'pro',
      interval: 'monthly',
    })
  })

  it('still builds a callbackUrl WITH an explicit interval, so the round trip survives', () => {
    // The producer always writes interval=monthly, so tightening the consumer
    // does not break the intended flow.
    for (const planId of PAID_PLAN_IDS) {
      const callback = buildPricingCallbackUrl(planId, 'monthly')
      expect(callback).toContain('interval=monthly')
      const search = callback.slice(callback.indexOf('?'))
      expect(resolveResumeIntent(search), `round trip for ${planId}`).toEqual({
        planId,
        interval: 'monthly',
      })
    }
  })
})

describe('P2: no duplicated plan-id list (cubic, plan-intent.ts:44)', () => {
  it('uses the canonical catalog guard, not a local copy', () => {
    // The catalog already exports isPlanId and PAID_PLAN_IDS. A second hand-written
    // list drifts silently when a plan is added or removed.
    const catalogIds = PLANS_SOURCE.map((p) => p.planId)
    for (const id of catalogIds) {
      expect(isPlanId(id), `catalog id ${id}`).toBe(true)
      expect(isPlanId(id), `guard must agree with catalog for ${id}`).toBe(catalogIsPlanId(id))
    }
  })

  it('AGREES WITH THE CATALOG IN BOTH DIRECTIONS — accepted set is exactly the catalog', () => {
    // This test exists because mutation testing caught a real hole: the previous
    // version only iterated catalog ids, so a hand-written list containing an EXTRA
    // id (e.g. 'platinum') passed every assertion while `isPlanId('platinum')`
    // wrongly returned true. Acceptance-only checks cannot detect over-acceptance.
    //
    // So: for ids the catalog does NOT know, this guard must also reject them.
    const unknownIds = [
      'platinum', 'team', 'plus', 'premium', 'enterprise2', 'starter2',
      'Pro', 'PRO', 'Studio', 'Elite', 'Free', 'pro ', ' pro', '', 'null',
      'undefined', '__proto__', 'constructor', 'hasOwnProperty',
    ]
    for (const id of unknownIds) {
      expect(catalogIsPlanId(id), `precondition: catalog should reject "${id}"`).toBe(false)
      expect(isPlanId(id), `guard must reject "${id}" that the catalog rejects`).toBe(false)
    }

    // And the accepted set must be EXACTLY the catalog's set, no more.
    const catalogIds = new Set<string>(PLANS_SOURCE.map((p) => p.planId))
    const accepted = [...catalogIds, ...unknownIds].filter(id => isPlanId(id))
    expect(new Set(accepted)).toEqual(catalogIds)
  })

  it('resumes exactly the paid plans in the catalog, and nothing else', () => {
    for (const id of PAID_PLAN_IDS) {
      expect(resolveResumeIntent(`?plan=${id}&interval=monthly`), `${id} should resume`).toEqual({
        planId: id,
        interval: 'monthly',
      })
    }
    // free is in the catalog but is not paid -> not resumable
    expect(resolveResumeIntent('?plan=free&interval=monthly')).toBeNull()
  })

  it('rejects any id the catalog does not know', () => {
    const catalogIds = new Set<string>(PLANS_SOURCE.map((p) => p.planId))
    for (const id of ['platinum', 'team', 'Pro', 'studio', 'enterprise2', '']) {
      if (catalogIds.has(id)) continue
      expect(resolveResumeIntent(`?plan=${id}&interval=monthly`), `"${id}" must be rejected`).toBeNull()
    }
  })
})

describe('crm-pricing-page guards concurrent checkout (cubic P2, wiring guard)', () => {
  const source = readFileSync(COMPONENT_PATH, 'utf8')

  it('locks on a ref, not only async state — same-tick double clicks must be rejected', () => {
    expect(source).toContain('checkoutInFlightRef')
    expect(source).toMatch(/useRef\(false\)/)
    // the synchronous guard must run before any await
    expect(source).toContain('if (checkoutInFlightRef.current) return')
    expect(source).toContain('checkoutInFlightRef.current = true')
    // and must be released in finally, or a failed checkout would lock the page forever
    const finallyBlock = source.slice(source.lastIndexOf('} finally {'))
    expect(finallyBlock).toContain('checkoutInFlightRef.current = false')
  })

  it('disables EVERY plan CTA on the shared flag, not the per-plan one', () => {
    expect(source).toContain('const isCheckoutBusy = loadingPlan !== null')
    expect(source).toContain('disabled={isCheckoutBusy}')
    // the per-plan spinner flag must NOT be what disables the buttons
    expect(source).not.toContain('disabled={isLoading}')
  })

  it('disables the resumed-checkout Continue button while busy', () => {
    const cont = source.slice(
      source.indexOf('data-testid="resume-checkout-continue"'),
      source.indexOf('data-testid="resume-checkout-dismiss"'),
    )
    expect(cont).toContain('disabled={isCheckoutBusy}')
  })
})
