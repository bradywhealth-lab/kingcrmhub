import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { withRequestOrgContext } from '@/lib/request-context'
import { z } from 'zod'
import { parseJsonBody } from '@/lib/validation'
import { enforceRateLimit } from '@/lib/rate-limit'

const createActivitySchema = z.object({
  leadId: z.string().optional(),
  type: z.string().min(1).max(80),
  title: z.string().min(1).max(200),
  description: z.string().max(3000).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  aiSummary: z.string().max(3000).optional(),
})

// GET /api/activities - Get activity timeline
export async function GET(request: NextRequest) {
  try {
    return withRequestOrgContext(request, async (context) => {
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')
    const type = searchParams.get('type')
    const leadId = searchParams.get('leadId')
    
    const organizationId = context.organizationId
    
    const where: Record<string, unknown> = { organizationId }
    if (type) where.type = type
    if (leadId) where.leadId = leadId
    
    const activities = await db.activity.findMany({
      where,
      include: {
        lead: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            company: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset
    })
    
    const total = await db.activity.count({ where })
    
    return NextResponse.json({
      activities,
      total,
      hasMore: offset + limit < total
    })
    })
  } catch (error) {
    console.error('Error fetching activities:', error)
    return NextResponse.json({ error: 'Failed to fetch activities' }, { status: 500 })
  }
}

// POST /api/activities - Log new activity
export async function POST(request: NextRequest) {
  try {
    const limited = enforceRateLimit(request, { key: 'activities-create', limit: 120, windowMs: 60_000 })
    if (limited) return limited
    return withRequestOrgContext(request, async (context) => {
    const parsed = await parseJsonBody(request, createActivitySchema)
    if (!parsed.success) return parsed.response
    const body = parsed.data
    const organizationId = context.organizationId
    const userId = context.userId

    if (body.leadId) {
      const lead = await db.lead.findFirst({
        where: {
          id: body.leadId,
          organizationId,
        },
        select: { id: true },
      })
      if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
    }

    const activity = await db.activity.create({
      data: {
        organizationId,
        userId,
        leadId: body.leadId,
        type: body.type,
        title: body.title,
        description: body.description,
        metadata: body.metadata,
        aiSummary: body.aiSummary
      },
      include: {
        lead: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            company: true
          }
        }
      }
    })
    
    // Update lead's lastContactedAt if relevant
    if (body.leadId && ['email', 'call', 'meeting', 'sms'].includes(body.type)) {
      await db.lead.updateMany({
        where: {
          id: body.leadId,
          organizationId,
        },
        data: { 
          lastContactedAt: new Date(),
          totalInteractions: { increment: 1 }
        }
      })
    }
    
    return NextResponse.json(activity)
    })
  } catch (error) {
    console.error('Error creating activity:', error)
    return NextResponse.json({ error: 'Failed to create activity' }, { status: 500 })
  }
}
