import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { withRequestOrgContext } from '@/lib/request-context'
import { readClaimGrantInfo, resolveEffectivePlan } from '@/lib/claim/entitlement-info'

/**
 * GET /api/billing/grant — in-app grant status for the day-21 nudge banner.
 * Server-side only: computes the effective plan from the org row (stored plan
 * + grant settings + Stripe subscription liveness) so the day-31 lazy fallback
 * to Free is enforced by the server, never spoofed client-side.
 */
export async function GET(request: NextRequest) {
  try {
    return await withRequestOrgContext(request, async ({ organizationId }) => {
      const organization = await db.organization.findUnique({
        where: { id: organizationId },
        select: {
          plan: true,
          settings: true,
          stripeSubscriptionStatus: true,
        },
      })

      if (!organization) {
        return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
      }

      const grant = readClaimGrantInfo(organization.settings)
      const effective = resolveEffectivePlan(organization)

      return NextResponse.json(
        {
          grant: grant
            ? {
                active: grant.active,
                daysLeft: grant.daysLeft,
                nudgeAt: grant.nudgeAt,
                expiresAt: grant.expiresAt,
              }
            : null,
          plan: effective.plan,
          grantActive: effective.grantActive,
          grantExpired: effective.grantExpired,
        },
        { headers: { 'Cache-Control': 'private, no-store' } },
      )
    })
  } catch (error) {
    console.error('GET /api/billing/grant error:', error)
    return NextResponse.json({ error: 'Failed to load grant status' }, { status: 500 })
  }
}
