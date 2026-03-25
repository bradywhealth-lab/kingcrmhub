import NextAuth from 'next-auth'
import type { NextRequest } from 'next/server'
import { buildNextAuthOptions } from '@/lib/next-auth'

async function handler(request: NextRequest, context: { params: Promise<{ nextauth: string[] }> }) {
  const params = await context.params
  return NextAuth(buildNextAuthOptions(request))(request, { ...context, params })
}

export { handler as GET, handler as POST }
