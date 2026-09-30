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
 * MUST behave identically to the existing validators at `src/app/auth/page.tsx:194-197`
 * and `src/app/auth/password/page.tsx:37-40`: a single leading slash, never
 * protocol-relative (`//host`), never a backslash.
 *
 * cubic P2 (confidence 8) caught a regression I introduced here: my first version
 * also rejected whitespace and quotes, which is STRICTER than the validator that
 * already approved this value upstream. So a legitimate callback such as
 * `/welcome back` was accepted by /auth and then silently dropped by this helper,
 * losing the redirect — and losing it entirely on the password-setup path.
 *
 * Being stricter than the caller is not "defence in depth" here, it is a
 * behaviour divergence that drops valid input. The only additional rejection is
 * genuine CONTROL characters (CRLF, tab, NUL, DEL), which cannot appear in a
 * legitimate path and are the ones worth refusing. Printable characters such as
 * spaces and quotes are left to the existing rules; they are percent-encoded by
 * `encodeURIComponent` below and escaped by React on render.
 */
/**
 * Genuine control characters (CRLF, tab, NUL, DEL). Rejected because they cannot
 * appear in a legitimate path and are the ones worth refusing. The unicode-escape
 * form is used so no eslint control-regex exemption is needed.
 */
const CONTROL_CHARS = /[\u0000-\u001F\u007F]/

function isSafeSameOriginPath(path: string): boolean {
  if (!path.startsWith('/')) return false
  if (path.startsWith('//')) return false
  if (path.includes('\\')) return false
  return !CONTROL_CHARS.test(path)
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
