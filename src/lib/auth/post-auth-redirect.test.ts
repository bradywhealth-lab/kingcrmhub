import { describe, expect, it } from 'vitest'
import { buildPostAuthRedirect, planPostAuthNavigation } from './post-auth-redirect'

// ---------------------------------------------------------------------------
// cubic P2 (crm-pricing-page.tsx:246, confidence 8) — VERIFIED in source:
//   src/app/auth/page.tsx:201
//     router.push(session?.user?.mustChangePassword ? '/auth/password' : safeCallback)
//   src/app/auth/page.tsx:92
//     router.replace(session.user.mustChangePassword ? '/auth/password' : '/')
// Both DROP the validated callbackUrl when a password change is required, and
// /auth/password:36 already reads ?callbackUrl (defaulting to '/'). So a visitor
// forced through password setup loses the pricing resume intent entirely.
// ---------------------------------------------------------------------------

describe('buildPostAuthRedirect', () => {
  it('returns the callback path when no password change is required', () => {
    expect(
      buildPostAuthRedirect({ mustChangePassword: false, callbackPath: '/pricing?plan=pro&interval=monthly' }),
    ).toBe('/pricing?plan=pro&interval=monthly')
  })

  it('PRESERVES the callback through forced password setup', () => {
    expect(
      buildPostAuthRedirect({ mustChangePassword: true, callbackPath: '/pricing?plan=pro&interval=monthly' }),
    ).toBe('/auth/password?callbackUrl=%2Fpricing%3Fplan%3Dpro%26interval%3Dmonthly')
  })

  it('round-trips: /auth/password can read the forwarded callback back out', () => {
    const redirect = buildPostAuthRedirect({
      mustChangePassword: true,
      callbackPath: '/pricing?plan=starter&interval=monthly',
    })
    const url = new URL(redirect, 'https://kingcrmhub.net')
    expect(url.pathname).toBe('/auth/password')
    expect(url.searchParams.get('callbackUrl')).toBe('/pricing?plan=starter&interval=monthly')
  })

  it('does not nest a callbackUrl when the target is already /auth/password', () => {
    expect(
      buildPostAuthRedirect({ mustChangePassword: true, callbackPath: '/auth/password' }),
    ).toBe('/auth/password')
  })

  it('falls back to /auth/password with no callback when the path is root', () => {
    expect(buildPostAuthRedirect({ mustChangePassword: true, callbackPath: '/' })).toBe('/auth/password')
    expect(buildPostAuthRedirect({ mustChangePassword: false, callbackPath: '/' })).toBe('/')
  })

  it('rejects anything that is not a safe same-origin path', () => {
    // auth/page.tsx:194-197 already validates callbackUrl to a single-slash path.
    // This helper must not become a second, weaker path to an open redirect.
    for (const bad of [
      '//evil.com/pricing',
      'https://evil.com/pricing',
      '/\\evil.com',
      'javascript:alert(1)',
      '',
      'pricing?plan=pro',
    ]) {
      expect(
        buildPostAuthRedirect({ mustChangePassword: true, callbackPath: bad }),
        `must not forward "${bad}"`,
      ).toBe('/auth/password')
      expect(
        buildPostAuthRedirect({ mustChangePassword: false, callbackPath: bad }),
        `must not return "${bad}"`,
      ).toBe('/')
    }
  })

  it('rejects CONTROL characters, which cannot appear in a legitimate path', () => {
    for (const bad of ['/pricing\n', '/pricing\r\nSet-Cookie: x', '/pricing\t', '/pri\u0000cing', '/pricing\u007F']) {
      expect(
        buildPostAuthRedirect({ mustChangePassword: true, callbackPath: bad }),
        `must not forward a path containing control chars`,
      ).toBe('/auth/password')
      expect(buildPostAuthRedirect({ mustChangePassword: false, callbackPath: bad })).toBe('/')
    }
  })

  it('PRESERVES printable paths the upstream validator already accepts (cubic P2)', () => {
    // My first version rejected these, silently dropping a callback that /auth had
    // approved. They are percent-encoded when nested and escaped by React on render.
    for (const ok of ['/welcome back', "/pricing?plan=pro&note=a'b", '/p?q="x"', '/a<b>']) {
      expect(
        buildPostAuthRedirect({ mustChangePassword: false, callbackPath: ok }),
        `must return "${ok}" unchanged`,
      ).toBe(ok)

      const nested = buildPostAuthRedirect({ mustChangePassword: true, callbackPath: ok })
      expect(nested.startsWith('/auth/password?callbackUrl='), `must forward "${ok}"`).toBe(true)
      const restored = new URL(nested, 'https://kingcrmhub.net').searchParams.get('callbackUrl')
      expect(restored, `round trip for "${ok}"`).toBe(ok)
    }
  })

  it('behaves EXACTLY like the repo validator, plus control chars', () => {
    // Parity guard: this helper must never be stricter than the validator whose
    // output it consumes, or valid callbacks get dropped mid-flow.
    const upstreamAccepts = (p: string) =>
      p.startsWith('/') && !p.startsWith('//') && !p.includes('\\')
    const cases = [
      '/', '/pricing', '/pricing?plan=pro&interval=monthly', '/welcome back',
      '/a?b=c d', "/x'y", '/x"y', '/x<y>z', '//evil.com', '/\\evil.com',
      'relative', '', 'javascript:alert(1)', '/ok\n', '/ok\t',
    ]
    for (const c of cases) {
      const accepted = buildPostAuthRedirect({ mustChangePassword: false, callbackPath: c }) === c
      const hasControl = /[\u0000-\u001F\u007F]/.test(c)
      expect(accepted, `"${c}" parity`).toBe(upstreamAccepts(c) && !hasControl)
    }
  })

  it('is idempotent for an already-encoded callback', () => {
    const once = buildPostAuthRedirect({ mustChangePassword: true, callbackPath: '/pricing?plan=pro&interval=monthly' })
    expect(once).not.toContain('callbackUrl=%252F') // not double-encoded
    expect(once.match(/callbackUrl=/g)).toHaveLength(1)
  })
})

