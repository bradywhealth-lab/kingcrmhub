import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { parseJsonBody } from '@/lib/validation'
import { enforceRateLimit } from '@/lib/rate-limit'
import { withRequestOrgContext } from '@/lib/request-context'
import { trackAIEvent, type LearningEventType } from '@/lib/ai-tracking'

const trackEventSchema = z.object({
  eventType: z.enum([
    'sms_sent',
    'email_sent',
    'lead_scored',
    'playbook_generated',
    'content_generated',
    'insights_generated',
    'chat_message',
  ]),
  entityType: z.string().min(1),
  entityId: z.string().min(1),
  input: z.record(z.string(), z.unknown()),
  output: z.record(z.string(), z.unknown()),
  leadProfession: z.string().optional(),
  sourceType: z.string().optional(),
})

/**
 * POST /api/ai/track
 *
 * Tracks an AI learning event for personalization.
 * Events are logged with input/output context and linked to
 * user feedback for pattern extraction.
 *
 * Rate limited to 100 requests per minute.
 */
export async function POST(request: NextRequest) {
  try {
    const limited = enforceRateLimit(request, {
      key: 'ai-track',
      limit: 100,
      windowMs: 60_000,
    })
    if (limited) return limited

    return withRequestOrgContext(request, async (context) => {
      const parsed = await parseJsonBody(request, trackEventSchema)
      if (!parsed.success) return parsed.response

      const { eventType, entityType, entityId, input, output, leadProfession, sourceType } =
        parsed.data

      // Get user ID from session (context should have this)
      const userId = context.userId || 'unknown'

      const result = await trackAIEvent(
        userId,
        eventType,
        entityType,
        entityId,
        input,
        output,
        {
          leadProfession,
          sourceType,
        }
      )

      return NextResponse.json({
        event: {
          id: result.eventId,
          eventType,
          pineconeId: result.pineconeId
        }
      })
    })
  } catch (error) {
    console.error('AI track error:', error)
    return NextResponse.json(
      { error: 'Failed to track AI event' },
      { status: 500 }
    )
  }
}
