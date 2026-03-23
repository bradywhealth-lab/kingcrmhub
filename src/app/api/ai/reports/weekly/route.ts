import { NextRequest, NextResponse } from 'next/server'
import { withRequestOrgContext } from '@/lib/request-context'
import { db } from '@/lib/db'

/**
 * GET /api/ai/reports/weekly
 *
 * Returns a weekly AI learning report for the current user:
 * - Total events in the past 7 days
 * - Successful predictions count
 * - Success rate
 * - Top event types by frequency
 */
export async function GET(request: NextRequest) {
  try {
    return withRequestOrgContext(request, async (context) => {
      const userId = context.userId || 'unknown'
      const sevenDaysAgo = new Date()
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

      // Get user's learning events from past week
      const profile = await db.userAIProfile.findUnique({
        where: { userId },
        include: {
          learningHistory: {
            where: {
              createdAt: { gte: sevenDaysAgo },
            },
            orderBy: { createdAt: 'desc' },
          },
        },
      })

      if (!profile) {
        return NextResponse.json({
          totalEvents: 0,
          successfulPredictions: 0,
          successRate: 0,
          topEventTypes: [],
          weekStart: sevenDaysAgo,
          weekEnd: new Date(),
        })
      }

      // Analyze events
      const eventsByType = profile.learningHistory.reduce((acc, event) => {
        acc[event.eventType] = (acc[event.eventType] || 0) + 1
        return acc
      }, {} as Record<string, number>)

      const successfulEvents = profile.learningHistory.filter(
        (e) => e.outcome === 'success'
      ).length

      const topEventTypes = Object.entries(eventsByType)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([type, count]) => ({ type, count }))

      return NextResponse.json({
        totalEvents: profile.learningHistory.length,
        successfulPredictions: successfulEvents,
        successRate:
          profile.learningHistory.length > 0
            ? successfulEvents / profile.learningHistory.length
            : 0,
        topEventTypes,
        weekStart: sevenDaysAgo,
        weekEnd: new Date(),
      })
    })
  } catch (error) {
    console.error('Weekly report error:', error)
    return NextResponse.json(
      { error: 'Failed to generate weekly report' },
      { status: 500 }
    )
  }
}
