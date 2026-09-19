import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { buildNextAuthOptions } from '@/lib/next-auth'
import { stripeModeLabel, stripeMode, isLivePendingActivation } from '@/lib/billing/stripe'

/**
 * Billing status endpoint — powers the honest pricing-page label.
 * Exposes only the mode name, never key material.
 */
export async function GET() {
  const session = await getServerSession(buildNextAuthOptions())

  const mode = stripeMode()
  const active = stripeModeLabel()

  return NextResponse.json({
    authenticated: Boolean(session?.user),
    mode,
    active,
    livePendingActivation: isLivePendingActivation(),
  })
}
