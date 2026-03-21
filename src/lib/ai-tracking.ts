import { db } from '@/lib/db'
import { generateEmbedding } from '@/lib/embeddings'

export type LearningEventType =
  | 'sms_sent'
  | 'email_sent'
  | 'lead_scored'
  | 'playbook_generated'
  | 'content_generated'
  | 'insights_generated'
  | 'chat_message'

export interface TrackEventInput {
  userId: string
  organizationId: string
  eventType: LearningEventType
  entityType: string
  entityId: string
  input: Record<string, unknown>
  output: Record<string, unknown>
  leadProfession?: string
  sourceType?: string
}

export interface RecordOutcomeInput {
  eventId: string
  outcome: 'success' | 'failure' | 'pending'
  outcomeDelay?: number // minutes
  userRating?: number // 1-5
  userCorrection?: Record<string, unknown>
}

/**
 * Ensures a UserAIProfile exists for the given user.
 * Creates one if it doesn't exist, otherwise returns the existing profile.
 */
export async function ensureUserAIProfile(userId: string) {
  const existing = await db.userAIProfile.findUnique({
    where: { userId },
  })

  if (existing) return existing

  return db.userAIProfile.create({
    data: { userId },
  })
}

/**
 * Tracks an AI learning event for a user.
 * Creates a UserAIProfile if needed, records the event,
 * generates and stores an embedding, and updates the profile's interaction counter.
 */
export async function trackAIEvent(input: TrackEventInput) {
  const profile = await ensureUserAIProfile(input.userId)

  // Generate embedding for the event (combines input and output for semantic similarity)
  const eventText = JSON.stringify({ input: input.input, output: input.output })
  const embedding = await generateEmbedding(eventText)

  const event = await db.userLearningEvent.create({
    data: {
      userProfileId: profile.id,
      eventType: input.eventType,
      entityType: input.entityType,
      entityId: input.entityId,
      input: input.input as Record<string, unknown>,
      output: input.output as Record<string, unknown>,
      leadProfession: input.leadProfession,
      sourceType: input.sourceType,
      embedding, // Store embedding for RAG retrieval
    },
  })

  // Update profile interaction count
  await db.userAIProfile.update({
    where: { id: profile.id },
    data: {
      totalInteractions: { increment: 1 },
      lastUpdatedAt: new Date(),
    },
  })

  return event
}

/**
 * Records the outcome of a previously tracked AI event.
 * Updates the event with outcome information and increments
 * the successful predictions counter if the outcome was successful.
 */
export async function recordEventOutcome(input: RecordOutcomeInput) {
  const event = await db.userLearningEvent.findUnique({
    where: { id: input.eventId },
    include: { userProfile: true },
  })

  if (!event) {
    throw new Error(`Event not found: ${input.eventId}`)
  }

  const updated = await db.userLearningEvent.update({
    where: { id: input.eventId },
    data: {
      outcome: input.outcome,
      outcomeDelay: input.outcomeDelay,
      userRating: input.userRating,
      userCorrection: input.userCorrection as Record<string, unknown> | null,
      outcomeAt: new Date(),
    },
  })

  // Update successful predictions count
  if (input.outcome === 'success') {
    await db.userAIProfile.update({
      where: { id: event.userProfileId },
      data: {
        successfulPredictions: { increment: 1 },
        lastUpdatedAt: new Date(),
      },
    })
  }

  return updated
}

/**
 * Retrieves a user's AI profile with their learning history.
 * Returns null if the profile doesn't exist.
 */
export async function getUserAIProfile(userId: string) {
  return db.userAIProfile.findUnique({
    where: { userId },
    include: {
      learningHistory: {
        orderBy: { createdAt: 'desc' },
        take: 50,
      },
    },
  })
}
