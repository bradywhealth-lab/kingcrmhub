import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

const ORGANIZATION_ID = 'demo-org-1'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = Math.max(1, Math.min(25, Number(searchParams.get('limit') || '8')))

    const [priorityLeads, todayMeetings] = await Promise.all([
      db.lead.findMany({
        where: { organizationId: ORGANIZATION_ID },
        orderBy: [{ aiScore: 'desc' }, { updatedAt: 'desc' }],
        take: limit,
      }),
      db.activity.findMany({
        where: {
          organizationId: ORGANIZATION_ID,
          type: 'meeting',
        },
        include: { lead: true },
        orderBy: { createdAt: 'desc' },
        take: limit,
      }),
    ])

    const leadsToCall = priorityLeads.map((lead) => ({
      id: lead.id,
      name: `${lead.firstName || ''} ${lead.lastName || ''}`.trim() || lead.email || 'Unknown lead',
      company: lead.company,
      phone: lead.phone,
      aiScore: lead.aiScore,
      aiNextAction: lead.aiNextAction,
      status: lead.status,
      reason:
        lead.aiScore >= 85
          ? 'High qualification score'
          : lead.aiNextAction || 'Recommended for daily follow-up',
    }))

    const meetings = todayMeetings.map((m) => ({
      id: m.id,
      title: m.title,
      description: m.description,
      time: m.createdAt,
      lead: m.lead
        ? {
            id: m.lead.id,
            name: `${m.lead.firstName || ''} ${m.lead.lastName || ''}`.trim(),
            company: m.lead.company,
          }
        : null,
      metadata: m.metadata,
    }))

    const summary = `You have ${leadsToCall.length} prioritized leads and ${meetings.length} meetings in focus. Top lead score is ${leadsToCall[0]?.aiScore ?? 0}.`

    return NextResponse.json({
      date: new Date().toISOString(),
      summary,
      leadsToCall,
      meetings,
    })
  } catch (error) {
    console.error('AI my-day error:', error)
    return NextResponse.json({ error: 'Failed to load daily AI plan' }, { status: 500 })
  }
}
