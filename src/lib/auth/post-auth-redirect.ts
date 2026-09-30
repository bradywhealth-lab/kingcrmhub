/**
 * Post-authentication redirect target.
 *
 * ## Why this exists — cubic P2 (crm-pricing-page.tsx:246, confidence 8)
 * Verified in source, two sites drop the validated callback when a password
 * change is required:
 *   src/app/auth/page.tsx:201
 *     router.push(session?.user?.mustChangePassword ? '/auth/password' : safeCallback)
 *   src/app/auth/page.tsx:92
 *     router.replace(session.user.mustChangePassword ? '/auth/password' : '/')
 *
 * `/auth/password` ALREADY reads `?callbackUrl` (password/page.tsx:36) and
 * honours it after setup completes. So the only missing piece is forwarding it —
 * without that, a visitor who clicks a paid plan on /pricing, signs in, and is
 * forced through password setup loses the purchase intent entirely and lands on
 * `/` instead of back on /pricing.
 *
 * Extracted as a pure function because this repo has no jsdom/testing-library:
 * the decision is assertable here, and the two auth call sites become one-liners.
 */

/** Where a user is sent when a password change is required. */
const PASSWORD_ROUTE = '/auth/password'

/**
 * Same-origin absolute-path check.
 *
 * Mirrors the existing validator at `src/app/auth/page.tsx:194-197` and
 * `src/app/auth/password/page.tsx:37-40`: a single leading slash, never
 * protocol-relative (`//host`), never a backslash. This helper must not become a
 * second, weaker route to an open redirect — it builds a URL that the auth flow
 * will navigate to.
 */
function isSafeSameOriginPath(path: string): boolean {
  if (!path.startsWith('/')) return false
  if (path.startsWith('//')) return false
  if (path.includes('\\')) return false
  // Reject anything that is not a plain path+query (e.g. embedded control chars).
  return !/[\s"'<>]/.test(path)
}

export type PostAuthRedirectInput = {
  /** `session.user.mustChangePassword` — the forced password-setup flag. */
  mustChangePassword: boolean
  /**
   * The already-validated `?callbackUrl` from the auth page (defaults to `/`).
   * Must be a same-origin absolute path; anything else is treated as absent.
   */
  callbackPath: string
}

/**
 * Compute where to send the user after sign-in.
 *
 * - No password change required → the callback path (or `/` if it is unsafe).
 * - Password change required → `/auth/password`, carrying the callback forward so
 *   the intent survives setup. No `callbackUrl` is appended when the callback is
 *   root or is already the password route (avoids a pointless/recursive param).
 *
 * Never throws and never returns an unsafe target.
 */
export function buildPostAuthRedirect({
  mustChangePassword,
  callbackPath,
}: PostAuthRedirectInput): string {
  const safeCallback = isSafeSameOriginPath(callbackPath) ? callbackPath : '/'

  if (!mustChangePassword) return safeCallback

  // Root or the password route itself carries no intent worth forwarding.
  if (safeCallback === '/' || safeCallback === PASSWORD_ROUTE) return PASSWORD_ROUTE

  return `${PASSWORD_ROUTE}?callbackUrl=${encodeURIComponent(safeCallback)}`
}
