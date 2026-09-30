import { describe, expect, it } from 'vitest'
import { buildPostAuthRedirect } from './post-auth-redirect'

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

  it('routes BOTH post-auth redirects through it (mount effect + submit handler)', () => {
    expect(source.match(/buildPostAuthRedirect\(\{/g)).toHaveLength(2)
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
