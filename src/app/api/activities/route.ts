import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/activities - Get activity timeline
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')
    const type = searchParams.get('type')
    const leadId = searchParams.get('leadId')
    
    const organizationId = 'demo-org-1'
    
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
  } catch (error) {
    console.error('Error fetching activities:', error)
    return NextResponse.json({ error: 'Failed to fetch activities' }, { status: 500 })
  }
}

// POST /api/activities - Log new activity
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const organizationId = 'demo-org-1'
    const userId = 'demo-user-1'
    
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
      await db.lead.update({
        where: { id: body.leadId },
        data: { 
          lastContactedAt: new Date(),
          totalInteractions: { increment: 1 }
        }
      })
    }
    
    return NextResponse.json(activity)
  } catch (error) {
    console.error('Error creating activity:', error)
    return NextResponse.json({ error: 'Failed to create activity' }, { status: 500 })
  }
}
