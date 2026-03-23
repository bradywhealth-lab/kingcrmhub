import { NextRequest, NextResponse } from 'next/server'
import { withRequestOrgContext } from '@/lib/request-context'
import { db } from '@/lib/db'

/**
 * GET /api/ai/reports/monthly
 *
 * Returns a monthly scraping performance report:
 * - Period (30 days)
 * - Top performing sources
 * - Summary by source type with conversion rates
 */
export async function GET(request: NextRequest) {
  try {
    return withRequestOrgContext(request, async (context) => {
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

      const sources = await db.scrapingSourcePerformance.findMany({
        where: {
          organizationId: context.organizationId,
          createdAt: { gte: thirtyDaysAgo },
        },
        orderBy: { conversionRate: 'desc' },
      })

      // Aggregate by source type
      const byType = sources.reduce((acc, source) => {
        if (!acc[source.sourceType]) {
          acc[source.sourceType] = {
            count: 0,
            totalLeads: 0,
            totalConversions: 0,
          }
        }
        acc[source.sourceType].count++
        acc[source.sourceType].totalLeads += source.leadsCreated
        acc[source.sourceType].totalConversions += source.leadsConverted
        return acc
      }, {} as Record<string, { count: number; totalLeads: number; totalConversions: number }>)

      const summary = Object.entries(byType).map(([type, data]) => ({
        sourceType: type,
        sourceCount: data.count,
        totalLeads: data.totalLeads,
        totalConversions: data.totalConversions,
        conversionRate:
          data.totalLeads > 0 ? data.totalConversions / data.totalLeads : 0,
      }))

      return NextResponse.json({
        period: { start: thirtyDaysAgo, end: new Date() },
        topSources: sources.slice(0, 10),
        summaryByType: summary.sort((a, b) => b.conversionRate - a.conversionRate),
      })
    })
  } catch (error) {
    console.error('Monthly scraping report error:', error)
    return NextResponse.json(
      { error: 'Failed to generate monthly report' },
      { status: 500 }
    )
  }
}
