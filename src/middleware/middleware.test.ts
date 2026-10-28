import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'

// middleware.ts imports next-auth/jwt — mock getToken so no real secret or
// session cookie is needed: the default (undefined token) models a logged-out
// visitor, exactly the case where PWA assets must stay public.
vi.mock('next-auth/jwt', () => ({
  getToken: vi.fn().mockResolvedValue(undefined),
}))

const { middleware, config } = await import('../../middleware')

describe('PWA assets stay public for logged-out visitors', () => {
  it('passes manifest.webmanifest through without an auth redirect', async () => {
    const request = new NextRequest('http://localhost:3000/manifest.webmanifest')
    const response = await middleware(request, undefined as never)

    // NextResponse.next() answers 200 with no Location header — a 307 to
    // /auth is exactly the production bug this test pins down.
    expect(response.status).toBe(200)
    expect(response.headers.get('location')).toBeNull()
  })

  it('passes manifest.json (conventional PWA path) through without an auth redirect', async () => {
    const request = new NextRequest('http://localhost:3000/manifest.json')
    const response = await middleware(request, undefined as never)

    // /manifest.json is the conventional manifest path probed by browsers,
    // crawlers, and PWA audit tooling. Sentinel SENT-20261027-002: it
    // redirected to /auth in production and broke PWA install detection.
    expect(response.status).toBe(200)
    expect(response.headers.get('location')).toBeNull()
  })

  it.each([
    '/icons/icon-192.png',
    '/icons/icon-512.png',
    '/icons/icon-512-maskable.png',
    '/screenshots/pipeline.png',
    '/screenshots/follow-up-guidance.png',
    '/screenshots/automations.png',
  ])('passes %s through without an auth redirect', async (path) => {
    const request = new NextRequest(`http://localhost:3000${path}`)
    const response = await middleware(request, undefined as never)

    expect(response.status).toBe(200)
    expect(response.headers.get('location')).toBeNull()
  })

  it('still rewrites the landing page for logged-out visitors (regression guard)', async () => {
    const request = new NextRequest('http://localhost:3000/')
    const response = await middleware(request, undefined as never)

    // The root rewrite must survive this change: logged-out / stays public
    // via /welcome, proving the middleware still executes for non-PWA paths.
    expect(response.headers.get('x-middleware-rewrite')).toContain('/welcome')
  })

  it('still redirects protected routes to /auth for logged-out visitors', async () => {
    const request = new NextRequest('http://localhost:3000/some-protected-view')
    const response = await middleware(request, undefined as never)

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toContain('/auth')
  })

  it.each(['/terms', '/privacy', '/terms/', '/privacy/'])(
    'passes %s through for logged-out visitors (legal pages linked from signup)',
    async (path) => {
      const request = new NextRequest(`http://localhost:3000${path}`)
      const response = await middleware(request, undefined as never)

      // A 307 to /auth here is exactly the production bug from Sentinel's
      // audit (defect 2): visitors could not read legal pages before signup.
      expect(response.status).toBe(200)
      expect(response.headers.get('location')).toBeNull()
    },
  )

  it('passes /claim through for logged-out visitors (promo claim entry)', async () => {
    const request = new NextRequest('http://localhost:3000/claim')
    const response = await middleware(request, undefined as never)

    expect(response.status).toBe(200)
    expect(response.headers.get('location')).toBeNull()
  })
})

describe('middleware matcher excludes PWA assets', () => {
  // The matcher decides whether middleware runs AT ALL — if it ever regresses
  // to include /manifest.webmanifest or /icons/*, the request skips middleware
  // (fine) but any future narrowing of the pass-through would silently
  // re-privatize them. Pin the exclusion itself (cubic P2, PR #177).
  // Anchored full-path match — Next.js compiles matchers with path-to-regexp
  // and requires the whole pathname to match; without ^/$ an unanchored test
  // would false-positive on the inner slash of /icons/icon-192.png.
  // Guard first: this reconstruction models regex-style matchers. The ONLY
  // path-to-regexp-only marker is a `:name` parameter token (regex never uses
  // colon+identifier); `?`/`*`/`{n}` are legal regex too. If a future matcher
  // uses `:param*` routing syntax, fail HERE with a clear message instead of
  // silently asserting a different match set than Next.js applies.
  const matcherSource = config.matcher[0]
  it('matcher stays regex-compatible so this test block models it faithfully', () => {
    expect(
      /:[a-zA-Z]/.test(matcherSource),
      `matcher uses path-to-regexp :param syntax — rewrite this describe block to compile it the way Next.js does (cubic P3, PR #177)`,
    ).toBe(false)
  })
  const pattern = new RegExp(`^${matcherSource}$`)

  it.each([
    '/manifest.webmanifest',
    '/manifest.json',
    '/icons/icon-192.png',
    '/icons/icon-512.png',
    '/icons/icon-512-maskable.png',
    // These have NO in-middleware pass-through — the matcher exclusion is the
    // ONLY thing keeping them public. Pin them so the same class of bug this
    // PR fixes cannot silently re-privatize them (cubic P3, PR #177).
    '/favicon.ico',
    '/robots.txt',
    '/sitemap.xml',
    '/logo.svg',
    '/screenshots/pipeline.png',
  ])('matcher does not match %s (middleware skipped, asset served statically)', (path) => {
    expect(pattern.test(path)).toBe(false)
  })

  it.each([
    '/',
    '/welcome',
    '/pricing',
    '/some-protected-view',
  ])('matcher still matches %s (middleware protection intact)', (path) => {
    expect(pattern.test(path)).toBe(true)
  })
})

