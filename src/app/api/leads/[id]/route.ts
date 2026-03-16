import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { withRequestOrgContext } from '@/lib/request-context'
import { z } from 'zod'
import { parseJsonBody } from '@/lib/validation'
import { enforceRateLimit } from '@/lib/rate-limit'

const updateLeadSchema = z.object({
  status: z.string().max(80).optional(),
  aiNextAction: z.string().max(500).optional(),
  touch: z.boolean().optional(),
})

type Params = { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, { params }: Params) {
  try {
    return withRequestOrgContext(request, async (context) => {
    const { id } = await params

    const lead = await db.lead.findFirst({
      where: { id, organizationId: context.organizationId },
      include: {
        tags: { include: { tag: true } },
        activities: {
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
      },
    })
    if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 })

    return NextResponse.json({
      ...lead,
      tags: lead.tags.map((t: { tag: { id: string; name: string; color: string } }) => t.tag),
    })
    })
  } catch (error) {
    console.error('Lead GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch lead' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const limited = enforceRateLimit(request, { key: 'leads-update', limit: 160, windowMs: 60_000 })
    if (limited) return limited
    return withRequestOrgContext(request, async (context) => {
    const { id } = await params
    const parsed = await parseJsonBody(request, updateLeadSchema)
    if (!parsed.success) return parsed.response
    const body = parsed.data

    const lead = await db.lead.findFirst({
      where: { id, organizationId: context.organizationId },
    })
    if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 })

    const updated = await db.lead.update({
      where: { id },
      data: {
        status: typeof body.status === 'string' ? body.status : undefined,
        aiNextAction: typeof body.aiNextAction === 'string' ? body.aiNextAction : undefined,
        lastContactedAt: body.touch ? new Date() : undefined,
      },
    })

    if (typeof body.status === 'string') {
      await db.activity.create({
        data: {
          organizationId: context.organizationId,
          leadId: id,
          type: 'status_change',
          title: `Lead moved to ${body.status}`,
          description: `Status updated to ${body.status}`,
        },
      })
    }

    return NextResponse.json({ lead: updated })
    })
  } catch (error) {
    console.error('Lead PATCH error:', error)
    return NextResponse.json({ error: 'Failed to update lead' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const limited = enforceRateLimit(request, { key: 'leads-delete', limit: 80, windowMs: 60_000 })
    if (limited) return limited
    return withRequestOrgContext(request, async (context) => {
    const { id } = await params

    const lead = await db.lead.findFirst({
      where: { id, organizationId: context.organizationId },
    })
    if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 })

    await db.lead.delete({ where: { id } })

    return NextResponse.json({ success: true })
    })
  } catch (error) {
    console.error('Lead DELETE error:', error)
    return NextResponse.json({ error: 'Failed to delete lead' }, { status: 500 })
  }
}
