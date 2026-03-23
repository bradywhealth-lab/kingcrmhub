import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { withRequestOrgContext } from '@/lib/request-context'
import { z } from 'zod'
import { parseJsonBody } from '@/lib/validation'
import { enforceRateLimit } from '@/lib/rate-limit'

/**
 * Calculate lead qualification score for auto-trigger
 */
async function qualifyLeadIfNeeded(leadId: string, organizationId: string, significantChange: boolean) {
  if (!significantChange) return

  // Re-qualify the lead
  const lead = await db.lead.findUnique({
    where: { id: leadId },
    select: {
      id: true,
      email: true,
      phone: true,
      company: true,
      title: true,
      firstName: true,
      lastName: true,
      source: true,
      profession: true,
      status: true,
      engagementScore: true,
      totalInteractions: true
    }
  })

  if (!lead) return

  // Calculate new score
  let score = 30
  const insights: string[] = []

  if (lead.email) {
    const domain = lead.email.split('@')[1]
    if (domain && !['gmail.com', 'yahoo.com', 'hotmail.com'].includes(domain)) {
      score += 15
      insights.push('Business email detected')
    }
    score += 5
  }

  if (lead.phone) score += 10
  if (lead.company) score += 10
  if (lead.title) {
    const titleLower = lead.title.toLowerCase()
    if (['ceo', 'cto', 'cfo', 'vp', 'director', 'founder', 'owner'].some(t => titleLower.includes(t))) {
      score += 15
      insights.push('Decision maker identified')
    }
    score += 5
  }

  if (lead.engagementScore > 5 || lead.totalInteractions > 3) {
    score += 15
    insights.push('High engagement lead')
  }

  score = Math.min(100, score)

  let nextAction = 'Research lead'
  if (score >= 80) nextAction = 'Call immediately - hot lead'
  else if (score >= 60) nextAction = 'Send SMS follow-up'
  else if (score >= 40) nextAction = 'Send email introduction'

  await db.lead.update({
    where: { id: leadId },
    data: {
      aiScore: score,
      aiConfidence: 0.7 + Math.random() * 0.2,
      aiNextAction: nextAction,
      aiInsights: insights as any,
      aiLastAnalyzed: new Date()
    }
  })
}

const updateLeadSchema = z.object({
  firstName: z.string().max(120).optional(),
  lastName: z.string().max(120).optional(),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().max(50).optional().or(z.literal('')),
  company: z.string().max(160).optional().or(z.literal('')),
  title: z.string().max(160).optional().or(z.literal('')),
  source: z.string().max(80).optional().or(z.literal('')),
  estimatedValue: z.number().nullable().optional(),
  status: z.string().max(80).optional(),
  aiNextAction: z.string().max(500).optional(),
  touch: z.boolean().optional(),
})

type Params = { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, { params }: Params) {
  try {
    return await withRequestOrgContext(request, async (context) => {
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
        firstName: typeof body.firstName === 'string' ? body.firstName || null : undefined,
        lastName: typeof body.lastName === 'string' ? body.lastName || null : undefined,
        email: typeof body.email === 'string' ? body.email || null : undefined,
        phone: typeof body.phone === 'string' ? body.phone || null : undefined,
        company: typeof body.company === 'string' ? body.company || null : undefined,
        title: typeof body.title === 'string' ? body.title || null : undefined,
        source: typeof body.source === 'string' ? body.source || null : undefined,
        estimatedValue: body.estimatedValue !== undefined ? body.estimatedValue : undefined,
        status: typeof body.status === 'string' ? body.status : undefined,
        aiNextAction: typeof body.aiNextAction === 'string' ? body.aiNextAction : undefined,
        lastContactedAt: body.touch ? new Date() : undefined,
      },
    })

    // Auto-qualify on significant changes
    const significantChange = typeof body.status === 'string' && body.status !== lead.status
    await qualifyLeadIfNeeded(id, context.organizationId, significantChange)

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
    return await withRequestOrgContext(request, async (context) => {
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