describe('root HTML shared-cache contract (t_3b1d1aa0): cookie-variant responses are never shared-cacheable', () => {
  // `/` is cookie-variant: an anonymous request rewrites to the /welcome
  // marketing prerender while a signed-in request gets the app shell. Next.js
  // advertises BOTH variants as `cache-control: s-maxage=31536000` with no
  // `Vary: Cookie`, which authorizes any shared cache layered in front (CDN,
  // Caddy cache module, corporate proxy) to serve the anonymous marketing
  // variant to signed-in users for a year — the exact t_ae0cffe5 anomaly
  // (marketing HTML inside a valid session). Every response whose bytes
  // depend on the session cookie must opt out of shared caching.
  beforeEach(() => {
    vi.mocked(getToken).mockReset()
  })

  it('logged-out GET / (rewrite to /welcome) carries no-store', async () => {
    vi.mocked(getToken).mockResolvedValue(undefined)
    const request = new NextRequest('http://localhost:3000/')
    const response = await middleware(request, undefined as never)

    expect(response.headers.get('x-middleware-rewrite')).toContain('/welcome')
    expect(response.headers.get('cache-control')).toContain('no-store')
  })

  it('logged-in GET / (app shell) carries no-store', async () => {
    vi.mocked(getToken).mockResolvedValue({ sub: 'user_1', sessionToken: 'session_token_1' })
    const request = new NextRequest('http://localhost:3000/')
    const response = await middleware(request, undefined as never)

    expect(response.headers.get('x-middleware-rewrite')).toBeNull()
    expect(response.headers.get('cache-control')).toContain('no-store')
  })

  it('logged-in GET /welcome (redirect to /) carries no-store', async () => {
    vi.mocked(getToken).mockResolvedValue({ sub: 'user_1', sessionToken: 'session_token_1' })
    const request = new NextRequest('http://localhost:3000/welcome')
    const response = await middleware(request, undefined as never)

    expect(response.headers.get('location')).toBe('http://localhost:3000/')
    expect(response.headers.get('cache-control')).toContain('no-store')
  })

  it('logged-in GET /auth (redirect to /) carries no-store', async () => {
    vi.mocked(getToken).mockResolvedValue({ sub: 'user_1', sessionToken: 'session_token_1' })
    const request = new NextRequest('http://localhost:3000/auth')
    const response = await middleware(request, undefined as never)

    expect(response.headers.get('location')).toBe('http://localhost:3000/')
    expect(response.headers.get('cache-control')).toContain('no-store')
  })

  it('logged-out protected route (307 to /auth) carries no-store', async () => {
    vi.mocked(getToken).mockResolvedValue(undefined)
    const request = new NextRequest('http://localhost:3000/some-protected-view')
    const response = await middleware(request, undefined as never)

    expect(response.status).toBe(307)
    expect(response.headers.get('cache-control')).toContain('no-store')
  })

  it('public /pricing stays shared-cacheable (identical bytes for every requester)', async () => {
    // /pricing passes through middleware with the SAME response for signed-in
    // and anonymous visitors — no cookie variance, so leaving its prerender
    // s-maxage contract intact stays correct. Guard against an over-broad
    // no-store that would silently de-cache every marketing page.
    vi.mocked(getToken).mockResolvedValue({ sub: 'user_1', sessionToken: 'session_token_1' })
    const request = new NextRequest('http://localhost:3000/pricing')
    const response = await middleware(request, undefined as never)

    expect(response.headers.get('location')).toBeNull()
    expect(response.headers.get('cache-control')).toBeNull()
  })
})
