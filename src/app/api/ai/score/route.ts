import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getOrgContext } from '@/lib/request-context'

export async function GET(request: NextRequest) {
  try {
    const context = await getOrgContext(request)
    if (!context) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { searchParams } = new URL(request.url)
    const leadId = searchParams.get('leadId')
    if (!leadId) return NextResponse.json({ error: 'leadId is required' }, { status: 400 })

    const lead = await db.lead.findFirst({
      where: { id: leadId, organizationId: context.organizationId },
      include: {
        activities: {
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
      },
    })

    if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 })

    const score = calculateLeadScore({
      email: lead.email,
      phone: lead.phone,
      company: lead.company,
      title: lead.title,
      website: lead.website,
      linkedin: lead.linkedin,
      estimatedValue: lead.estimatedValue,
      source: lead.source,
      engagementScore: lead.engagementScore,
      totalInteractions: lead.totalInteractions,
      recentActivityCount: lead.activities.length,
    })

    const aiNextAction = getRecommendedAction(score, lead.status)
    const aiConfidence = Math.min(0.98, Math.max(0.6, 0.72 + score / 500))

    const updated = await db.lead.update({
      where: { id: lead.id },
      data: {
        aiScore: score,
        aiConfidence,
        aiLastAnalyzed: new Date(),
        aiNextAction,
        aiInsights: {
          reasoning: buildInsights(lead.title, lead.company, lead.source, lead.activities.length, score),
          scoreVersion: 'v2',
        },
      },
    })

    return NextResponse.json({
      leadId: updated.id,
      aiScore: updated.aiScore,
      aiConfidence: updated.aiConfidence,
      aiNextAction: updated.aiNextAction,
      aiInsights: updated.aiInsights,
    })
  } catch (error) {
    console.error('AI score error:', error)
    return NextResponse.json({ error: 'Failed to score lead' }, { status: 500 })
  }
}

function calculateLeadScore(lead: {
  email: string | null
  phone: string | null
  company: string | null
  title: string | null
  website: string | null
  linkedin: string | null
  estimatedValue: number | null
  source: string | null
  engagementScore: number
  totalInteractions: number
  recentActivityCount: number
}): number {
  let score = 25

  if (lead.email) {
    const domain = lead.email.split('@')[1]
    if (domain && !['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com'].includes(domain)) score += 14
    score += 4
  }
  if (lead.phone) score += 9
  if (lead.company) score += 8
  if (lead.website) score += 4
  if (lead.linkedin) score += 6

  if (lead.title) {
    const titleLower = lead.title.toLowerCase()
    if (['ceo', 'cfo', 'coo', 'vp', 'director', 'owner', 'founder', 'broker', 'advisor'].some((t) => titleLower.includes(t))) {
      score += 14
    } else {
      score += 6
    }
  }

  if (lead.estimatedValue) {
    if (lead.estimatedValue > 100000) score += 12
    else if (lead.estimatedValue > 50000) score += 9
    else if (lead.estimatedValue > 10000) score += 5
  }

  const sourceScores: Record<string, number> = {
    referral: 14,
    linkedin: 10,
    website: 8,
    google: 5,
    facebook: 3,
    scrape: 6,
    manual: 2,
    booking: 10,
    csv_upload: 2,
  }
  if (lead.source) score += sourceScores[lead.source] || 0

  score += Math.min(10, Math.floor(lead.engagementScore / 10))
  score += Math.min(6, lead.recentActivityCount)
  score += Math.min(8, Math.floor(lead.totalInteractions / 2))

  return Math.min(100, Math.max(0, score))
}

function getRecommendedAction(score: number, status: string): string {
  if (score >= 85) return 'Call today and push for appointment booking'
  if (score >= 70) return 'Send personalized outreach and propose 2 call slots'
  if (status === 'new') return 'Qualify this lead with AI questionnaire and initial contact'
  return 'Move to nurture sequence with AI follow-up'
}

function buildInsights(title: string | null, company: string | null, source: string | null, activityCount: number, score: number) {
  return [
    title ? `Role signal: ${title}` : 'No role signal available',
    company ? `Company captured: ${company}` : 'No company captured yet',
    source ? `Source quality considered: ${source}` : 'Source unknown',
    `Recent activity count: ${activityCount}`,
    `Score band: ${score >= 80 ? 'hot' : score >= 60 ? 'warm' : 'cold'}`,
  ]
}