// ---------------------------------------------------------------------------
// t_ae4ae1a9 (Item A) — the post-signup DOUBLE navigation to the callback
// target.
//
// VERIFIED IN SOURCE (src/app/auth/page.tsx): the page carries TWO independent
// post-auth navigation triggers —
//   1. the submit handler: router.push(buildPostAuthRedirect(...)) + router.refresh()
//   2. the mount effect:   router.replace(buildPostAuthRedirect(...)) + router.refresh()
// The refresh() queued right after signIn re-renders / re-suspends the page,
// which re-runs the mount effect AFTER the session cookie lands — so BOTH
// triggers can fire for ONE auth event. Live observation (t_ae0cffe5,
// 2026-10-27): a fresh free-plan org auto-navigated to /pricing TWICE
// post-signup (paid-CTA callbackUrl /pricing?plan=...); paid orgs unaffected.
// CodeForge live re-measurement (same day): the race usually coalesces into a
// single navigation, but the structure permits two — the fix makes two
// structurally impossible: ONE navigation owner, guarded per auth event.
//
// Intended post-signup sequences (verified live on prod + source):
//   free-plan signup (no checkout intent): /auth?mode=signup -> ONE
//   navigation to '/' (dashboard) with the onboarding wizard. A /pricing
//   visit is NOT part of the free-plan onboarding design.
//   paid-CTA signup (checkout intent): ONE navigation to /pricing?plan=...
//   where the resume prompt offers the checkout (pinned in plan-intent.test.ts).
// ---------------------------------------------------------------------------
describe('planPostAuthNavigation (exactly one navigation per auth event)', () => {
  it('issues a push navigation for the submit trigger', () => {
    const plan = planPostAuthNavigation({
      trigger: 'submit',
      alreadyNavigated: false,
      mustChangePassword: false,
      callbackPath: '/pricing?plan=starter&interval=monthly',
    })
    expect(plan).toEqual({
      navigate: true,
      target: '/pricing?plan=starter&interval=monthly',
      history: 'push',
    })
  })

  it('suppresses the mount re-trigger once a submit navigation fired (the /pricing double-nav)', () => {
    // The refresh()-induced mount re-run arrives AFTER the submit handler has
    // already navigated. It must be a no-op, or the callback target is
    // navigated twice — the exact anomaly observed on the fresh free-plan org.
    const plan = planPostAuthNavigation({
      trigger: 'mount',
      alreadyNavigated: true,
      mustChangePassword: false,
      callbackPath: '/pricing?plan=starter&interval=monthly',
    })
    expect(plan).toEqual({ navigate: false })
  })

  it('still navigates a fresh page-load mount for an already-authed visitor (replace, not push)', () => {
    // The mount-effect redirect for an already-authenticated /auth visit must
    // survive the guard — a ref resets on every full page load, and this path
    // is the one that redirects visitors who land on /auth with a session.
    const plan = planPostAuthNavigation({
      trigger: 'mount',
      alreadyNavigated: false,
      mustChangePassword: false,
      callbackPath: '/',
    })
    expect(plan).toEqual({ navigate: true, target: '/', history: 'replace' })
  })

  it('pins the free-plan post-signup sequence: ONE navigation to the dashboard root, never /pricing', () => {
    // Full trigger sequence for a free-plan signup (no callbackUrl):
    // submit navigates, then the refresh-induced mount re-trigger fires.
    const sequence = [
      planPostAuthNavigation({
        trigger: 'submit',
        alreadyNavigated: false,
        mustChangePassword: false,
        callbackPath: '/',
      }),
      planPostAuthNavigation({
        trigger: 'mount',
        alreadyNavigated: true,
        mustChangePassword: false,
        callbackPath: '/',
      }),
    ]
    const navigations = sequence.filter((p) => p.navigate)
    expect(navigations).toHaveLength(1)
    expect(navigations[0]).toEqual({ navigate: true, target: '/', history: 'push' })
    expect(navigations[0].target).not.toContain('/pricing')
  })

  it('pins the paid-CTA signup sequence: the /pricing resume target, exactly once', () => {
    const sequence = [
      planPostAuthNavigation({
        trigger: 'submit',
        alreadyNavigated: false,
        mustChangePassword: false,
        callbackPath: '/pricing?plan=starter&interval=monthly',
      }),
      planPostAuthNavigation({
        trigger: 'mount',
        alreadyNavigated: true,
        mustChangePassword: false,
        callbackPath: '/pricing?plan=starter&interval=monthly',
      }),
    ]
    const navigations = sequence.filter((p) => p.navigate)
    expect(navigations).toHaveLength(1)
    expect(navigations[0].target).toBe('/pricing?plan=starter&interval=monthly')
  })

  it('forwards the forced-password-change branch through the same single-shot contract', () => {
    const plan = planPostAuthNavigation({
      trigger: 'submit',
      alreadyNavigated: false,
      mustChangePassword: true,
      callbackPath: '/pricing?plan=pro&interval=monthly',
    })
    expect(plan).toEqual({
      navigate: true,
      target: '/auth/password?callbackUrl=%2Fpricing%3Fplan%3Dpro%26interval%3Dmonthly',
      history: 'push',
    })
  })
})

