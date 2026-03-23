import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { withRequestOrgContext } from '@/lib/request-context'

/**
 * POST /api/ai/internal/extract-patterns
 *
 * Internal endpoint (protected, called by cron or admin) that:
 * 1. Retrieves user's learning events from past 7 days
 * 2. Extracts successful SMS and email patterns
 * 3. Groups outcomes by lead profession
 * 4. Updates UserAIProfile with learned patterns
 *
 * Should be called weekly to continuously improve personalization.
 */
export async function POST(request: NextRequest) {
  try {
    return withRequestOrgContext(request, async (context) => {
      const userId = context.userId
      if (!userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }

      const sevenDaysAgo = new Date()
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

      const profile = await db.userAIProfile.findUnique({
        where: { userId },
        include: {
          learningHistory: {
            where: {
              createdAt: { gte: sevenDaysAgo },
              outcome: { in: ['success', 'failure'] },
            },
            orderBy: { createdAt: 'desc' },
          },
        },
      })

      if (!profile) {
        return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
      }

      const events = profile.learningHistory

      // Extract successful patterns by event type
      const successfulSMS = events
        .filter((e) => e.eventType === 'sms_sent' && e.outcome === 'success')
        .map((e) => e.output)

      const successfulEmails = events
        .filter((e) => e.eventType === 'email_sent' && e.outcome === 'success')
        .map((e) => e.output)

      // Extract patterns by profession for targeting insights
      const byProfession = events.reduce((acc, e) => {
        if (!e.leadProfession) return acc
        if (!acc[e.leadProfession]) {
          acc[e.leadProfession] = { success: 0, total: 0 }
        }
        acc[e.leadProfession].total++
        if (e.outcome === 'success') acc[e.leadProfession].success++
        return acc
      }, {} as Record<string, { success: number; total: number }>)

      // Update profile with learned patterns
      await db.userAIProfile.update({
        where: { id: profile.id },
        data: {
          smsPatterns: {
            successfulTemplates: successfulSMS.slice(-10), // Last 10 successful
            totalSuccessful: successfulSMS.length,
          },
          emailPatterns: {
            successfulTemplates: successfulEmails.slice(-10),
            totalSuccessful: successfulEmails.length,
          },
          industryKnowledge: byProfession,
          lastUpdatedAt: new Date(),
        },
      })

      return NextResponse.json({
        extracted: {
          smsPatterns: successfulSMS.length,
          emailPatterns: successfulEmails.length,
          industryPatterns: Object.keys(byProfession).length,
          professions: Object.entries(byProfession).map(([prof, data]) => ({
            profession: prof,
            successRate: data.success / data.total,
            totalAttempts: data.total,
          })),
        },
        period: { start: sevenDaysAgo, end: new Date() },
      })
    })
  } catch (error) {
    console.error('Pattern extraction error:', error)
    return NextResponse.json(
      { error: 'Failed to extract patterns' },
      { status: 500 }
    )
  }
}
