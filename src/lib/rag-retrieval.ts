import { db } from '@/lib/db'
import { generateEmbedding, cosineSimilarity } from './embeddings'
import { PineconeClient, PineconeSearchResult } from './pinecone-client'

export interface RetrievedEvent {
  id: string
  eventType: string
  input: Record<string, unknown>
  output: Record<string, unknown>
  outcome: string | null
  similarity: number
}

/**
 * Retrieves similar past events using embedding-based semantic search.
 *
 * This enables RAG (Retrieval Augmented Generation) by finding
 * historically similar interactions that can inform new content generation.
 *
 * Priority order:
 * 1. Pinecone vector search (if enabled and available)
 * 2. PostgreSQL fallback with local similarity calculation
 *
 * @param userId - User to search events for
 * @param queryInput - Input context to find similar events for
 * @param eventType - Optional event type filter
 * @param limit - Maximum number of results (default: 5)
 * @param options - Optional configuration for retrieval behavior
 * @returns Ranked list of similar events with similarity scores
 */
export async function retrieveSimilarEvents(
  userId: string,
  queryInput: Record<string, unknown>,
  eventType?: string,
  limit = 5,
  options?: {
    usePinecone?: boolean
    minSimilarity?: number
    organizationId?: string
  }
): Promise<RetrievedEvent[]> {
  // Extract options with defaults
  const usePinecone = options?.usePinecone !== false // Default to true (opt-out)
  const minSimilarity = options?.minSimilarity ?? 0.5
  const organizationId = options?.organizationId

  // Generate embedding for query
  const queryText = JSON.stringify(queryInput)
  const queryEmbedding = await generateEmbedding(queryText)

  // Get user's profile
  const profile = await db.userAIProfile.findUnique({
    where: { userId },
    include: {
      user: {
        select: {
          organizationId: true,
        },
      },
    },
  })

  if (!profile || !profile.user) return []

  const orgId = organizationId || profile.user.organizationId
  if (!orgId) {
    console.warn('No organization ID found for user, skipping retrieval')
    return []
  }

  // Try Pinecone first if enabled and available
  if (usePinecone && PineconeClient.isAvailable()) {
    try {
      const pineconeResults = await PineconeClient.searchSimilar(
        queryEmbedding,
        userId,
        orgId,
        eventType ? { eventType } : undefined,
        limit * 2 // Fetch more to account for filtering
      )

      if (pineconeResults.length > 0) {
        // Extract event IDs from Pinecone format (orgId_eventId)
        const eventIds = pineconeResults.map((r) => {
          // ID format: ${organizationId}_${eventId}
          // Use substring to correctly extract eventId after orgId_ prefix
          return r.eventId.substring(orgId.length + 1)
        })

        // Fetch full event details from PostgreSQL
        const events = await db.userLearningEvent.findMany({
          where: {
            id: { in: eventIds },
          },
        })

        // Merge Pinecone scores with event data
        const results: RetrievedEvent[] = events
          .map((event) => {
            const pineconeResult = pineconeResults.find(
              (pr) => pr.eventId === `${orgId}_${event.id}`
            )

            if (!pineconeResult || pineconeResult.score < minSimilarity) {
              return null
            }

            return {
              id: event.id,
              eventType: event.eventType,
              input: event.input as Record<string, unknown>,
              output: event.output as Record<string, unknown>,
              outcome: event.outcome,
              similarity: pineconeResult.score,
            }
          })
          .filter((e): e is RetrievedEvent => e !== null)
          .sort((a, b) => b.similarity - a.similarity)
          .slice(0, limit)

        if (results.length > 0) {
          return results
        }
      }
    } catch (error) {
      console.error('Pinecone search failed, falling back to PostgreSQL:', error)
      // Fall through to PostgreSQL fallback
    }
  }

  // PostgreSQL fallback: Get recent events with embeddings
  const events = await db.userLearningEvent.findMany({
    where: {
      userProfileId: profile.id,
      ...(eventType && { eventType }),
    },
    orderBy: { createdAt: 'desc' },
    take: 100, // Retrieve last 100 events for similarity search
  })

  // Calculate similarity and rank
  const ranked = events
    .map((event) => {
      const eventEmbedding = (event as typeof event & { embedding?: number[] | null }).embedding ?? null
      if (!eventEmbedding) return null

      const similarity = cosineSimilarity(queryEmbedding, eventEmbedding)

      return {
        id: event.id,
        eventType: event.eventType,
        input: event.input as Record<string, unknown>,
        output: event.output as Record<string, unknown>,
        outcome: event.outcome,
        similarity,
      }
    })
    .filter((e): e is RetrievedEvent => e !== null && e.similarity >= minSimilarity)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit)

  return ranked
}

/**
 * Retrieves successful patterns for a specific event type.
 *
 * This returns historically successful events that can serve
 * as templates for new content generation.
 *
 * @param userId - User to search events for
 * @param eventType - Type of event to retrieve patterns for
 * @param limit - Maximum number of results (default: 10)
 * @returns List of successful events with high relevance
 */
export async function getSuccessfulPatterns(
  userId: string,
  eventType: string,
  limit = 10
): Promise<RetrievedEvent[]> {
  const profile = await db.userAIProfile.findUnique({
    where: { userId },
  })

  if (!profile) return []

  const events = await db.userLearningEvent.findMany({
    where: {
      userProfileId: profile.id,
      eventType,
      outcome: 'success',
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  })

  return events.map((event) => ({
    id: event.id,
    eventType: event.eventType,
    input: event.input as Record<string, unknown>,
    output: event.output as Record<string, unknown>,
    outcome: event.outcome,
    similarity: 1, // All successful events have high relevance
  }))
}

/**
 * Hybrid search that combines semantic similarity with outcome filtering.
 *
 * First retrieves similar events, then boosts successful ones,
 * providing the best of both semantic and performance-based retrieval.
 *
 * @param userId - User to search events for
 * @param queryInput - Input context to find similar events for
 * @param eventType - Optional event type filter
 * @param limit - Maximum number of results (default: 5)
 * @returns Ranked list of similar events with success boost applied
 */
export async function retrieveSimilarWithSuccessBoost(
  userId: string,
  queryInput: Record<string, unknown>,
  eventType?: string,
  limit = 5
): Promise<RetrievedEvent[]> {
  const similar = await retrieveSimilarEvents(userId, queryInput, eventType, limit * 2)

  // Boost successful events in ranking
  const boosted = similar.map((event) => ({
    ...event,
    similarity: event.outcome === 'success' ? Math.min(1, event.similarity * 1.2) : event.similarity,
  }))

  return boosted
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit)
}
