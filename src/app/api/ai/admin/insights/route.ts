import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { withRequestOrgContext } from '@/lib/request-context'

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
 *
 * @security Requires admin or owner role
 */
export async function GET(request: NextRequest) {
  try {
    return withRequestOrgContext(request, async ({ organizationId, userId }) => {
      if (!userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }

      const user = await db.user.findFirst({
        where: {
          id: userId,
          organizationId,
        },
        select: { role: true },
      })

      if (!user || (user.role !== 'admin' && user.role !== 'owner')) {
        return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 })
      }

      const profiles = await db.userAIProfile.findMany({
        where: {
          user: {
            organizationId,
          },
        },
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

      const totalInteractions = profiles.reduce((sum, p) => sum + p.totalInteractions, 0)
      const totalSuccessful = profiles.reduce((sum, p) => sum + p.successfulPredictions, 0)
      const avgSuccessRate = totalInteractions > 0 ? totalSuccessful / totalInteractions : 0
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
