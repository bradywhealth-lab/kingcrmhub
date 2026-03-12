import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/stats - Get dashboard statistics
export async function GET(request: NextRequest) {
  try {
    const organizationId = 'demo-org-1'
    
    // Get lead counts
    const totalLeads = await db.lead.count({
      where: { organizationId }
    })
    
    const newLeadsToday = await db.lead.count({
      where: { 
        organizationId,
        createdAt: {
          gte: new Date(new Date().setHours(0, 0, 0, 0))
        }
      }
    })
    
    // Get pipeline value
    const pipelineItems = await db.pipelineItem.findMany({
      where: {
        pipeline: { organizationId }
      },
      include: { stage: true }
    })
    
    const pipelineValue = pipelineItems.reduce((sum, item) => 
      sum + (item.value || 0), 0
    )
    
    // Get won deals this month
    const wonItems = pipelineItems.filter(item => 
      item.stage?.name.toLowerCase() === 'won'
    )
    const wonThisMonth = wonItems.length
    
    // Average lead score
    const leads = await db.lead.findMany({
      where: { organizationId },
      select: { aiScore: true }
    })
    
    const avgLeadScore = leads.length > 0 
      ? Math.round(leads.reduce((sum, l) => sum + l.aiScore, 0) / leads.length)
      : 0
    
    // Activities today
    const activitiesToday = await db.activity.count({
      where: {
        organizationId,
        createdAt: {
          gte: new Date(new Date().setHours(0, 0, 0, 0))
        }
      }
    })
    
    // Lead source breakdown
    const leadSources = await db.lead.groupBy({
      by: ['source'],
      where: { organizationId },
      _count: { id: true }
    })
    
    const sourceBreakdown = leadSources.map(s => ({
      name: s.source || 'Unknown',
      value: s._count.id
    }))
    
    // Status breakdown
    const statusBreakdown = await db.lead.groupBy({
      by: ['status'],
      where: { organizationId },
      _count: { id: true }
    })
    
    // Recent activity trend (last 7 days)
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    
    const recentLeads = await db.lead.findMany({
      where: {
        organizationId,
        createdAt: { gte: sevenDaysAgo }
      },
      select: { createdAt: true }
    })
    
    // Group by day
    const leadsByDay: Record<string, number> = {}
    for (let i = 0; i < 7; i++) {
      const date = new Date()
      date.setDate(date.getDate() - i)
      const key = date.toISOString().split('T')[0]
      leadsByDay[key] = 0
    }
    
    recentLeads.forEach(lead => {
      const key = lead.createdAt.toISOString().split('T')[0]
      if (leadsByDay[key] !== undefined) {
        leadsByDay[key]++
      }
    })
    
    const leadTrend = Object.entries(leadsByDay)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, count]) => ({
        date,
        leads: count
      }))
    
    return NextResponse.json({
      totalLeads,
      newLeadsToday,
      pipelineValue,
      wonThisMonth,
      avgLeadScore,
      activitiesToday,
      sourceBreakdown,
      statusBreakdown: statusBreakdown.map(s => ({
        status: s.status,
        count: s._count.id
      })),
      leadTrend
    })
  } catch (error) {
    console.error('Error fetching stats:', error)
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 })
  }
}
