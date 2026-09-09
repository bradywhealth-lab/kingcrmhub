import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { promptsForPlan } from '@/lib/prompts'
import { withRequestOrgContext } from '@/lib/request-context'

/** Metadata for all tiers; bodies included only for prompts the org plan unlocks. */
export async function GET(request: NextRequest) {
  try {
    // Awaited deliberately: returning the promise un-awaited would let route
    // errors escape this catch (cubic P2, PR #161).
    return await withRequestOrgContext(request, async ({ organizationId }) => {
      const organization = await db.organization.findUnique({
        where: { id: organizationId },
        select: { plan: true },
      })

      if (!organization) {
        return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
      }

      return NextResponse.json(
        { prompts: promptsForPlan(organization.plan) },
        { headers: { 'Cache-Control': 'private, no-store' } },
      )
    })
  } catch (error) {
    console.error('GET /api/prompts error:', error)
    return NextResponse.json({ error: 'Failed to load prompts' }, { status: 500 })
  }
}
