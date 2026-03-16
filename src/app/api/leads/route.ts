import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { withRequestOrgContext } from '@/lib/request-context'
import { z } from 'zod'
import { parseJsonBody } from '@/lib/validation'
import { enforceRateLimit } from '@/lib/rate-limit'

const createLeadSchema = z.object({
  firstName: z.string().max(120).nullable().optional(),
  lastName: z.string().max(120).nullable().optional(),
  email: z.string().email().nullable().optional(),
  phone: z.string().max(40).nullable().optional(),
  company: z.string().max(160).nullable().optional(),
  title: z.string().max(160).nullable().optional(),
  website: z.string().max(300).nullable().optional(),
  linkedin: z.string().max(300).nullable().optional(),
  source: z.string().max(80).nullable().optional(),
  estimatedValue: z.coerce.number().nonnegative().nullable().optional(),
  customFields: z.record(z.string(), z.unknown()).nullable().optional(),
})

// GET /api/leads - Get all leads for organization
export async function GET(request: NextRequest) {
  try {
    return withRequestOrgContext(request, async (context) => {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const sortBy = searchParams.get('sortBy') || 'createdAt'
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')
    
    const organizationId = context.organizationId
    
    const where: Record<string, unknown> = { organizationId }
    if (status && status !== 'all') {
      where.status = status
    }
    
    const leads = await db.lead.findMany({
      where,
      include: {
        tags: {
          include: {
            tag: true
          }
        }
      },
      orderBy: sortBy === 'aiScore' ? { aiScore: 'desc' } : 
                sortBy === 'estimatedValue' ? { estimatedValue: 'desc' } :
                { createdAt: 'desc' },
      take: limit,
      skip: offset
    })
    
    const total = await db.lead.count({ where })
    
    // Transform tags for easier frontend use
    const transformedLeads = leads.map(lead => ({
      ...lead,
      tags: lead.tags.map((t: { tag: { id: string; name: string; color: string } }) => t.tag)
    }))
    
    return NextResponse.json({ 
      leads: transformedLeads, 
      total,
      hasMore: offset + limit < total
    })
    })
  } catch (error) {
    console.error('Error fetching leads:', error)
    return NextResponse.json({ error: 'Failed to fetch leads' }, { status: 500 })
  }
}

// POST /api/leads - Create new lead
export async function POST(request: NextRequest) {
  try {
    const limited = enforceRateLimit(request, { key: 'leads-create', limit: 120, windowMs: 60_000 })
    if (limited) return limited
    return withRequestOrgContext(request, async (context) => {
    const parsed = await parseJsonBody(request, createLeadSchema)
    if (!parsed.success) return parsed.response
    const body = parsed.data
    const organizationId = context.organizationId
    
    const lead = await db.lead.create({
      data: {
        organizationId,
        firstName: body.firstName,
        lastName: body.lastName,
        email: body.email,
        phone: body.phone,
        company: body.company,
        title: body.title,
        website: body.website,
        linkedin: body.linkedin,
        source: body.source || 'manual',
        status: 'new',
        estimatedValue: body.estimatedValue,
        customFields: body.customFields,
        aiScore: 0, // Will be calculated by AI
      }
    })
    
    // Trigger AI scoring asynchronously
    // In production, this would be a background job
    const aiScore = await calculateLeadScore(lead)
    await db.lead.update({
      where: { id: lead.id },
      data: { 
        aiScore,
        aiConfidence: 0.75 + Math.random() * 0.2,
        aiLastAnalyzed: new Date(),
        aiNextAction: getRecommendedAction(aiScore, 'new')
      }
    })
    
    return NextResponse.json({ 
      ...lead, 
      aiScore,
      message: 'Lead created and scored successfully' 
    })
    })
  } catch (error) {
    console.error('Error creating lead:', error)
    return NextResponse.json({ error: 'Failed to create lead' }, { status: 500 })
  }
}

// Simple lead scoring algorithm (in production, this would use AI)
async function calculateLeadScore(lead: {
  email: string | null;
  phone: string | null;
  company: string | null;
  title: string | null;
  website: string | null;
  linkedin: string | null;
  estimatedValue: number | null;
  source: string | null;
}): Promise<number> {
  let score = 30 // Base score
  
  // Email quality
  if (lead.email) {
    const domain = lead.email.split('@')[1]
    if (domain && !['gmail.com', 'yahoo.com', 'hotmail.com'].includes(domain)) {
      score += 15 // Business email
    }
    score += 5 // Has email
  }
  
  // Phone
  if (lead.phone) score += 10
  
  // Company
  if (lead.company) score += 10
  
  // Title (decision maker)
  if (lead.title) {
    const titleLower = lead.title.toLowerCase()
    if (['ceo', 'cto', 'cfo', 'vp', 'director', 'founder', 'owner'].some(t => titleLower.includes(t))) {
      score += 15
    }
    score += 5
  }
  
  // Online presence
  if (lead.website) score += 5
  if (lead.linkedin) score += 5
  
  // Estimated value
  if (lead.estimatedValue) {
    if (lead.estimatedValue > 100000) score += 15
    else if (lead.estimatedValue > 50000) score += 10
    else if (lead.estimatedValue > 10000) score += 5
  }
  
  // Source quality
  const sourceScores: Record<string, number> = {
    'referral': 15,
    'linkedin': 10,
    'website': 8,
    'google': 5,
    'facebook': 3,
    'manual': 2,
    'api': 5
  }
  if (lead.source) {
    score += sourceScores[lead.source] || 0
  }
  
  return Math.min(100, Math.max(0, score))
}

function getRecommendedAction(score: number, status: string): string {
  if (score >= 80) {
    return 'High-value lead - Schedule immediate follow-up call'
  } else if (score >= 60) {
    return 'Good potential - Send personalized email introduction'
  } else if (status === 'new') {
    return 'New lead - Research company and prepare outreach'
  } else {
    return 'Add to nurture sequence for future engagement'
  }
}
