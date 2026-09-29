import type { PlanId } from './plans'

/**
 * Plan-intent contract for the /pricing checkout flow.
 *
 * ## Why this exists
 * DEFECT-1 was reported as "/pricing CTAs silently 401 for signed-out visitors
 * (needs redirect to /auth?callbackUrl)". That literal claim was **falsified by
 * live measurement**: a signed-out `POST /api/billing/checkout` returns
 * HTTP 401 with `content-type: application/json` and body `{"error":"Unauthorized"}`,
 * so `await res.json()` does not throw and the redirect already present at
 * `crm-pricing-page.tsx:206` does run.
 *
 * The real defect found by reading the source: nothing consumes the target.
 * `grep -rn "useSearchParams|searchParams" src/components/pricing/` returns no
 * matches, so a signed-out visitor who clicks a paid plan is sent to
 * `/pricing?plan=pro&interval=monthly`, signs in, lands back on /pricing, and
 * checkout never resumes. The purchase intent is silently dropped — a dead end
 * that presents as "the CTA does nothing".
 *
 * This module is the single validated contract for that intent, shared by the
 * producer (the redirect) and the consumer (the resume effect), so the two
 * cannot drift.
 */

/**
 * Intervals accepted in a resumed checkout intent.
 *
 * Monthly-only: the catalog documents "Yearly billing is NOT built
 * (Brady-confirmed 2026-09-19: monthly only for v1)" and only carries
 * `monthlyPrice`. Accepting `yearly` here would build an intent the checkout
 * route cannot price.
 */
export const PLAN_INTENT_INTERVALS = ['monthly'] as const

export type PlanIntentInterval = (typeof PLAN_INTENT_INTERVALS)[number]

export type PlanIntent = {
  planId: PlanId
  interval: PlanIntentInterval
}

/** The canonical catalog ids. Kept in sync with `PlanId` in ./plans. */
const PLAN_IDS = ['free', 'starter', 'pro', 'enterprise'] as const

/**
 * Runtime guard for a value claimed to be a `PlanId`.
 *
 * Necessary because plan ids arrive from a URL query string. Accepting the
 * marketing names (Pro / Studio / Elite) would be wrong: the catalog maps
 * Free->free, Pro->starter, Studio->pro, Elite->enterprise, so a display name
 * silently selects nothing.
 */
export function isPlanId(value: unknown): value is PlanId {
  return typeof value === 'string' && (PLAN_IDS as readonly string[]).includes(value)
}

function isPlanIntentInterval(value: unknown): value is PlanIntentInterval {
  return typeof value === 'string' && (PLAN_INTENT_INTERVALS as readonly string[]).includes(value)
}

/**
 * Parse and validate a checkout intent from `/pricing` query params.
 *
 * Returns `null` whenever the intent is absent or not actionable, so callers can
 * distinguish "no intent" from "resume this purchase" without guessing:
 * - missing/blank `plan`, or a value that is not a catalog id
 * - an unsupported `interval` (yearly is not built)
 * - `plan=free`, which has no checkout to resume — resuming it would POST
 *   `/api/billing/checkout` with planId `free` and be rejected as
 *   "Invalid paid plan" (route.ts:61). The free CTA should route to sign-up
 *   instead of into a request that is guaranteed to fail.
 *
 * Repeated params take the first value (URLSearchParams#get semantics) so a
 * crafted `?plan=pro&plan=starter` cannot coerce into an array.
 */
export function parsePlanIntent(params: URLSearchParams): PlanIntent | null {
  const planId = params.get('plan')
  if (!isPlanId(planId)) return null
  if (planId === 'free') return null

  const rawInterval = params.get('interval')
  const interval = rawInterval === null ? 'monthly' : rawInterval
  if (!isPlanIntentInterval(interval)) return null

  return { planId, interval }
}

/**
 * Build the same-origin `/pricing` path that carries a checkout intent.
 *
 * Must stay a relative single-slash path: `src/app/auth/page.tsx:193-197`
 * validates `?callbackUrl` and honours only values starting with `/` that are
 * not protocol-relative (`//`) and contain no backslash. Anything else is
 * silently replaced with `/`, which would drop the intent.
 *
 * Throws on an invalid plan id rather than emitting a URL that parses to no
 * intent — a broken link here fails invisibly at the end of a login redirect.
 */
export function buildPricingCallbackUrl(
  planId: PlanId,
  interval: PlanIntentInterval = 'monthly',
): string {
  if (!isPlanId(planId)) {
    throw new Error(`buildPricingCallbackUrl: invalid plan id ${JSON.stringify(planId)}`)
  }
  if (!isPlanIntentInterval(interval)) {
    throw new Error(`buildPricingCallbackUrl: unsupported interval ${JSON.stringify(interval)}`)
  }
  const params = new URLSearchParams({ plan: planId, interval })
  return `/pricing?${params.toString()}`
}

/**
 * Resolve a resume intent from a raw `location.search` string.
 *
 * This is the mount-time seam the pricing page calls. It exists as a pure
 * function (rather than inline `new URLSearchParams(window.location.search)`)
 * because the repo has no jsdom/testing-library — effects cannot be exercised in
 * a test, so the decision logic lives here where it CAN be, and the component
 * stays thin.
 *
 * Deliberately tolerant of a malformed search string: a thrown exception inside
 * a mount effect would break the whole marketing page for every visitor, which
 * is a far worse failure than not resuming one checkout.
 */
export function resolveResumeIntent(search: string | null | undefined): PlanIntent | null {
  if (!search) return null
  try {
    const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
    return parsePlanIntent(params)
  } catch {
    return null
  }
}

/**
 * View-model for the "continue your checkout" prompt.
 *
 * Extracted as a pure function because the repo has no jsdom/testing-library:
 * a React mount effect cannot be exercised in a test, so the decision it makes
 * lives here where it can be asserted directly, and the component stays thin.
 *
 * @param intent     parsed resume intent (null = nothing to offer)
 * @param plans      the rendered catalog, used to map a plan id to its display name
 * @param toastVisible a toast already on screen wins; the two must not stack
 */
export function buildResumePrompt(
  intent: PlanIntent | null,
  plans: ReadonlyArray<{ id: string; name: string }>,
  toastVisible = false,
): { visible: boolean; planName: string | null } {
  if (!intent || toastVisible) return { visible: false, planName: null }

  const match = plans.find((plan) => plan.id === intent.planId)
  // Fall back to the raw id rather than rendering nothing: an unknown id means the
  // catalog and a bookmarked link disagree, and the visitor still has intent worth
  // surfacing.
  return { visible: true, planName: match?.name ?? intent.planId }
}
