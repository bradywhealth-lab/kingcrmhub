import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getOrgContext } from '@/lib/request-context'

export async function POST(request: NextRequest) {
  try {
    const context = await getOrgContext(request)
    if (!context) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const body = await request.json().catch(() => ({}))
    const { leadId, playbook, source = 'manual' } = body as {
      leadId?: string
      playbook?: Record<string, unknown>
      source?: string
    }

    if (!leadId || !playbook) {
      return NextResponse.json({ error: 'leadId and playbook are required' }, { status: 400 })
    }

    const lead = await db.lead.findFirst({
      where: { id: leadId, organizationId: context.organizationId },
    })
    if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 })

    const recommendedCarrier = String(
      ((playbook.recommendedCarrier as Record<string, unknown> | undefined)?.name as string) || 'Unknown carrier'
    )
    const suggestedPlanType = String((playbook.suggestedPlanType as string) || 'N/A')

    const savedActivity = await db.activity.create({
      data: {
        organizationId: context.organizationId,
        leadId,
        type: 'ai_playbook_saved',
        title: `AI carrier playbook saved (${recommendedCarrier})`,
        description: `Suggested plan: ${suggestedPlanType}`,
        metadata: {
          source,
          playbook,
        },
      },
    })

    return NextResponse.json({ activity: savedActivity })
  } catch (error) {
    console.error('Save playbook error:', error)
    return NextResponse.json({ error: 'Failed to save playbook' }, { status: 500 })
  }
}
