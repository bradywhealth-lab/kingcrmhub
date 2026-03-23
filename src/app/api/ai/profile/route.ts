import { NextRequest, NextResponse } from 'next/server'
import { withRequestOrgContext } from '@/lib/request-context'
import { getUserAIProfile, ensureUserAIProfile } from '@/lib/ai-tracking'

/**
 * GET /api/ai/profile
 *
 * Retrieves the user's AI learning profile, including:
 * - Total interactions and successful predictions
 * - Learned patterns (writing style, SMS/email patterns)
 * - Carrier preferences and industry knowledge
 * - Successful scraping sources
 *
 * Creates a new profile if one doesn't exist.
 */
export async function GET(request: NextRequest) {
  try {
    return withRequestOrgContext(request, async (context) => {
      const userId = context.userId || 'unknown'

      const profile = await getUserAIProfile(userId)

      if (!profile) {
        // Create profile if it doesn't exist
        await ensureUserAIProfile(userId)
        return NextResponse.json({ profile: null, message: 'Profile created' })
      }

      // Return learned patterns
      return NextResponse.json({
        profile: {
          id: profile.id,
          totalInteractions: profile.totalInteractions,
          successfulPredictions: profile.successfulPredictions,
          lastUpdatedAt: profile.lastUpdatedAt,
          writingStyle: profile.writingStyle,
          emailPatterns: profile.emailPatterns,
          smsPatterns: profile.smsPatterns,
          carrierPreferences: profile.carrierPreferences,
          industryKnowledge: profile.industryKnowledge,
          successfulSources: profile.successfulSources,
        },
      })
    })
  } catch (error) {
    console.error('AI profile error:', error)
    return NextResponse.json(
      { error: 'Failed to load AI profile' },
      { status: 500 }
    )
  }
}
