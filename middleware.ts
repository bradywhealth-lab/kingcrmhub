import { NextRequest, NextResponse } from 'next/server'
import { applySecurityHeaders } from '@/lib/security'

export function middleware(request: NextRequest) {
  const response = NextResponse.next()
  return applySecurityHeaders(request, response)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|robots.txt|logo.svg).*)'],
}
