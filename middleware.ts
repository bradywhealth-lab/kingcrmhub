import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { applySecurityHeaders } from '@/lib/security'
import { getAuthSecret } from '@/lib/auth-env'

// Static public assets that must never hit the auth redirect: SEO/OG images,
// PWA icons, and metadata files. Anchored, full-path entries.
const PUBLIC_STATIC_ASSETS = new Set([
  '/favicon.ico',
  '/robots.txt',
  '/sitemap.xml',
  '/logo.svg',
  '/og-home.png',
  '/manifest.webmanifest',
])

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Static SEO/PWA assets pass through even if the matcher is ever narrowed
  // (mirrors the matcher exclusion below; keep the two lists in sync).
  if (PUBLIC_STATIC_ASSETS.has(pathname) || pathname.startsWith('/icons/')) {
    const response = NextResponse.next()
    return applySecurityHeaders(request, response)
  }

  // Let API routes pass through — they handle their own auth
  if (pathname.startsWith('/api/')) {
    const response = NextResponse.next()
    return applySecurityHeaders(request, response)
  }

  // Get and validate session using NextAuth's JWT token handler
  const token = await getToken({
    req: request,
    secret: getAuthSecret(),
    cookieName: 'session-token',
  })

  const isAuthenticated = !!token

  // Root route: public landing for visitors, dashboard for signed-in users
  if (pathname === '/' && !isAuthenticated) {
    const url = request.nextUrl.clone()
    url.pathname = '/welcome'
    const response = NextResponse.rewrite(url)
    return applySecurityHeaders(request, response)
  }

  // PWA install assets — browsers fetch these without a session during
  // "Add to Home Screen" (and iOS Safari fetches apple-touch-icon logged-out).
  // The middleware matcher already skips these paths; this explicit
  // pass-through keeps them public even if the matcher is ever narrowed.
  if (pathname === '/manifest.webmanifest' || pathname.startsWith('/icons/')) {
    const response = NextResponse.next()
    return applySecurityHeaders(request, response)
  }

  // Auth page - redirect authenticated users to dashboard
  if (pathname.startsWith('/auth')) {
    if (isAuthenticated) {
      const url = request.nextUrl.clone()
      url.pathname = '/'
      return NextResponse.redirect(url)
    }
    const response = NextResponse.next()
    return applySecurityHeaders(request, response)
  }

  // Public landing routes for visitors; signed-in users stay in the app
  if (pathname === '/welcome' || pathname.startsWith('/welcome/')) {
    if (isAuthenticated) {
      const url = request.nextUrl.clone()
      url.pathname = '/'
      return NextResponse.redirect(url)
    }
    const response = NextResponse.next()
    return applySecurityHeaders(request, response)
  }

  // Public pricing — visitors must be able to evaluate plans before signup.
  if (pathname === '/pricing' || pathname.startsWith('/pricing/')) {
    const response = NextResponse.next()
    return applySecurityHeaders(request, response)
  }

  // Public booking pages (/book/[slug]) — accessible without a session
  if (pathname === '/book' || pathname.startsWith('/book/')) {
    const response = NextResponse.next()
    return applySecurityHeaders(request, response)
  }

  // Public compare page — visitors must be able to see competitor comparison
  if (pathname === '/compare') {
    const response = NextResponse.next()
    return applySecurityHeaders(request, response)
  }

  // Public legal pages — visitors must be able to read terms/privacy before
  // signup (the auth page links to them). Exact paths only: no /terms/* subroutes.
  if (pathname === '/terms' || pathname === '/privacy') {
    const response = NextResponse.next()
    return applySecurityHeaders(request, response)
  }

  // Protected routes - require authentication
  if (!isAuthenticated) {
    const url = request.nextUrl.clone()
    url.pathname = '/auth'
    return NextResponse.redirect(url)
  }

  const response = NextResponse.next()
  return applySecurityHeaders(request, response)
}

export const config = {
  matcher: [
    // Escaped dots + directory boundary (icons/) so unrelated paths like
    // /og-homeXpng or /icons-private can't slip past the middleware.
    '/((?!_next/static|_next/image|favicon\\.ico|robots\\.txt|sitemap\\.xml|logo\\.svg|og-home\\.png|manifest\\.webmanifest|icons/).*)',
  ],
}
