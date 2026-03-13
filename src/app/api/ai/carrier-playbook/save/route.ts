import { NextRequest, NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { getOrgContext } from '@/lib/request-context'
import { z } from 'zod'
import { parseJsonBody } from '@/lib/validation'
import { enforceRateLimit } from '@/lib/rate-limit'

const savePlaybookSchema = z.object({
  leadId: z.string().min(1),
  source: z.string().min(1).max(50).optional(),
  playbook: z.record(z.string(), z.unknown()),
})

export async function POST(request: NextRequest) {
  try {
    const limited = enforceRateLimit(request, { key: 'carrier-playbook-save', limit: 40, windowMs: 60_000 })
    if (limited) return limited
    const context = await getOrgContext(request)
    if (!context) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const parsed = await parseJsonBody(request, savePlaybookSchema)
    if (!parsed.success) return parsed.response
    const { leadId, playbook, source = 'manual' } = parsed.data

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
        } as Prisma.InputJsonValue,
      },
    })

    return NextResponse.json({ activity: savedActivity })
  } catch (error) {
    console.error('Save playbook error:', error)
    return NextResponse.json({ error: 'Failed to save playbook' }, { status: 500 })
  }
}
