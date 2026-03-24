import NextAuth from 'next-auth'
import type { NextRequest } from 'next/server'
import { buildNextAuthOptions } from '@/lib/next-auth'

function handler(request: NextRequest, context: { params: Promise<{ nextauth: string[] }> }) {
  return NextAuth(buildNextAuthOptions(request))(request, context)
}

export { handler as GET, handler as POST }