// ---------------------------------------------------------------------------
// WIRING GUARD — same discipline as plan-intent.test.ts. The pure tests above all
// pass even if auth/page.tsx never imports this helper, which is exactly the
// defect being fixed. Source-level assertion; HONEST LIMITATION: with no jsdom in
// this repo the redirect cannot be executed in a test.
// ---------------------------------------------------------------------------
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const AUTH_PAGE = join(process.cwd(), 'src', 'app', 'auth', 'page.tsx')

describe('auth/page.tsx preserves callbackUrl (wiring guard)', () => {
  const source = readFileSync(AUTH_PAGE, 'utf8')

  it('imports the tested helper', () => {
    expect(source).toContain("from '@/lib/auth/post-auth-redirect'")
  })

  it('routes BOTH post-auth triggers through the single-shot planner (mount effect + submit handler)', () => {
    // t_ae4ae1a9: both navigation triggers must decide through
    // planPostAuthNavigation so exactly one navigation can fire per auth event.
    expect(source.match(/planPostAuthNavigation\(\{/g)).toHaveLength(2)
    // The page must no longer call buildPostAuthRedirect directly — a direct
    // call is a second, unguarded decision point (the double-nav defect class).
    expect((source.match(/buildPostAuthRedirect\(\{/g) ?? []).length).toBe(0)
  })

  it('flips an in-flight guard so the second trigger cannot double-navigate', () => {
    // The ref is the single-shot latch: whichever trigger navigates first wins.
    expect(source).toContain('postAuthNavDoneRef')
    expect(source.match(/postAuthNavDoneRef\.current = true/g)).toHaveLength(2)
  })

  it('no longer hardcodes the callback-dropping ternary', () => {
    // The two defective lines cubic flagged.
    expect(source).not.toContain("mustChangePassword ? '/auth/password' : safeCallback")
    expect(source).not.toContain("mustChangePassword ? '/auth/password' : '/'")
  })

  it('hoists safeCallback to component scope so the mount effect can use it', () => {
    // Previously it was local to handleSubmit, invisible to the mount effect.
    expect(source).toMatch(/const safeCallback = useMemo\(/)
    // exactly one declaration — no duplicate shadowing
    expect(source.match(/const safeCallback =/g)).toHaveLength(1)
  })

  it('still validates callbackUrl as a same-origin path before use', () => {
    expect(source).toContain("searchParams.get('callbackUrl')")
    expect(source).toContain("startsWith('//')")
  })
})
