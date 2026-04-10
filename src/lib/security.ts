import { NextRequest, NextResponse } from 'next/server'
import { getAuthBaseUrl } from '@/lib/auth-env'

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

function getAllowedOrigins(request: NextRequest): string[] {
  const allowed = new Set<string>([request.nextUrl.origin])

  const authBaseUrl = getAuthBaseUrl()
  if (authBaseUrl) {
    try {
      allowed.add(new URL(authBaseUrl).origin)
    } catch {
      // Ignore malformed auth base URL.
    }
  }

  const appBaseUrl = process.env.APP_BASE_URL?.trim()
  if (appBaseUrl) {
    try {
      allowed.add(new URL(appBaseUrl).origin)
    } catch {
      // Ignore malformed app base URL.
    }
  }

  return [...allowed]
}

function getRequestOrigin(request: NextRequest): string | null {
  const originHeader = request.headers.get('origin')?.trim()
  if (originHeader) return originHeader

  const refererHeader = request.headers.get('referer')?.trim()
  if (!refererHeader) return null

  try {
    return new URL(refererHeader).origin
  } catch {
    return null
  }
}

export function isUnsafeMethod(method: string): boolean {
  return !SAFE_METHODS.has(method.toUpperCase())
}

export function enforceSameOrigin(request: NextRequest): NextResponse | null {
  if (!isUnsafeMethod(request.method)) return null

  const requestOrigin = getRequestOrigin(request)
  if (!requestOrigin) return null

  const allowedOrigins = getAllowedOrigins(request)
  if (allowedOrigins.includes(requestOrigin)) return null

  return NextResponse.json(
    { error: 'Cross-site request blocked', details: `origin ${requestOrigin} not in ${allowedOrigins.join(', ')}` },
    { status: 403 },
  )
}

export function applySecurityHeaders(request: NextRequest, response: NextResponse): NextResponse {
  const isApiRoute = request.nextUrl.pathname.startsWith('/api/')
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === 'development' ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data: https:",
    "connect-src 'self' https: wss:",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    process.env.NODE_ENV === 'production' ? 'upgrade-insecure-requests' : '',
  ]
    .filter(Boolean)
    .join('; ')

  response.headers.set('Content-Security-Policy', csp)
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=()')
  response.headers.set('Cross-Origin-Opener-Policy', 'same-origin')
  response.headers.set('Cross-Origin-Resource-Policy', isApiRoute ? 'same-site' : 'same-origin')

  if (process.env.NODE_ENV === 'production') {
    response.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload')
  }

  if (isApiRoute) {
    response.headers.set('Cache-Control', 'no-store, max-age=0')
  }

  return response
}
