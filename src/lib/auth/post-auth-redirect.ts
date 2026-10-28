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

// ---------------------------------------------------------------------------
// t_ae4ae1a9 (Item A) — exactly ONE post-auth navigation per auth event.
//
// src/app/auth/page.tsx carries TWO independent post-auth navigation
// triggers: the submit handler (router.push) and the mount effect
// (router.replace). The router.refresh() queued right after signIn
// re-renders / re-suspends the page, which re-runs the mount effect AFTER the
// session cookie lands — so both triggers can fire for ONE auth event and
// navigate the callback target twice. Live observation (t_ae0cffe5,
// 2026-10-27): a fresh free-plan org auto-navigated to /pricing TWICE
// post-signup (paid-CTA callbackUrl); paid orgs unaffected.
//
// This planner is the single decision point: the caller flips a per-event
// guard when a navigation is issued, and every later trigger for the same
// event (the refresh-induced mount re-run) receives `alreadyNavigated: true`
// and becomes a no-op. Extracted as a pure function because this repo has no
// jsdom/testing-library — the React effect itself cannot be exercised in a
// test, so the decision lives here where it CAN be asserted (same discipline
// as buildPostAuthRedirect and plan-intent.ts).
// ---------------------------------------------------------------------------

/** Which of the two auth-page triggers is asking to navigate. */
export type PostAuthNavTrigger = 'mount' | 'submit'

export type PostAuthNavPlan =
  | { navigate: false }
  | { navigate: true; target: string; history: 'push' | 'replace' }

export type PostAuthNavigationInput = PostAuthRedirectInput & {
  /** The trigger asking to navigate: the submit handler, or the mount effect. */
  trigger: PostAuthNavTrigger
  /**
   * True when a navigation has ALREADY been issued for this auth event. A ref
   * in auth/page.tsx flips when the first navigation fires; a fresh page load
   * resets it (a new load is a new auth event, and the already-authed mount
   * redirect must still work there).
   */
  alreadyNavigated: boolean
}

/**
 * Decide whether to navigate after authentication, and how.
 *
 * - No navigation has fired yet → navigate to the (validated) redirect
 *   target. The submit trigger pushes (a user action created the history
 *   entry); the mount trigger replaces (an ambient redirect should not
 *   leave /auth in the back stack).
 * - A navigation already fired for this auth event → do nothing. The
 *   double-navigation is the defect this exists to prevent.
 *
 * Never throws and never returns an unsafe target: the target comes from
 * buildPostAuthRedirect, which applies the same-origin validation.
 */
export function planPostAuthNavigation({
  trigger,
  alreadyNavigated,
  mustChangePassword,
  callbackPath,
}: PostAuthNavigationInput): PostAuthNavPlan {
  if (alreadyNavigated) return { navigate: false }

  return {
    navigate: true,
    target: buildPostAuthRedirect({ mustChangePassword, callbackPath }),
    history: trigger === 'mount' ? 'replace' : 'push',
  }
}
