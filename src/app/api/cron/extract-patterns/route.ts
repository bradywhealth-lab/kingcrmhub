/**
 * Weekly Pattern Extraction Cron Job
 *
 * Runs weekly (Sunday 2AM UTC) to extract patterns from successful
 * AI interactions and update user profiles with learnings.
 *
 * Authentication: CRON_SECRET header required
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import crypto from 'crypto'

/**
 * Verify cron request authenticity using timing-safe comparison
 */
function verifyCronRequest(request: NextRequest): boolean {
  const CRON_SECRET = process.env.CRON_SECRET

  if (!CRON_SECRET) {
    console.error('CRON_SECRET not configured')
    return false
  }

  const providedSecret = request.headers.get('x-cron-secret')

  if (!providedSecret) {
    return false
  }

  // Constant-time comparison to prevent timing attacks
  const expectedBuffer = Buffer.from(CRON_SECRET, 'utf-8')
  const providedBuffer = Buffer.from(providedSecret, 'utf-8')

  if (expectedBuffer.length !== providedBuffer.length) {
    return false
  }

  return crypto.timingSafeEqual(expectedBuffer, providedBuffer)
}

/**
 * POST /api/cron/extract-patterns
 *
 * Extracts patterns from the past 7 days of successful events
 * and updates user profiles with learned patterns.
 */
export async function POST(request: NextRequest) {
  // Verify cron secret
  if (!verifyCronRequest(request)) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  try {
    const oneWeekAgo = new Date()
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)

    // Get all successful events from the past week with user info
    const successfulEvents = await db.userLearningEvent.findMany({
      where: {
        outcome: 'success',
        createdAt: { gte: oneWeekAgo }
      },
      include: {
        userProfile: {
          include: {
            user: {
              select: {
                id: true,
                organizationId: true
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    // Group events by user
    const eventsByUser = new Map<string, typeof successfulEvents>()

    for (const event of successfulEvents) {
      const userId = event.userProfile.user.id
      if (!eventsByUser.has(userId)) {
        eventsByUser.set(userId, [])
      }
      eventsByUser.get(userId)!.push(event)
    }

    // Process each user's events
    let patternsExtracted = 0
    let usersUpdated = 0

    for (const [userId, events] of eventsByUser.entries()) {
      // Extract patterns by event type
      const patternsByType = new Map<string, typeof successfulEvents>()

      for (const event of events) {
        if (!patternsByType.has(event.eventType)) {
          patternsByType.set(event.eventType, [])
        }
        patternsByType.get(event.eventType)!.push(event)
      }

      // Build profile updates
      const emailPatterns: any[] = []
      const smsPatterns: any[] = []
      const industryKnowledge: Record<string, { attempts: number; successes: number }> = {}
      const successfulSources: Record<string, number> = {}

      // Extract successful output patterns
      for (const [eventType, typeEvents] of patternsByType.entries()) {
        // Extract templates from successful outputs
        for (const event of typeEvents) {
          const output = event.output as Record<string, unknown> | null

          // Store successful templates
          if (eventType === 'email_sent' && output?.content) {
            emailPatterns.push({
              content: output.content,
              usedAt: event.createdAt,
              entityId: event.entityId
            })
          }

          if (eventType === 'sms_sent' && output?.message) {
            smsPatterns.push({
              message: output.message,
              usedAt: event.createdAt,
              entityId: event.entityId
            })
          }

          // Track carrier preferences
          if (event.leadProfession) {
            const profession = event.leadProfession
            if (!industryKnowledge[profession]) {
              industryKnowledge[profession] = {
                attempts: 0,
                successes: 0
              }
            }
            industryKnowledge[profession].successes++
            industryKnowledge[profession].attempts++
            patternsExtracted++
          }

          // Track successful sources
          if (event.sourceType) {
            if (!successfulSources[event.sourceType]) {
              successfulSources[event.sourceType] = 0
            }
            successfulSources[event.sourceType]++
          }
        }
      }

      // Update user profile with learned patterns
      await db.userAIProfile.update({
        where: { userId },
        data: {
          emailPatterns: emailPatterns.slice(-50), // Keep last 50
          smsPatterns: smsPatterns.slice(-50),
          industryKnowledge,
          successfulSources,
          lastUpdatedAt: new Date()
        }
      })

      usersUpdated++
    }

    return NextResponse.json({
      success: true,
      processed: {
        usersUpdated,
        eventsAnalyzed: successfulEvents.length,
        patternsExtracted
      },
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Pattern extraction failed:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
