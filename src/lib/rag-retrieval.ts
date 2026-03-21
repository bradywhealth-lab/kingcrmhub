import { db } from '@/lib/db'
import { generateEmbedding, cosineSimilarity } from './embeddings'

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
 * @param userId - User to search events for
 * @param queryInput - Input context to find similar events for
 * @param eventType - Optional event type filter
 * @param limit - Maximum number of results (default: 5)
 * @returns Ranked list of similar events with similarity scores
 */
export async function retrieveSimilarEvents(
  userId: string,
  queryInput: Record<string, unknown>,
  eventType?: string,
  limit = 5
): Promise<RetrievedEvent[]> {
  // Generate embedding for query
  const queryText = JSON.stringify(queryInput)
  const queryEmbedding = await generateEmbedding(queryText)

  // Get user's profile
  const profile = await db.userAIProfile.findUnique({
    where: { userId },
  })

  if (!profile) return []

  // Get recent events with embeddings
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
      const eventEmbedding = event.embedding as number[] | null
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
    .filter((e): e is RetrievedEvent => e !== null && e.similarity > 0.5)
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
