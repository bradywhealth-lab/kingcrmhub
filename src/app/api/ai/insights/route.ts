import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { withRequestOrgContext } from '@/lib/request-context'

type InsightPayload = {
  id: string
  type: 'trend' | 'prediction' | 'recommendation' | 'alert'
  category: string | null
  title: string
  description: string
  data: Record<string, unknown> | null
  confidence: number | null
  actionable: boolean
  dismissed: boolean
  createdAt: string
}

export async function GET(request: NextRequest) {
  try {
    return await withRequestOrgContext(request, async (context) => {
      const limit = Math.max(1, Math.min(12, Number(request.nextUrl.searchParams.get('limit') || '6')))

      const storedInsights = await db.aIInsight.findMany({
        where: {
          organizationId: context.organizationId,
          dismissed: false,
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
      })

      if (storedInsights.length > 0) {
        return NextResponse.json({
          insights: storedInsights.map((insight) => ({
            id: insight.id,
            type: normalizeInsightType(insight.type),
            category: insight.category,
            title: insight.title,
            description: insight.description,
            data: toObject(insight.data),
            confidence: insight.confidence,
            actionable: insight.actionable,
            dismissed: insight.dismissed,
            createdAt: insight.createdAt.toISOString(),
          })),
          source: 'stored',
        })
      }

      const generated = await buildFallbackInsights(context.organizationId)
      return NextResponse.json({
        insights: generated.slice(0, limit),
        source: 'generated',
      })
    })
  } catch (error) {
    console.error('AI insights GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch AI insights' }, { status: 500 })
  }
}

async function buildFallbackInsights(organizationId: string): Promise<InsightPayload[]> {
  const now = new Date()
  const staleCutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

  const [topLead, staleLeads, wonDealsThisMonth, pipelineItems, newLeadsToday] = await Promise.all([
    db.lead.findFirst({
      where: { organizationId },
      orderBy: [{ aiScore: 'desc' }, { updatedAt: 'desc' }],
      select: {
        id: true,
        firstName: true,
        lastName: true,
        company: true,
        aiScore: true,
        aiNextAction: true,
      },
    }),
    db.lead.findMany({
      where: {
        organizationId,
        status: { notIn: ['won', 'lost'] },
        OR: [
          { lastContactedAt: null },
          { lastContactedAt: { lt: staleCutoff } },
        ],
      },
      orderBy: [{ aiScore: 'desc' }, { updatedAt: 'desc' }],
      take: 5,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        company: true,
      },
    }),
    db.pipelineItem.count({
      where: {
        pipeline: { organizationId },
        stage: { name: { equals: 'Won', mode: 'insensitive' } },
        updatedAt: { gte: monthStart },
      },
    }),
    db.pipelineItem.findMany({
      where: { pipeline: { organizationId } },
      include: { stage: true },
    }),
    db.lead.count({
      where: {
        organizationId,
        createdAt: { gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()) },
      },
    }),
  ])

  const totalPipelineValue = pipelineItems.reduce((sum, item) => sum + (item.value || 0), 0)
  const weightedPipelineValue = pipelineItems.reduce((sum, item) => {
    const stageProbability = item.stage?.probability ?? item.probability ?? 0
    return sum + (item.value || 0) * (stageProbability / 100)
  }, 0)

  const insights: InsightPayload[] = []

  if (topLead) {
    const leadName =
      `${topLead.firstName || ''} ${topLead.lastName || ''}`.trim() || topLead.company || 'Top lead'
    insights.push({
      id: `generated-top-lead-${topLead.id}`,
      type: 'recommendation',
      category: 'leads',
      title: `${leadName} is your hottest lead`,
      description: topLead.aiNextAction || `AI score ${topLead.aiScore}. Prioritize this contact in the next outreach block.`,
      data: {
        leadId: topLead.id,
        aiScore: topLead.aiScore,
      },
      confidence: Math.min(0.97, 0.65 + topLead.aiScore / 250),
      actionable: true,
      dismissed: false,
      createdAt: now.toISOString(),
    })
  }

  if (staleLeads.length > 0) {
    insights.push({
      id: 'generated-stale-leads',
      type: 'alert',
      category: 'leads',
      title: `${staleLeads.length} leads need follow-up`,
      description: 'These active leads have not been contacted in at least 7 days or have never been contacted.',
      data: {
        leadIds: staleLeads.map((lead) => lead.id),
      },
      confidence: 0.92,
      actionable: true,
      dismissed: false,
      createdAt: now.toISOString(),
    })
  }

  insights.push({
    id: 'generated-pipeline-forecast',
    type: 'prediction',
    category: 'pipeline',
    title: 'Pipeline forecast',
    description:
      totalPipelineValue > 0
        ? `Current pipeline is worth $${Math.round(totalPipelineValue).toLocaleString()}, with weighted value around $${Math.round(weightedPipelineValue).toLocaleString()}.`
        : 'No active pipeline value yet. Create or import deals to build a reliable forecast.',
    data: {
      totalPipelineValue,
      weightedPipelineValue,
    },
    confidence: totalPipelineValue > 0 ? 0.78 : 0.6,
    actionable: totalPipelineValue === 0,
    dismissed: false,
    createdAt: now.toISOString(),
  })

  insights.push({
    id: 'generated-month-performance',
    type: wonDealsThisMonth > 0 ? 'trend' : 'recommendation',
    category: 'performance',
    title: wonDealsThisMonth > 0 ? 'Closed-won momentum this month' : 'No wins recorded this month yet',
    description:
      wonDealsThisMonth > 0
        ? `${wonDealsThisMonth} deals have reached the won stage since ${monthStart.toLocaleDateString()}.`
        : 'Push qualified and proposal-stage deals forward to create visible revenue movement this month.',
    data: {
      wonDealsThisMonth,
      newLeadsToday,
    },
    confidence: wonDealsThisMonth > 0 ? 0.82 : 0.72,
    actionable: wonDealsThisMonth === 0,
    dismissed: false,
    createdAt: now.toISOString(),
  })

  return insights
}

function normalizeInsightType(value: string): InsightPayload['type'] {
  if (value === 'prediction' || value === 'recommendation' || value === 'trend' || value === 'alert') {
    return value
  }
  return 'recommendation'
}

function toObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}
