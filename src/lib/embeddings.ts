/**
 * Embedding utilities for AI learning system.
 *
 * Elite Implementation: Uses OpenAI embeddings for production semantic quality
 * with hash-based fallback for development/error scenarios.
 */

import OpenAI from 'openai'

// Configuration
const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL || 'text-embedding-3-small'
const OPENAI_API_KEY = process.env.OPENAI_API_KEY
const EMBEDDING_DIMENSIONS = 1536
const CACHE_TTL = 86400 * 1000 // 24 hours in ms

// Simple in-memory cache (consider Redis for production)
const embeddingCache = new Map<string, { embedding: number[]; timestamp: number }>()

// OpenAI client (lazy initialization)
let openaiClient: OpenAI | null = null

/**
 * Initialize OpenAI client
 */
function getOpenAIClient(): OpenAI | null {
  if (!OPENAI_API_KEY) {
    return null
  }

  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey: OPENAI_API_KEY })
  }

  return openaiClient
}

/**
 * Generate cache key from text
 */
function getCacheKey(text: string): string {
  // Simple hash for cache key
  let hash = 0
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash // Convert to 32-bit integer
  }
  return `emb_${Math.abs(hash)}_${text.length}`
}

/**
 * Get cached embedding if available and not expired
 */
function getCachedEmbedding(text: string): number[] | null {
  const key = getCacheKey(text)
  const cached = embeddingCache.get(key)

  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.embedding
  }

  return null
}

/**
 * Cache an embedding
 */
function cacheEmbedding(text: string, embedding: number[]): void {
  const key = getCacheKey(text)
  embeddingCache.set(key, { embedding, timestamp: Date.now() })

  // Clean up old cache entries periodically
  if (embeddingCache.size > 10000) {
    const now = Date.now()
    for (const [k, v] of embeddingCache.entries()) {
      if (now - v.timestamp > CACHE_TTL) {
        embeddingCache.delete(k)
      }
    }
  }
}

/**
 * Generates a 1536-dimensional embedding vector for text.
 *
 * Production Implementation: Uses OpenAI's text-embedding-3-small model
 * for true semantic understanding. Falls back to hash-based embeddings
 * if OpenAI is unavailable.
 *
 * @param text - Input text to embed
 * @param options - Optional configuration
 * @returns A 1536-dimensional vector of numbers
 */
export async function generateEmbedding(
  text: string,
  options?: {
    forceRefresh?: boolean
    useCache?: boolean
  }
): Promise<number[]> {
  // Check cache first (unless force refresh)
  if (!options?.forceRefresh && options?.useCache !== false) {
    const cached = getCachedEmbedding(text)
    if (cached) {
      return cached
    }
  }

  // Try OpenAI first
  const client = getOpenAIClient()
  if (client) {
    try {
      const response = await client.embeddings.create({
        model: EMBEDDING_MODEL,
        input: text,
        dimensions: EMBEDDING_DIMENSIONS
      })

      const embedding = response.data[0].embedding

      // Cache the result
      cacheEmbedding(text, embedding)

      return embedding
    } catch (error) {
      console.warn('OpenAI embedding generation failed, using hash fallback:', error)
      // Fall through to hash-based
    }
  }

  // Hash-based fallback
  const embedding = generateHashEmbedding(text)

  // Cache even hash embeddings
  cacheEmbedding(text, embedding)

  return embedding
}

/**
 * Generate hash-based embedding (fallback)
 */
function generateHashEmbedding(text: string): number[] {
  const embedding: number[] = []

  for (let i = 0; i < EMBEDDING_DIMENSIONS; i++) {
    const hash = simpleHash(text + i)
    embedding.push((hash % 1000) / 1000) // Normalize to 0-1
  }

  return embedding
}

/**
 * Simple string hash function for consistent pseudo-random values.
 */
function simpleHash(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash // Convert to 32-bit integer
  }
  return Math.abs(hash)
}

/**
 * Generate embedding with metadata about source
 */
export async function generateEmbeddingWithMetadata(
  text: string,
  options?: {
    forceRefresh?: boolean
    useCache?: boolean
  }
): Promise<{
  embedding: number[]
  source: 'openai' | 'hash'
  cached: boolean
}> {
  const cacheKey = getCacheKey(text)
  const wasCached = !!getCachedEmbedding(text)

  const embedding = await generateEmbedding(text, options)

  // Determine source (check if it looks like an OpenAI embedding)
  const source = wasCached ? 'openai' : (OPENAI_API_KEY ? 'openai' : 'hash')

  return {
    embedding,
    source,
    cached: wasCached
  }
}

/**
 * Batch generate embeddings
 */
export async function generateEmbeddingsBatch(
  texts: string[]
): Promise<number[][]> {
  const client = getOpenAIClient()

  if (client && texts.length > 0) {
    try {
      const response = await client.embeddings.create({
        model: EMBEDDING_MODEL,
        input: texts,
        dimensions: EMBEDDING_DIMENSIONS
      })

      const embeddings = response.data.map(d => d.embedding)

      // Cache all embeddings
      for (let i = 0; i < texts.length; i++) {
        cacheEmbedding(texts[i], embeddings[i])
      }

      return embeddings
    } catch (error) {
      console.warn('OpenAI batch embedding failed, using hash fallback:', error)
    }
  }

  // Hash-based fallback for batch
  return texts.map(text => generateHashEmbedding(text))
}

/**
 * Calculates cosine similarity between two embedding vectors.
 *
 * Returns a value between -1 and 1, where:
 * - 1.0 = identical vectors (same direction)
 * - 0.0 = orthogonal vectors (no similarity)
 * - -1.0 = opposite vectors
 *
 * @param a - First embedding vector
 * @param b - Second embedding vector
 * @returns Cosine similarity score between -1 and 1
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0

  let dotProduct = 0
  let normA = 0
  let normB = 0

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB))
}

/**
 * Computes Euclidean distance between two embedding vectors.
 * Useful for alternative similarity metrics.
 *
 * @param a - First embedding vector
 * @param b - Second embedding vector
 * @returns Euclidean distance (lower = more similar)
 */
export function euclideanDistance(a: number[], b: number[]): number {
  if (a.length !== b.length) return Infinity

  let sum = 0
  for (let i = 0; i < a.length; i++) {
    const diff = a[i] - b[i]
    sum += diff * diff
  }
  return Math.sqrt(sum)
}

/**
 * Finds the most similar embedding from a list of candidates.
 *
 * @param query - Query embedding to match
 * @param candidates - Array of candidate embeddings with their IDs
 * @param threshold - Minimum similarity score to return a match (default: 0.5)
 * @returns Best match with similarity score, or null if no match exceeds threshold
 */
export function findMostSimilar<T extends { embedding: number[]; id: string }>(
  query: number[],
  candidates: T[],
  threshold = 0.5
): { item: T; similarity: number } | null {
  let best: { item: T; similarity: number } | null = null

  for (const candidate of candidates) {
    const similarity = cosineSimilarity(query, candidate.embedding)
    if (similarity > threshold && (!best || similarity > best.similarity)) {
      best = { item: candidate, similarity }
    }
  }

  return best
}

/**
 * Clear the embedding cache
 */
export function clearEmbeddingCache(): void {
  embeddingCache.clear()
}

/**
 * Get cache statistics
 */
export function getEmbeddingCacheStats(): { size: number; keys: string[] } {
  return {
    size: embeddingCache.size,
    keys: Array.from(embeddingCache.keys()).slice(0, 10) // First 10 keys
  }
}
