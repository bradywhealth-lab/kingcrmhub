import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { z } from 'zod'
import { parseJsonBody } from '@/lib/validation'
import { enforceRateLimit } from '@/lib/rate-limit'
import { withRequestOrgContext } from '@/lib/request-context'
import { recordEventOutcome } from '@/lib/ai-tracking'

const feedbackSchema = z.object({
  entityType: z.string().min(1),
  entityId: z.string().min(1),
  eventId: z.string().optional(), // NEW: link to learning event
  rating: z.number().int().min(-1).max(5),
  feedback: z.string().max(2000).optional(),
  corrections: z.record(z.string(), z.unknown()).optional(),
})

export async function POST(request: NextRequest) {
  try {
    const limited = enforceRateLimit(request, { key: 'ai-feedback', limit: 60, windowMs: 60_000 })
    if (limited) return limited
    return withRequestOrgContext(request, async () => {
      const parsed = await parseJsonBody(request, feedbackSchema)
      if (!parsed.success) return parsed.response
      const { entityType, entityId, eventId, rating, feedback, corrections } = parsed.data

      const saved = await db.aIFeedback.create({
        data: {
          entityType,
          entityId,
          rating,
          feedback: feedback || null,
          corrections: corrections || null,
        },
      })

      // NEW: If eventId provided, record outcome on learning event
      if (eventId) {
        try {
          await recordEventOutcome({
            eventId,
            outcome: rating >= 4 ? 'success' : rating <= 2 ? 'failure' : 'pending',
            userRating: rating,
            userCorrection: corrections,
          })
        } catch (error) {
          // Event might not exist, log but don't fail
          console.warn('Could not link feedback to event:', error)
        }
      }

      return NextResponse.json({ feedback: saved })
    })
  } catch (error) {
    console.error('AI feedback error:', error)
    return NextResponse.json({ error: 'Failed to save AI feedback' }, { status: 500 })
  }
}
