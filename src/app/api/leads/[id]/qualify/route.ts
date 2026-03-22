/**
 * POST /api/leads/[id]/qualify
 *
 * Auto-qualify a lead using AI scoring.
 * Updates Lead.aiScore, aiNextAction, and aiInsights.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withRequestOrgContext } from '@/lib/request-context'
import { db } from '@/lib/db'

/**
 * Calculate lead quality score based on multiple factors
 */
async function calculateLeadScore(lead: {
  email?: string | null
  phone?: string | null
  company?: string | null
  title?: string | null
  firstName?: string | null
  lastName?: string | null
  source?: string | null
  profession?: string | null
  status: string
  engagementScore: number
  totalInteractions: number
}): Promise<{
  score: number
  confidence: number
  nextAction: string
  insights: string[]
}> {
  let score = 0
  const insights: string[] = []
  const factors = {
    dataCompleteness: 0,
    sourceQuality: 0,
    engagement: 0,
    professionalSignals: 0
  }

  // 1. Data completeness (30 points max)
  const fields = [lead.email, lead.phone, lead.company, lead.title, lead.firstName, lead.lastName]
  const filledFields = fields.filter(Boolean).length
  factors.dataCompleteness = Math.min(30, filledFields * 5)

  if (filledFields >= 5) {
    insights.push('Complete profile information')
  } else if (filledFields <= 2) {
    insights.push('Profile needs more information')
  }

  // 2. Source quality (25 points max)
  const highQualitySources = ['referral', 'linkedin', 'website', 'google']
  const mediumQualitySources = ['facebook', 'manual']
  if (lead.source && highQualitySources.includes(lead.source)) {
    factors.sourceQuality = 25
    insights.push('High-quality lead source')
  } else if (lead.source && mediumQualitySources.includes(lead.source)) {
    factors.sourceQuality = 15
  } else {
    factors.sourceQuality = lead.source ? 10 : 0
  }

  // 3. Engagement signals (25 points max)
  factors.engagement = Math.min(25, lead.engagementScore + lead.totalInteractions * 2)
  if (lead.totalInteractions > 5) {
    insights.push('High engagement history')
  } else if (lead.totalInteractions === 0) {
    insights.push('No prior contact')
  }

  // 4. Professional/title signals (20 points max)
  const professionalTitles = ['ceo', 'cfo', 'cto', 'director', 'manager', 'owner', 'partner', 'president', 'vp', 'architect', 'engineer']
  const titleLower = (lead.title || '').toLowerCase()
  const hasProfessionalTitle = professionalTitles.some(t => titleLower.includes(t))
  const hasValidCompany = lead.company && lead.company.length > 2

  if (hasProfessionalTitle && hasValidCompany) {
    factors.professionalSignals = 20
    insights.push('Decision maker identified')
  } else if (hasValidCompany) {
    factors.professionalSignals = 10
    insights.push('Company information available')
  } else if (hasProfessionalTitle) {
    factors.professionalSignals = 10
    insights.push('Professional title detected')
  }

  // Industry-specific bonuses
  const highValueIndustries = ['Construction', 'Healthcare', 'Technology', 'Finance', 'Real Estate', 'Insurance', 'Manufacturing']
  if (lead.profession && highValueIndustries.includes(lead.profession)) {
    factors.professionalSignals += 5
    insights.push(`${lead.profession} industry lead`)
  }

  // Calculate total score
  score = factors.dataCompleteness + factors.sourceQuality + factors.engagement + factors.professionalSignals

  // Normalize to 0-100
  score = Math.min(100, Math.max(0, score))

  // Calculate confidence based on data completeness
  const confidence = Math.min(1, (filledFields / 6) + (lead.totalInteractions > 0 ? 0.2 : 0))

  // Determine next action based on score and status
  let nextAction = 'Research lead and contact'
  if (score >= 70) {
    if (lead.phone) {
      nextAction = 'Call immediately - hot lead'
    } else {
      nextAction = 'Send personalized email - hot lead'
    }
  } else if (score >= 50) {
    nextAction = lead.phone ? 'Send SMS follow-up' : 'Send email introduction'
  } else if (score >= 30) {
    nextAction = 'Enrich profile data before contact'
  } else {
    nextAction = 'Consider lead qualification - low score'
  }

  // Add status-specific actions
  if (lead.status === 'new' && score >= 50) {
    nextAction = 'Add to follow-up sequence'
  } else if (lead.status === 'contacted' && !lead.phone) {
    insights.push('Missing phone number for direct contact')
  }

  return {
    score,
    confidence,
    nextAction,
    insights
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  return withRequestOrgContext(request, async ({ organizationId }) => {
    try {
      const { id } = params

      // Fetch lead with related data
      const lead = await db.lead.findUnique({
        where: { id, organizationId },
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

      if (!lead) {
        return NextResponse.json(
          { error: 'Lead not found' },
          { status: 404 }
        )
      }

      // Calculate score
      const result = await calculateLeadScore(lead)

      // Update lead with AI scores
      const updated = await db.lead.update({
        where: { id },
        data: {
          aiScore: result.score,
          aiConfidence: result.confidence,
          aiNextAction: result.nextAction,
          aiInsights: {
            factors: result.insights,
            qualifiedAt: new Date().toISOString()
          } as any,
          aiLastAnalyzed: new Date()
        },
        select: {
          id: true,
          aiScore: true,
          aiConfidence: true,
          aiNextAction: true,
          aiInsights: true
        }
      })

      // Create activity
      await db.activity.create({
        data: {
          organizationId,
          leadId: id,
          type: 'ai_analysis',
          title: 'Lead auto-qualified',
          description: `Score: ${result.score}/100 - ${result.nextAction}`,
          metadata: {
            score: result.score,
            confidence: result.confidence,
            nextAction: result.nextAction,
            insights: result.insights
          } as any
        }
      })

      return NextResponse.json({
        success: true,
        lead: updated
      })
    } catch (error) {
      console.error('Lead qualification error:', error)
      return NextResponse.json(
        { error: 'Failed to qualify lead' },
        { status: 500 }
      )
    }
  })
}
