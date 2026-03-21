import { NextRequest, NextResponse } from 'next/server'
import { withRequestOrgContext } from '@/lib/request-context'
import { db } from '@/lib/db'

/**
 * GET /api/ai/admin/insights
 *
 * Admin-only endpoint that provides system-wide learning insights:
 * - Total user profiles tracked
 * - Per-user interaction and success statistics
 * - Most active users
 * - Top event types across the system
 *
 * This enables monitoring of how well the AI learning system
 * is performing and which users are getting the most value.
 */
export async function GET(request: NextRequest) {
  try {
    return withRequestOrgContext(request, async (context) => {
      // TODO: Add admin check here - verify user has admin role
      // For now, accessible to all authenticated users in the org

      const profiles = await db.userAIProfile.findMany({
        include: {
          learningHistory: {
            orderBy: { createdAt: 'desc' },
            take: 10,
          },
        },
        take: 20,
        orderBy: { lastUpdatedAt: 'desc' },
      })

      const insights = profiles.map((profile) => ({
        userId: profile.userId,
        totalInteractions: profile.totalInteractions,
        successfulPredictions: profile.successfulPredictions,
        successRate:
          profile.totalInteractions > 0
            ? profile.successfulPredictions / profile.totalInteractions
            : 0,
        lastActive: profile.lastUpdatedAt,
        hasLearnedPatterns: !!(
          (profile.smsPatterns as any)?.successfulTemplates?.length > 0 ||
          (profile.emailPatterns as any)?.successfulTemplates?.length > 0
        ),
        topEventTypes: profile.learningHistory
          .slice(0, 5)
          .map((e) => e.eventType),
        profileCreatedAt: profile.createdAt,
      }))

      // Aggregate system-wide stats
      const totalInteractions = profiles.reduce((sum, p) => sum + p.totalInteractions, 0)
      const totalSuccessful = profiles.reduce((sum, p) => sum + p.successfulPredictions, 0)
      const avgSuccessRate = totalInteractions > 0 ? totalSuccessful / totalInteractions : 0

      // Count users with significant learning (>10 interactions)
      const activeLearners = profiles.filter((p) => p.totalInteractions >= 10).length

      return NextResponse.json({
        summary: {
          totalProfiles: profiles.length,
          activeLearners,
          totalInteractions,
          totalSuccessful,
          avgSuccessRate,
        },
        insights,
        generatedAt: new Date(),
      })
    })
  } catch (error) {
    console.error('Admin insights error:', error)
    return NextResponse.json(
      { error: 'Failed to load insights' },
      { status: 500 }
    )
  }
}
