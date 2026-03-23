import { NextRequest, NextResponse } from 'next/server'
import { withRequestOrgContext } from '@/lib/request-context'
import { getScrapingPerformanceReport } from '@/lib/scraping-tracker'

/**
 * GET /api/scraping/performance
 *
 * Returns scraping performance metrics for the organization:
 * - Total sources tracked
 * - Top performing sources (by conversion rate)
 * - Total leads created from scraping
 * - Total conversions from scraped leads
 */
export async function GET(request: NextRequest) {
  try {
    return withRequestOrgContext(request, async (context) => {
      const report = await getScrapingPerformanceReport(context.organizationId)

      return NextResponse.json(report)
    })
  } catch (error) {
    console.error('Scraping performance error:', error)
    return NextResponse.json(
      { error: 'Failed to load scraping performance' },
      { status: 500 }
    )
  }
}
