import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { applySecurityHeaders } from '@/lib/security'
import { getAuthSecret } from '@/lib/auth-env'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Get and validate session using NextAuth's JWT token handler
  const token = await getToken({
    req: request,
    secret: getAuthSecret(),
    cookieName: 'session-token',
  })

  const isAuthenticated = !!token

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
  matcher: ['/((?!_next/static|_next/image|favicon.ico|robots.txt|logo.svg).*)'],
}
