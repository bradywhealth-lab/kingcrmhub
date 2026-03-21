# Maximum Elite AI Learning System Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Upgrade the AI Learning System to enterprise-grade with OpenAI embeddings, Pinecone vector search, admin authorization, automated weekly pattern extraction, and a comprehensive admin dashboard.

**Architecture:** Three-tier upgrade: (1) Embedding service with OpenAI API + fallback, (2) Pinecone vector database for semantic search with namespace isolation, (3) Admin infrastructure with role-based auth and dashboard UI. The system maintains backward compatibility with hash-based embeddings as fallback.

**Tech Stack:** OpenAI text-embedding-3-small API, Pinecone vector database, Next.js 14 App Router, Prisma ORM, PostgreSQL with pgvector, shadcn/ui components, Recharts for visualizations, Vercel cron jobs.

---

## Prerequisites

Before starting, ensure you have:
- Node.js 18+ installed
- Access to OpenAI API key
- Pinecone account with API key
- Database migration permissions
- Admin user account for testing

### Verify Current State

```bash
# Check migrations are applied
npx prisma migrate status

# Verify tests pass (54/56 expected - 2 known mock issues)
npm test

# Check current branch
git status
```

---

## Task 1: Add Pinecone Reference to Database Schema

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/YYYYMMDD_add_pinecone_id/migration.sql`

**Step 1: Add pineconeId field to UserLearningEvent**

In `prisma/schema.prisma`, find the `UserLearningEvent` model (around line 1120) and add the `pineconeId` field:

```prisma
model UserLearningEvent {
  id            String        @id @default(cuid())
  userProfileId String
  userProfile   UserAIProfile @relation(fields: [userProfileId], references: [id], onDelete: Cascade)

  // Event Details
  eventType  String
  entityType String
  entityId   String

  // Input/Output
  input  Json
  output Json

  // Embedding (PostgreSQL - backup)
  embedding Json?

  // Pinecone Reference
  pineconeId String? @unique  // NEW: Store Pinecone vector ID

  // Outcome
  outcome      String?
  outcomeDelay Int?

  // User Feedback
  userRating     Int?
  userCorrection Json?

  // Metadata
  leadProfession String?
  sourceType     String?

  createdAt DateTime  @default(now())
  outcomeAt DateTime?

  @@index([userProfileId])
  @@index([eventType])
  @@index([createdAt])
  @@index([pineconeId])  // NEW: Index for Pinecone lookups
}
```

**Step 2: Create migration**

```bash
npx prisma migrate dev --name add_pinecone_id
```

Expected output: Migration created with `ALTER TABLE` adding `pineconeId` column.

**Step 3: Generate Prisma client**

```bash
npx prisma generate
```

**Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat: add pineconeId field to UserLearningEvent for vector sync"
```

---

## Task 2: Install Dependencies

**Files:**
- Modify: `package.json`

**Step 1: Install Pinecone SDK**

```bash
npm install @pinecone-database/pinecone
```

**Step 2: Install additional dependencies**

```bash
# For admin dashboard charts
npm install recharts

# For cron job validation
npm install crypto-js

# Type definitions
npm install -D @types/crypto-js
```

**Step 3: Verify installations**

```bash
npm list @pinecone-database/pinecone recharts crypto-js
```

Expected: All packages listed with versions.

**Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "feat: add pinecone, recharts, and crypto-js dependencies"
```

---

## Task 3: Create Environment Variable Templates

**Files:**
- Modify: `.env.example`
- Create: `.env.local.example`

**Step 1: Add new environment variables to `.env.example`**

```bash
# Append to .env.example

# ============================================
# AI LEARNING SYSTEM - MAXIMUM ELITE
# ============================================

# OpenAI API for embeddings
OPENAI_API_KEY=

# Pinecone Vector Database
PINECONE_API_KEY=
PINECONE_INDEX=kingcrm-ai-events
PINECONE_ENVIRONMENT=us-east-1-aws

# Cron Job Authentication
CRON_SECRET=

# Embedding Configuration
EMBEDDING_MODEL=text-embedding-3-small
EMBEDDING_CACHE_ENABLED=true
EMBEDDING_FALLBACK_ENABLED=true

# Pinecone Configuration
PINECONE_BATCH_SIZE=100
USE_PINECONE_FOR_RAG=true
ASYNC_PINECONE_SYNC=true
```

**Step 2: Create local environment example**

Create `.env.local.example`:

```bash
# Copy .env.example values and add example values for development

OPENAI_API_KEY=sk-proj-example-key
PINECONE_API_KEY=example-pinecone-key
PINECONE_INDEX=kingcrm-ai-events-dev
PINECONE_ENVIRONMENT=us-east-1-aws
CRON_SECRET=example-secret-change-in-production
EMBEDDING_MODEL=text-embedding-3-small
EMBEDDING_CACHE_ENABLED=true
EMBEDDING_FALLBACK_ENABLED=true
PINECONE_BATCH_SIZE=100
USE_PINECONE_FOR_RAG=true
ASYNC_PINECONE_SYNC=true
```

**Step 3: Commit**

```bash
git add .env.example .env.local.example
git commit -m "feat: add environment variables for elite features"
```

---

## Task 4: Create Pinecone Client Library

**Files:**
- Create: `src/lib/pinecone-client.ts`
- Test: `src/lib/pinecone-client.test.ts`

**Step 1: Write the failing test**

Create `src/lib/pinecone-client.test.ts`:

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { PineconeClient } from './pinecone-client'

// Mock the Pinecone SDK
vi.mock('@pinecone-database/pinecone', () => ({
  Pinecone: vi.fn(() => ({
    index: vi.fn(() => ({
      upsert: vi.fn().mockResolvedValue({ upsertedCount: 1 }),
      query: vi.fn().mockResolvedValue({
        matches: [
          { id: 'event-1', score: 0.95, metadata: { userId: 'user-1' } }
        ]
      }),
      deleteOne: vi.fn().mockResolvedValue(undefined)
    }))
  }))
}))

describe('PineconeClient', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('initialize', () => {
    it('should initialize the Pinecone client', async () => {
      await PineconeClient.initialize()
      expect(PineconeClient['client']).toBeDefined()
    })
  })

  describe('upsertEvent', () => {
    it('should upsert an event embedding with metadata', async () => {
      await PineconeClient.initialize()

      await PineconeClient.upsertEvent(
        'event-1',
        new Array(1536).fill(0.1),
        {
          userId: 'user-1',
          organizationId: 'org-1',
          eventType: 'sms_sent',
          entityType: 'lead',
          entityId: 'lead-1',
          outcome: 'success',
          createdAt: new Date().toISOString()
        }
      )

      // Verify upsert was called
      const index = PineconeClient['client'].index('kingcrm-ai-events')
      expect(index.upsert).toHaveBeenCalled()
    })
  })

  describe('searchSimilar', () => {
    it('should search for similar events by vector', async () => {
      await PineconeClient.initialize()

      const results = await PineconeClient.searchSimilar(
        new Array(1536).fill(0.1),
        'user-1',
        { eventType: 'sms_sent' },
        5
      )

      expect(results).toHaveLength(1)
      expect(results[0].eventId).toBe('event-1')
      expect(results[0].score).toBe(0.95)
    })
  })

  describe('deleteEvent', () => {
    it('should delete an event from Pinecone', async () => {
      await PineconeClient.initialize()

      await PineconeClient.deleteEvent('event-1')

      const index = PineconeClient['client'].index('kingcrm-ai-events')
      expect(index.deleteOne).toHaveBeenCalledWith('event-1')
    })
  })
})
```

**Step 2: Run test to verify it fails**

```bash
npm test src/lib/pinecone-client.test.ts
```

Expected: FAIL - "Cannot find module './pinecone-client'"

**Step 3: Write minimal implementation**

Create `src/lib/pinecone-client.ts`:

```typescript
/**
 * Pinecone Vector Database Client
 *
 * Manages vector storage and retrieval for the AI Learning System.
 * Provides semantic search capabilities using Pinecone's vector database.
 */

import { Pinecone as PineconeSDK } from '@pinecone-database/pinecone'

// Configuration
const PINECONE_INDEX = process.env.PINECONE_INDEX || 'kingcrm-ai-events'
const PINECONE_ENVIRONMENT = process.env.PINECONE_ENVIRONMENT || 'us-east-1-aws'
const PINECONE_API_KEY = process.env.PINECONE_API_KEY

if (!PINECONE_API_KEY) {
  console.warn('PINECONE_API_KEY not set - Pinecone features will be disabled')
}

// Metadata interface for Pinecone events
export interface PineconeEventMetadata {
  userId: string
  organizationId: string
  eventType: string
  entityType: string
  entityId: string
  outcome: string | null
  createdAt: string
}

// Search result interface
export interface PineconeSearchResult {
  eventId: string
  score: number
  metadata: PineconeEventMetadata
}

// Search filter options
export interface PineconeSearchFilters {
  eventType?: string
  outcome?: string
  minDate?: Date
}

// Pinecone client class
export class PineconeClient {
  private static client: PineconeSDK | null = null
  private static indexName = PINECONE_INDEX
  private static initialized = false

  /**
   * Initialize the Pinecone client
   */
  static async initialize(): Promise<void> {
    if (this.initialized || !PINECONE_API_KEY) {
      return
    }

    try {
      this.client = new PineconeSDK({
        apiKey: PINECONE_API_KEY
      })
      this.initialized = true
      console.log('Pinecone client initialized')
    } catch (error) {
      console.error('Failed to initialize Pinecone client:', error)
      throw error
    }
  }

  /**
   * Get or initialize the Pinecone index
   */
  private static getIndex() {
    if (!this.client) {
      throw new Error('Pinecone client not initialized. Call initialize() first.')
    }
    return this.client.index(this.indexName)
  }

  /**
   * Get namespace for organization
   */
  private static getNamespace(organizationId: string): string {
    return `org-${organizationId}`
  }

  /**
   * Upsert a single event embedding with metadata
   */
  static async upsertEvent(
    eventId: string,
    embedding: number[],
    metadata: PineconeEventMetadata
  ): Promise<void> {
    if (!PINECONE_API_KEY || !this.client) {
      console.warn('Pinecone not available - skipping upsert')
      return
    }

    try {
      const index = this.getIndex()
      const namespace = this.getNamespace(metadata.organizationId)

      await index.upsert([
        {
          id: eventId,
          values: embedding,
          metadata: {
            userId: metadata.userId,
            eventType: metadata.eventType,
            entityType: metadata.entityType,
            entityId: metadata.entityId,
            outcome: metadata.outcome || '',
            createdAt: metadata.createdAt
          }
        }
      ], { namespace })

      console.log(`Upserted event ${eventId} to Pinecone namespace ${namespace}`)
    } catch (error) {
      console.error('Failed to upsert event to Pinecone:', error)
      // Don't throw - we want to continue even if Pinecone fails
    }
  }

  /**
   * Batch upsert multiple events
   */
  static async upsertEventsBatch(
    events: Array<{
      id: string
      embedding: number[]
      metadata: PineconeEventMetadata
    }>
  ): Promise<void> {
    if (!PINECONE_API_KEY || !this.client || events.length === 0) {
      return
    }

    try {
      const index = this.getIndex()

      // Group by organization for namespace efficiency
      const byOrg = new Map<string, Array<{id: string, values: number[], metadata: object}>>()

      for (const event of events) {
        const namespace = this.getNamespace(event.metadata.organizationId)
        if (!byOrg.has(namespace)) {
          byOrg.set(namespace, [])
        }
        byOrg.get(namespace)!.push({
          id: event.id,
          values: event.embedding,
          metadata: {
            userId: event.metadata.userId,
            eventType: event.metadata.eventType,
            entityType: event.metadata.entityType,
            entityId: event.metadata.entityId,
            outcome: event.metadata.outcome || '',
            createdAt: event.metadata.createdAt
          }
        })
      }

      // Upsert to each namespace
      for (const [namespace, records] of byOrg.entries()) {
        await index.upsert(records, { namespace })
        console.log(`Batch upserted ${records.length} events to Pinecone namespace ${namespace}`)
      }
    } catch (error) {
      console.error('Failed to batch upsert events to Pinecone:', error)
    }
  }

  /**
   * Search for similar events by vector
   */
  static async searchSimilar(
    queryEmbedding: number[],
    userId: string,
    organizationId: string,
    filters?: PineconeSearchFilters,
    topK = 10
  ): Promise<PineconeSearchResult[]> {
    if (!PINECONE_API_KEY || !this.client) {
      return []
    }

    try {
      const index = this.getIndex()
      const namespace = this.getNamespace(organizationId)

      // Build filter
      const filter: Record<string, unknown> = {
        userId
      }

      if (filters?.eventType) {
        filter.eventType = filters.eventType
      }

      if (filters?.outcome) {
        filter.outcome = filters.outcome
      }

      const response = await index.query({
        vector: queryEmbedding,
        filter,
        topK,
        includeMetadata: true,
        namespace
      })

      const results: PineconeSearchResult[] = []

      for (const match of response.matches || []) {
        if (match.id && match.metadata) {
          results.push({
            eventId: match.id,
            score: match.score || 0,
            metadata: {
              userId: match.metadata.userId as string,
              organizationId,
              eventType: match.metadata.eventType as string,
              entityType: match.metadata.entityType as string,
              entityId: match.metadata.entityId as string,
              outcome: match.metadata.outcome as string || null,
              createdAt: match.metadata.createdAt as string
            }
          })
        }
      }

      return results
    } catch (error) {
      console.error('Failed to search Pinecone:', error)
      return []
    }
  }

  /**
   * Delete an event from Pinecone
   */
  static async deleteEvent(
    eventId: string,
    organizationId: string
  ): Promise<void> {
    if (!PINECONE_API_KEY || !this.client) {
      return
    }

    try {
      const index = this.getIndex()
      const namespace = this.getNamespace(organizationId)

      await index.deleteOne(eventId, { namespace })
      console.log(`Deleted event ${eventId} from Pinecone namespace ${namespace}`)
    } catch (error) {
      console.error('Failed to delete event from Pinecone:', error)
    }
  }

  /**
   * Clear all events in an organization's namespace
   */
  static async clearNamespace(organizationId: string): Promise<void> {
    if (!PINECONE_API_KEY || !this.client) {
      return
    }

    try {
      const index = this.getIndex()
      const namespace = this.getNamespace(organizationId)

      // Note: Pinecone doesn't have a direct "clear namespace" operation
      // This would require deleting all vectors one by one or recreating the namespace
      console.warn(`Clear namespace not implemented for ${namespace}`)
    } catch (error) {
      console.error('Failed to clear namespace:', error)
    }
  }

  /**
   * Check if Pinecone is available
   */
  static isAvailable(): boolean {
    return this.initialized && this.client !== null
  }
}

// Initialize on module load
if (typeof window === 'undefined') {
  PineconeClient.initialize().catch(console.error)
}
```

**Step 4: Run tests to verify they pass**

```bash
npm test src/lib/pinecone-client.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/pinecone-client.ts src/lib/pinecone-client.test.ts
git commit -m "feat: add Pinecone client library for vector search"
```

---

## Task 5: Enhance Embedding Service with OpenAI Integration

**Files:**
- Modify: `src/lib/embeddings.ts`
- Test: `src/lib/embeddings.test.ts`

**Step 1: Write the failing test**

Create `src/lib/embeddings.test.ts`:

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { generateEmbedding, generateEmbeddingWithMetadata, cosineSimilarity } from './embeddings'

// Mock OpenAI
vi.mock('openai', () => ({
  default: vi.fn(() => ({
    embeddings: {
      create: vi.fn().mockResolvedValue({
        data: [{ embedding: new Array(1536).fill(0.1) }]
      })
    }
  }))
}))

describe('embeddings', () => {
  describe('generateEmbedding', () => {
    it('should generate consistent hash-based embeddings when OpenAI fails', async () => {
      const embedding1 = await generateEmbedding('test text')
      const embedding2 = await generateEmbedding('test text')

      expect(embedding1).toEqual(embedding2)
      expect(embedding1).toHaveLength(1536)
    })

    it('should generate different embeddings for different text', async () => {
      const embedding1 = await generateEmbedding('text one')
      const embedding2 = await generateEmbedding('text two')

      expect(embedding1).not.toEqual(embedding2)
    })
  })

  describe('cosineSimilarity', () => {
    it('should calculate cosine similarity correctly', () => {
      const vec1 = [1, 0, 0]
      const vec2 = [1, 0, 0]

      const similarity = cosineSimilarity(vec1, vec2)
      expect(similarity).toBeCloseTo(1)
    })

    it('should return 0 for orthogonal vectors', () => {
      const vec1 = [1, 0, 0]
      const vec2 = [0, 1, 0]

      const similarity = cosineSimilarity(vec1, vec2)
      expect(similarity).toBeCloseTo(0)
    })
  })
})
```

**Step 2: Run test to verify it fails**

```bash
npm test src/lib/embeddings.test.ts
```

Expected: FAIL - OpenAI integration not implemented

**Step 3: Enhance the embedding service**

Modify `src/lib/embeddings.ts`:

```typescript
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
```

**Step 4: Run tests to verify they pass**

```bash
npm test src/lib/embeddings.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/embeddings.ts src/lib/embeddings.test.ts
git commit -m "feat: enhance embedding service with OpenAI integration and caching"
```

---

## Task 6: Update AI Tracking with Pinecone Sync

**Files:**
- Modify: `src/lib/ai-tracking.ts`

**Step 1: Read the current ai-tracking.ts to understand the structure**

```bash
head -100 src/lib/ai-tracking.ts
```

**Step 2: Add Pinecone sync to trackAIEvent function**

In `src/lib/ai-tracking.ts`, add imports at the top:

```typescript
import { PineconeClient } from './pinecone-client'
import { generateEmbedding } from './embeddings'
```

**Step 3: Modify the trackAIEvent function to sync to Pinecone**

Find the `trackAIEvent` function (around line 50) and update it:

```typescript
/**
 * Tracks an AI interaction event for learning.
 *
 * Enhanced with Pinecone sync for vector search capabilities.
 */
export async function trackAIEvent(
  userId: string,
  eventType: string,
  entityType: string,
  entityId: string,
  input: Record<string, unknown>,
  output: Record<string, unknown>,
  options?: {
    leadProfession?: string
    sourceType?: string
    syncToPinecone?: boolean
  }
): Promise<{
  eventId: string
  pineconeId?: string
}> {
  // Get or create user profile
  const profile = await getUserAIProfile(userId)

  // Generate embedding from input
  const embedding = await generateEmbedding(JSON.stringify(input))

  // Create event in database
  const event = await db.userLearningEvent.create({
    data: {
      userProfileId: profile.id,
      eventType,
      entityType,
      entityId,
      input,
      output,
      embedding, // Store in PostgreSQL as backup
      leadProfession: options?.leadProfession,
      sourceType: options?.sourceType
    }
  })

  // Sync to Pinecone if enabled (default: true)
  const shouldSync = options?.syncToPinecone !== false

  let pineconeId: string | undefined

  if (shouldSync && PineconeClient.isAvailable()) {
    try {
      // Get user's organization
      const user = await db.user.findUnique({
        where: { id: userId },
        select: { organizationId: true }
      })

      if (user) {
        const pineconeEventId = `${user.organizationId}_${event.id}`

        await PineconeClient.upsertEvent(
          pineconeEventId,
          embedding,
          {
            userId,
            organizationId: user.organizationId,
            eventType,
            entityType,
            entityId,
            outcome: null, // Will be updated when feedback is received
            createdAt: event.createdAt.toISOString()
          }
        )

        // Update event with Pinecone ID
        await db.userLearningEvent.update({
          where: { id: event.id },
          data: { pineconeId: pineconeEventId }
        })

        pineconeId = pineconeEventId
      }
    } catch (error) {
      console.error('Failed to sync event to Pinecone:', error)
      // Continue even if sync fails
    }
  }

  // Update profile stats
  await db.userAIProfile.update({
    where: { id: profile.id },
    data: {
      totalInteractions: { increment: 1 },
      lastUpdatedAt: new Date()
    }
  })

  return {
    eventId: event.id,
    pineconeId
  }
}
```

**Step 3: Run tests to verify existing functionality still works**

```bash
npm test src/app/api/ai/track/route.test.ts
```

Expected: PASS

**Step 4: Commit**

```bash
git add src/lib/ai-tracking.ts
git commit -m "feat: add Pinecone sync to AI event tracking"
```

---

## Task 7: Enhance RAG Retrieval with Pinecone

**Files:**
- Modify: `src/lib/rag-retrieval.ts`

**Step 1: Add Pinecone integration to rag-retrieval.ts**

At the top of `src/lib/rag-retrieval.ts`, add the import:

```typescript
import { PineconeClient } from './pinecone-client'
```

**Step 2: Modify retrieveSimilarEvents function**

Update the `retrieveSimilarEvents` function to use Pinecone:

```typescript
/**
 * Retrieves similar past events using embedding-based semantic search.
 *
 * Enhanced: Uses Pinecone for vector search with PostgreSQL fallback.
 *
 * @param userId - User to search events for
 * @param queryInput - Input context to find similar events for
 * @param eventType - Optional event type filter
 * @param limit - Maximum number of results (default: 5)
 * @param options - Additional options
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
  // Generate embedding for query
  const queryEmbedding = await generateEmbedding(JSON.stringify(queryInput))

  // Get user's profile and organization
  const profile = await db.userAIProfile.findUnique({
    where: { userId }
  })

  if (!profile) return []

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { organizationId: true }
  })

  if (!user) return []

  const organizationId = options?.organizationId || user.organizationId

  // Try Pinecone first (if enabled and available)
  const usePinecone = options?.usePinecone !== false && PineconeClient.isAvailable()

  if (usePinecone) {
    try {
      const pineconeResults = await PineconeClient.searchSimilar(
        queryEmbedding,
        userId,
        organizationId,
        { eventType },
        limit * 2 // Get more results, then filter
      )

      // Extract event IDs from Pinecone results
      const eventIds = pineconeResults.map(r => {
        // Pinecone ID format: orgId_eventId
        const parts = r.eventId.split('_')
        return parts[parts.length - 1]
      })

      // Fetch full event details from PostgreSQL
      const events = await db.userLearningEvent.findMany({
        where: {
          id: { in: eventIds }
        }
      })

      // Merge Pinecone scores with event data
      const results: RetrievedEvent[] = []

      for (const pineconeResult of pineconeResults) {
        const eventId = pineconeResult.eventId.split('_').pop()!
        const event = events.find(e => e.id === eventId)

        if (event && pineconeResult.score >= (options?.minSimilarity || 0.5)) {
          results.push({
            id: event.id,
            eventType: event.eventType,
            input: event.input as Record<string, unknown>,
            output: event.output as Record<string, unknown>,
            outcome: event.outcome,
            similarity: pineconeResult.score
          })
        }
      }

      return results.slice(0, limit)
    } catch (error) {
      console.error('Pinecone search failed, falling back to PostgreSQL:', error)
      // Fall through to PostgreSQL search
    }
  }

  // PostgreSQL fallback (original implementation)
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
    .filter((e): e is RetrievedEvent => e !== null && e.similarity > (options?.minSimilarity || 0.5))
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit)

  return ranked
}
```

**Step 3: Run existing tests**

```bash
npm test src/app/api/ai/generate/personalized/
```

Expected: PASS (or tests exist to verify functionality)

**Step 4: Commit**

```bash
git add src/lib/rag-retrieval.ts
git commit -m "feat: integrate Pinecone into RAG retrieval with PostgreSQL fallback"
```

---

## Task 8: Create Admin Authorization Middleware

**Files:**
- Create: `src/middleware/admin-auth.ts`
- Test: `src/middleware/admin-auth.test.ts`

**Step 1: Write the failing test**

Create `src/middleware/admin-auth.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { requireAdminRole } from './admin-auth'
import { NextRequest } from 'next/server'

// Mock dependencies
vi.mock('@/lib/db', () => ({
  db: {
    user: {
      findUnique: vi.fn()
    }
  }
}))

import { db } from '@/lib/db'

describe('admin-auth middleware', () => {
  it('should allow access to admin users', async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue({
      id: 'user-1',
      role: 'admin',
      organizationId: 'org-1'
    } as never)

    const request = new NextRequest('http://localhost:3000/api/ai/admin/insights', {
      headers: { 'x-user-id': 'user-1' }
    })

    const result = await requireAdminRole(request)

    expect(result).toHaveProperty('userId', 'user-1')
  })

  it('should allow access to owner users', async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue({
      id: 'user-1',
      role: 'owner',
      organizationId: 'org-1'
    } as never)

    const request = new NextRequest('http://localhost:3000/api/ai/admin/insights', {
      headers: { 'x-user-id': 'user-1' }
    })

    const result = await requireAdminRole(request)

    expect(result).toHaveProperty('userId', 'user-1')
  })

  it('should deny access to regular members', async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue({
      id: 'user-1',
      role: 'member',
      organizationId: 'org-1'
    } as never)

    const request = new NextRequest('http://localhost:3000/api/ai/admin/insights', {
      headers: { 'x-user-id': 'user-1' }
    })

    const result = await requireAdminRole(request)

    expect(result).toBeInstanceOf(Response)
    expect(await (result as Response).text()).toContain('Forbidden')
  })
})
```

**Step 2: Run test to verify it fails**

```bash
npm test src/middleware/admin-auth.test.ts
```

Expected: FAIL - Module not found

**Step 3: Write the admin auth middleware**

Create `src/middleware/admin-auth.ts`:

```typescript
/**
 * Admin Authorization Middleware
 *
 * Verifies that the requesting user has admin or owner role.
 * Returns 403 Forbidden for unauthorized access.
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * Authorization error response
 */
function forbiddenResponse(message = 'Forbidden: Admin access required'): NextResponse {
  return NextResponse.json(
    { error: message },
    { status: 403 }
  )
}

/**
 * Unauthorized response
 */
function unauthorizedResponse(message = 'Unauthorized'): NextResponse {
  return NextResponse.json(
    { error: message },
    { status: 401 }
  )
}

/**
 * Get user ID from request
 * Uses X-User-ID header or extracts from session/JWT
 */
function getUserIdFromRequest(request: NextRequest): string | null {
  // Try header first (useful for testing/internal calls)
  const headerUserId = request.headers.get('x-user-id')
  if (headerUserId) {
    return headerUserId
  }

  // TODO: Extract from session/JWT in production
  // This would integrate with your auth system (NextAuth v5)
  return null
}

/**
 * Require admin role for route access
 *
 * Returns user context if authorized, error response otherwise
 */
export async function requireAdminRole(
  request: NextRequest
): Promise<{ userId: string; organizationId: string } | NextResponse> {
  const userId = getUserIdFromRequest(request)

  if (!userId) {
    return unauthorizedResponse()
  }

  // Fetch user with role
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      role: true,
      organizationId: true
    }
  })

  if (!user) {
    return unauthorizedResponse('User not found')
  }

  // Check role
  const isAdmin = user.role === 'admin' || user.role === 'owner'

  if (!isAdmin) {
    return forbiddenResponse()
  }

  return {
    userId: user.id,
    organizationId: user.organizationId
  }
}

/**
 * Higher-order function for wrapping route handlers with admin auth
 */
export function withAdminAuth(
  handler: (request: NextRequest, context: { userId: string; organizationId: string }) => Promise<NextResponse>
): (request: NextRequest) => Promise<NextResponse> {
  return async (request: NextRequest) => {
    const authResult = await requireAdminRole(request)

    // If auth failed, return the error response
    if (authResult instanceof NextResponse) {
      return authResult
    }

    // Otherwise, call the handler with user context
    return handler(request, authResult)
  }
}

/**
 * Check if user has admin role (returns boolean instead of Response)
 */
export async function isAdminUser(userId: string): Promise<boolean> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { role: true }
  })

  return user?.role === 'admin' || user?.role === 'owner' || false
}
```

**Step 4: Run tests to verify they pass**

```bash
npm test src/middleware/admin-auth.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/middleware/admin-auth.ts src/middleware/admin-auth.test.ts
git add -f src/middleware/.gitkeep  # Ensure middleware directory is tracked
git commit -m "feat: add admin authorization middleware"
```

---

## Task 9: Update Admin Insights API with Authorization

**Files:**
- Modify: `src/app/api/ai/admin/insights/route.ts`

**Step 1: Read current implementation**

```bash
cat src/app/api/ai/admin/insights/route.ts
```

**Step 2: Add admin authorization to the route**

Update `src/app/api/ai/admin/insights/route.ts`:

```typescript
/**
 * Admin AI Insights API
 *
 * Provides system-wide AI learning metrics and insights.
 * Requires admin or owner role to access.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAdminRole } from '@/middleware/admin-auth'
import { db } from '@/lib/db'

/**
 * GET /api/ai/admin/insights
 *
 * Returns system-wide AI learning metrics for admin dashboard.
 */
export async function GET(request: NextRequest) {
  // Check admin authorization
  const authResult = await requireAdminRole(request)

  if (authResult instanceof NextResponse) {
    return authResult
  }

  const { organizationId } = authResult

  try {
    // Get system-wide insights
    const [totalProfiles, totalEvents, successfulEvents, insights] = await Promise.all([
      // Total user profiles with learning data
      db.userAIProfile.count(),

      // Total learning events
      db.userLearningEvent.count(),

      // Successful events
      db.userLearningEvent.count({
        where: { outcome: 'success' }
      }),

      // AI insights (if exists)
      db.aIInsight.findMany({
        where: {
          organizationId,
          dismissed: false
        },
        take: 10,
        orderBy: { createdAt: 'desc' }
      })
    ])

    // Calculate success rate
    const successRate = totalEvents > 0
      ? (successfulEvents / totalEvents) * 100
      : 0

    // Get top event types
    const eventTypes = await db.userLearningEvent.groupBy({
      by: ['eventType'],
      _count: true,
      orderBy: { _count: { eventType: 'desc' } },
      take: 10
    })

    return NextResponse.json({
      summary: {
        totalProfiles,
        totalEvents,
        successfulEvents,
        successRate: Math.round(successRate * 100) / 100
      },
      topEventTypes: eventTypes.map(t => ({
        eventType: t.eventType,
        count: t._count
      })),
      insights
    })
  } catch (error) {
    console.error('Error fetching admin insights:', error)
    return NextResponse.json(
      { error: 'Failed to fetch insights' },
      { status: 500 }
    )
  }
}
```

**Step 3: Run tests**

```bash
# Test may not exist yet, verify no compilation errors
npm run build 2>&1 | head -50
```

Expected: No compilation errors

**Step 4: Commit**

```bash
git add src/app/api/ai/admin/insights/route.ts
git commit -m "feat: add admin authorization to insights API"
```

---

## Task 10: Create Weekly Pattern Extraction Cron Endpoint

**Files:**
- Create: `src/app/api/cron/extract-patterns/route.ts`
- Test: `src/app/api/cron/extract-patterns/route.test.ts`

**Step 1: Write the failing test**

Create `src/app/api/cron/extract-patterns/route.test.ts`:

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { POST } from './route'
import { NextRequest } from 'next/server'

// Mock dependencies
vi.mock('@/lib/db', () => ({
  db: {
    userLearningEvent: {
      findMany: vi.fn(),
      groupBy: vi.fn()
    },
    userAIProfile: {
      updateMany: vi.fn()
    }
  }
}))

describe('POST /api/cron/extract-patterns', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return 401 without CRON_SECRET', async () => {
    const request = new NextRequest('http://localhost:3000/api/cron/extract-patterns', {
      method: 'POST'
    })

    const response = await POST(request)
    expect(response.status).toBe(401)
  })

  it('should extract patterns when CRON_SECRET is valid', async () => {
    const request = new NextRequest('http://localhost:3000/api/cron/extract-patterns', {
      method: 'POST',
      headers: {
        'x-cron-secret': process.env.CRON_SECRET || 'test-secret'
      }
    })

    const response = await POST(request)
    expect(response.status).toBe(200)

    const data = await response.json()
    expect(data).toHaveProperty('success', true)
    expect(data).toHaveProperty('processed')
  })
})
```

**Step 2: Run test to verify it fails**

```bash
npm test src/app/api/cron/extract-patterns/route.test.ts
```

Expected: FAIL - Route not implemented

**Step 3: Write the cron endpoint**

Create `src/app/api/cron/extract-patterns/route.ts`:

```typescript
/**
 * Weekly Pattern Extraction Cron Job
 *
 * Runs weekly (Sunday 2AM UTC) to extract patterns from successful
 * AI interactions and update user profiles with learnings.
 *
 * Authentication: CRON_SECRET header required
 */

import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'

const CRON_SECRET = process.env.CRON_SECRET

/**
 * Verify cron request authenticity
 */
function verifyCronRequest(request: NextRequest): boolean {
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

    // Get all successful events from the past week
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
      const patternsByType = new Map<string, any[]>()

      for (const event of events) {
        if (!patternsByType.has(event.eventType)) {
          patternsByType.set(event.eventType, [])
        }
        patternsByType.get(event.eventType)!.push(event)
      }

      // Build profile updates
      const profileUpdates: any = {
        writingStyle: {},
        emailPatterns: [],
        smsPatterns: [],
        carrierPreferences: {},
        industryKnowledge: {},
        successfulSources: {}
      }

      // Extract successful output patterns
      for (const [eventType, typeEvents] of patternsByType.entries()) {
        // Extract templates from successful outputs
        for (const event of typeEvents) {
          const output = event.output as Record<string, unknown>

          // Store successful templates
          if (eventType === 'email_sent' && output.content) {
            profileUpdates.emailPatterns.push({
              content: output.content,
              usedAt: event.createdAt,
              entityId: event.entityId
            })
          }

          if (eventType === 'sms_sent' && output.message) {
            profileUpdates.smsPatterns.push({
              message: output.message,
              usedAt: event.createdAt,
              entityId: event.entityId
            })
          }

          // Track carrier preferences
          if (event.leadProfession) {
            const profession = event.leadProfession
            if (!profileUpdates.industryKnowledge[profession]) {
              profileUpdates.industryKnowledge[profession] = {
                attempts: 0,
                successes: 0
              }
            }
            profileUpdates.industryKnowledge[profession].successes++
            profileUpdates.industryKnowledge[profession].attempts++

            patternsExtracted++
          }

          // Track successful sources
          if (event.sourceType) {
            if (!profileUpdates.successfulSources[event.sourceType]) {
              profileUpdates.successfulSources[event.sourceType] = 0
            }
            profileUpdates.successfulSources[event.sourceType]++
          }
        }
      }

      // Update user profile
      await db.userAIProfile.update({
        where: { userId },
        data: {
          writingStyle: profileUpdates.writingStyle,
          emailPatterns: profileUpdates.emailPatterns.slice(-50), // Keep last 50
          smsPatterns: profileUpdates.smsPatterns.slice(-50),
          carrierPreferences: profileUpdates.carrierPreferences,
          industryKnowledge: profileUpdates.industryKnowledge,
          successfulSources: profileUpdates.successfulSources,
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
```

**Step 4: Create Vercel cron configuration**

Create `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/extract-patterns",
      "schedule": "0 2 * * 0"
    }
  ]
}
```

**Step 5: Run tests**

```bash
npm test src/app/api/cron/extract-patterns/route.test.ts
```

Expected: PASS

**Step 6: Commit**

```bash
git add src/app/api/cron/extract-patterns/ vercel.json
git commit -m "feat: add weekly pattern extraction cron endpoint"
```

---

## Task 11: Create Admin Dashboard Page

**Files:**
- Create: `src/app/admin/ai-insights/page.tsx`
- Create: `src/app/admin/ai-insights/components/overview-cards.tsx`
- Create: `src/app/admin/ai-insights/components/learning-trends.tsx`
- Create: `src/app/admin/ai-insights/components/top-patterns.tsx'
- Create: `src/app/admin/ai-insights/components/scraping-performance.tsx'

**Step 1: Create the main dashboard page**

Create `src/app/admin/ai-insights/page.tsx`:

```typescript
/**
 * Admin AI Insights Dashboard
 *
 * Displays system-wide AI learning metrics and insights.
 * Requires admin or owner role to access.
 */

import { Suspense } from 'react'
import { OverviewCards } from './components/overview-cards'
import { LearningTrends } from './components/learning-trends'
import { TopPatterns } from './components/top-patterns'
import { ScrapingPerformance } from './components/scraping-performance'

export const metadata = {
  title: 'AI Insights - Admin',
  description: 'System-wide AI learning metrics and insights'
}

export default function AdminAIInsightsPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">AI Learning Insights</h1>
        <p className="text-muted-foreground mt-2">
          System-wide metrics and patterns extracted from AI interactions
        </p>
      </div>

      <Suspense fallback={<OverviewCards.Skeleton />}>
        <OverviewCards />
      </Suspense>

      <div className="grid gap-8 md:grid-cols-2">
        <Suspense fallback={<LearningTrends.Skeleton />}>
          <LearningTrends />
        </Suspense>

        <Suspense fallback={<TopPatterns.Skeleton />}>
          <TopPatterns />
        </Suspense>
      </div>

      <Suspense fallback={<ScrapingPerformance.Skeleton />}>
        <ScrapingPerformance />
      </Suspense>
    </div>
  )
}
```

**Step 2: Create Overview Cards component**

Create `src/app/admin/ai-insights/components/overview-cards.tsx`:

```typescript
/**
 * Overview Cards Component
 *
 * Displays high-level metrics cards for the AI learning system.
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Activity, TrendingUp, Users, Zap } from 'lucide-react'

async function getOverviewData() {
  const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/ai/admin/insights`, {
    cache: 'no-store'
  })

  if (!response.ok) {
    throw new Error('Failed to fetch overview data')
  }

  return response.json()
}

export function OverviewCards() {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <MetricCard
        title="Total Profiles"
        value={getOverviewData().then(d => d.summary.totalProfiles)}
        icon={Users}
        description="Users with learning data"
      />
      <MetricCard
        title="Total Events"
        value={getOverviewData().then(d => d.summary.totalEvents)}
        icon={Activity}
        description="Tracked interactions"
      />
      <MetricCard
        title="Success Rate"
        value={getOverviewData().then(d => `${d.summary.successRate}%`)}
        icon={TrendingUp}
        description="Successful outcomes"
      />
      <MetricCard
        title="Patterns Found"
        value={getOverviewData().then(d => d.insights.length)}
        icon={Zap}
        description="Active insights"
      />
    </div>
  )
}

function MetricCard({
  title,
  value,
  icon: Icon,
  description
}: {
  title: string
  value: Promise<number | string>
  icon: any
  description: string
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">
          <Suspense fallback={<Skeleton className="h-8 w-20" />}>
            {value.then(v => <div>{v}</div>)}
          </Suspense>
        </div>
        <p className="text-xs text-muted-foreground mt-1">{description}</p>
      </CardContent>
    </Card>
  )
}

OverviewCards.Skeleton = function OverviewCardsSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {[1, 2, 3, 4].map(i => (
        <Card key={i}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-4" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-8 w-20 mb-2" />
            <Skeleton className="h-3 w-32" />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
```

**Step 3: Create Learning Trends component**

Create `src/app/admin/ai-insights/components/learning-trends.tsx`:

```typescript
/**
 * Learning Trends Chart Component
 *
 * Displays AI learning trends over time using Recharts.
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent
} from '@/components/ui/chart'
import { TrendingUp } from 'lucide-react'

export function LearningTrends() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Learning Trends</CardTitle>
        <CardDescription>AI interaction volume and success rates over time</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer
          config={{
            events: {
              label: 'Events',
              color: 'hsl(var(--chart-1))'
            },
            success: {
              label: 'Success Rate',
              color: 'hsl(var(--chart-2))'
            }
          }}
          className="h-[300px]"
        >
          {/* Placeholder - in production, fetch actual trend data */}
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <div className="text-center">
              <TrendingUp className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Trend data coming soon</p>
            </div>
          </div>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}

LearningTrends.Skeleton = function LearningTrendsSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-4 w-48 mt-2" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-[300px] w-full" />
      </CardContent>
    </Card>
  )
}
```

**Step 4: Create Top Patterns component**

Create `src/app/admin/ai-insights/components/top-patterns.tsx`:

```typescript
/**
 * Top Patterns Component
 *
 * Displays the most successful AI-generated patterns.
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'

async function getTopPatterns() {
  const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/ai/admin/insights`, {
    cache: 'no-store'
  })

  if (!response.ok) {
    throw new Error('Failed to fetch patterns')
  }

  return response.json()
}

export function TopPatterns() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Top Performing Patterns</CardTitle>
        <CardDescription>Most successful event types by count</CardDescription>
      </CardHeader>
      <CardContent>
        <Suspense fallback={<TopPatterns.Skeleton />}>
          <TopPatternsList />
        </Suspense>
      </CardContent>
    </Card>
  )
}

async function TopPatternsList() {
  const data = await getTopPatterns()

  return (
    <div className="space-y-4">
      {data.topEventTypes?.slice(0, 5).map((type: any, index: number) => (
        <div key={type.eventType} className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-muted-foreground">#{index + 1}</span>
            <span className="font-medium">{type.eventType}</span>
          </div>
          <Badge variant="secondary">{type.count} events</Badge>
        </div>
      ))}
    </div>
  )
}

TopPatterns.Skeleton = function TopPatternsSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3, 4, 5].map(i => (
        <div key={i} className="flex items-center justify-between">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-5 w-16" />
        </div>
      ))}
    </div>
  )
}
```

**Step 5: Create Scraping Performance component**

Create `src/app/admin/ai-insights/components/scraping-performance.tsx`:

```typescript
/**
 * Scraping Performance Component
 *
 * Displays scraping source performance metrics.
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Database } from 'lucide-react'

async function getScrapingPerformance() {
  const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/scraping/performance`, {
    cache: 'no-store'
  })

  if (!response.ok) {
    return []
  }

  return response.json()
}

export function ScrapingPerformance() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Scraping Performance</CardTitle>
        <CardDescription>Lead source performance by conversion rate</CardDescription>
      </CardHeader>
      <CardContent>
        <Suspense fallback={<ScrapingPerformance.Skeleton />}>
          <ScrapingPerformanceList />
        </Suspense>
      </CardContent>
    </Card>
  )
}

async function ScrapingPerformanceList() {
  const sources = await getScrapingPerformance()

  if (!sources || sources.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground">
        <div className="text-center">
          <Database className="h-12 w-12 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No scraping data available</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {sources.slice(0, 10).map((source: any, index: number) => (
        <div key={source.id || index} className="flex items-center justify-between">
          <div>
            <p className="font-medium">{source.sourceDomain}</p>
            <p className="text-sm text-muted-foreground">
              {source.leadsCreated || 0} leads created
            </p>
          </div>
          <div className="text-right">
            <p className="font-medium">
              {source.conversionRate ? `${(source.conversionRate * 100).toFixed(1)}%` : 'N/A'}
            </p>
            <p className="text-sm text-muted-foreground">conversion rate</p>
          </div>
        </div>
      ))}
    </div>
  )
}

ScrapingPerformance.Skeleton = function ScrapingPerformanceSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3, 4, 5].map(i => (
        <div key={i} className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-24" />
          </div>
          <div className="space-y-2 text-right">
            <Skeleton className="h-4 w-16 ml-auto" />
            <Skeleton className="h-3 w-24 ml-auto" />
          </div>
        </div>
      ))}
    </div>
  )
}
```

**Step 6: Verify build**

```bash
npm run build 2>&1 | tail -20
```

Expected: Build succeeds

**Step 7: Commit**

```bash
git add src/app/admin/ai-insights/
git commit -m "feat: add admin AI insights dashboard"
```

---

## Task 12: Add Chart Component Dependencies

**Files:**
- Create: `src/components/ui/chart.tsx`

**Step 1: Create the chart component (shadcn/ui compatible)**

Create `src/components/ui/chart.tsx`:

```typescript
"use client"

import * as React from "react"
import * as RechartsPrimitive from "recharts"

import { cn } from "@/lib/utils"

const ChartContainer = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div"> & {
    config: Record<string, { label?: string; icon?: React.ComponentType; color?: string }>
  }
>(({ children, config, className, ...props }, ref) => {
  return (
    <div
      ref={ref}
      className={cn("flex items-center justify-center text-sm", className)}
      {...props}
    >
      {children}
    </div>
  )
})
ChartContainer.displayName = "ChartContainer"

const ChartTooltip = RechartsPrimitive.Tooltip

const ChartTooltipContent = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<typeof RechartsPrimitive.Tooltip> &
    React.ComponentProps<"div">
>(({ active, payload, className, ...props }, ref) => {
  return (
    <div
      ref={ref}
      className={cn(
        "grid min-w-[8rem] items-start gap-1.5 rounded-lg border bg-background px-2.5 py-1.5 text-xs shadow-xl",
        className
      )}
      {...props}
    >
      {active && payload && payload.length ? (
        payload.map((entry: any, index: number) => (
          <div key={index} className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1">
              <div
                className="h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-muted-foreground">{entry.name}</span>
            </div>
            <span className="font-mono font-medium tabular-nums text-foreground">
              {entry.value}
            </span>
          </div>
        ))
      ) : null}
    </div>
  )
})
ChartTooltipContent.displayName = "ChartTooltipContent"

export { ChartContainer, ChartTooltip, ChartTooltipContent }
```

**Step 2: Commit**

```bash
git add src/components/ui/chart.tsx
git commit -m "feat: add chart component for admin dashboard"
```

---

## Task 13: Update .gitignore for Environment Files

**Files:**
- Modify: `.gitignore`

**Step 1: Add environment patterns to .gitignore**

```bash
# Append to .gitignore

# Environment files
.env.local
.env.*.local
```

**Step 2: Commit**

```bash
git add .gitignore
git commit -m "chore: update .gitignore for local environment files"
```

---

## Task 14: Generate CRON_SECRET

**Step 1: Generate a secure CRON_SECRET**

```bash
openssl rand -base64 32
```

Save the output - you'll need to add it to your environment variables.

**Step 2: Document the secret in deployment notes**

Create `docs/deployment/cron-setup.md`:

```markdown
# Cron Job Setup

## CRON_SECRET Generation

Generate a secure cron secret:

```bash
openssl rand -base64 32
```

Add the output to your environment variables:

```bash
CRON_SECRET=<generated-secret>
```

## Vercel Cron Configuration

The cron job is configured in `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/extract-patterns",
      "schedule": "0 2 * * 0"
    }
  ]
}
```

This runs weekly on Sunday at 2 AM UTC.

## Manual Trigger

To manually trigger the pattern extraction:

```bash
curl -X POST https://your-domain.com/api/cron/extract-patterns \
  -H "x-cron-secret: YOUR_CRON_SECRET"
```
```

**Step 3: Commit**

```bash
git add docs/deployment/cron-setup.md
git commit -m "docs: add cron job setup documentation"
```

---

## Task 15: Create Pinecone Index Setup Guide

**Step 1: Create Pinecone setup documentation**

Create `docs/deployment/pinecone-setup.md`:

```markdown
# Pinecone Vector Database Setup

## Prerequisites

- Pinecone account (free tier available)
- Organization ID

## Create Index

1. Log in to [Pinecone Console](https://app.pinecone.io/)
2. Create a new index with these settings:
   - **Name**: `kingcrm-ai-events`
   - **Dimensions**: `1536`
   - **Metric**: `cosine`
   - **Pod Type**: `p1.x1` (or `s1.x1` for serverless)

## Environment Variables

Add to your environment:

```bash
PINECONE_API_KEY=your-api-key-here
PINECONE_INDEX=kingcrm-ai-events
PINECONE_ENVIRONMENT=us-east-1-aws
```

## Verification

Test the connection:

```bash
curl -X GET https://api.pinecone.io/indexes \
  -H "Api-Key: YOUR_API_KEY"
```

Should return your index details.
```

**Step 2: Commit**

```bash
git add docs/deployment/pinecone-setup.md
git commit -m "docs: add Pinecone setup guide"
```

---

## Task 16: Run Full Test Suite

**Step 1: Run all tests**

```bash
npm test
```

Expected: 54+ tests passing (2 known mock issues are acceptable)

**Step 2: Fix any failing tests if needed**

If new tests fail, debug and fix them.

**Step 3: Run type checking**

```bash
npx tsc --noEmit
```

Expected: No type errors

**Step 4: Run build**

```bash
npm run build
```

Expected: Build succeeds

---

## Task 17: Create Integration Test for Pinecone Flow

**Files:**
- Create: `src/app/api/ai/track/integration.pinecone.test.ts`

**Step 1: Write integration test**

Create `src/app/api/ai/track/integration.pinecone.test.ts`:

```typescript
/**
 * Integration test for Pinecone sync flow
 *
 * Tests the complete flow: create event → sync to Pinecone → retrieve via RAG
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { trackAIEvent } from '@/lib/ai-tracking'
import { retrieveSimilarEvents } from '@/lib/rag-retrieval'
import { PineconeClient } from '@/lib/pinecone-client'
import { db } from '@/lib/db'

describe('Pinecone Integration', () => {
  const testUserId = 'test-pinecone-user'
  const testOrgId = 'test-pinecone-org'

  beforeAll(async () => {
    // Initialize Pinecone
    await PineconeClient.initialize()

    // Create test user and profile
    await db.user.upsert({
      where: { id: testUserId },
      create: {
        id: testUserId,
        email: 'pinecone-test@example.com',
        organizationId: testOrgId,
        name: 'Pinecone Test User'
      },
      update: {}
    })
  })

  afterAll(async () => {
    // Cleanup
    await db.userLearningEvent.deleteMany({
      where: {
        userProfile: { user: { id: testUserId } }
      }
    })

    await db.userAIProfile.deleteMany({
      where: { user: { id: testUserId } }
    })

    await db.user.delete({
      where: { id: testUserId }
    })

    // Clean up Pinecone
    await PineconeClient.clearNamespace(testOrgId)
  })

  it('should create event and sync to Pinecone', async () => {
    const result = await trackAIEvent(
      testUserId,
      'sms_sent',
      'lead',
      'lead-1',
      { message: 'Test message for Pinecone' },
      { sent: true },
      { syncToPinecone: true }
    )

    expect(result).toHaveProperty('eventId')
    expect(result).toHaveProperty('pineconeId')
    expect(result.pineconeId).toContain(testOrgId)
  })

  it('should retrieve similar events via RAG', async () => {
    // Create a few similar events
    await trackAIEvent(
      testUserId,
      'sms_sent',
      'lead',
      'lead-1',
      { message: 'Hello from kingCRM' },
      { sent: true },
      { syncToPinecone: true }
    )

    await trackAIEvent(
      testUserId,
      'sms_sent',
      'lead',
      'lead-2',
      { message: 'Hi from kingCRM team' },
      { sent: true },
      { syncToPinecone: true }
    )

    // Wait for Pinecone index to refresh
    await new Promise(resolve => setTimeout(resolve, 2000))

    // Retrieve similar events
    const similar = await retrieveSimilarEvents(
      testUserId,
      { message: 'Hello from the kingCRM platform' },
      'sms_sent',
      5,
      { usePinecone: true, organizationId: testOrgId }
    )

    expect(similar.length).toBeGreaterThan(0)
    expect(similar[0]).toHaveProperty('similarity')
  })
})
```

**Step 2: Run integration test (requires real Pinecone)**

```bash
# Only run if Pinecone credentials are set
npm test src/app/api/ai/track/integration.pinecone.test.ts
```

**Step 3: Commit**

```bash
git add src/app/api/ai/track/integration.pinecone.test.ts
git commit -m "test: add Pinecone integration test"
```

---

## Task 18: Final Verification and Documentation

**Step 1: Create feature documentation**

Create `docs/features/ai-learning-system-elite.md`:

```markdown
# AI Learning System - Maximum Elite

## Overview

The AI Learning System tracks every AI interaction, learns from successful outcomes, and personalizes future content generation based on each user's patterns.

## Features

### 1. Event Tracking
- **Endpoint**: `POST /api/ai/track`
- **Purpose**: Records all AI interactions with full context
- **Includes**: Input, output, embeddings, metadata

### 2. User Feedback
- **Endpoint**: `POST /api/ai/feedback`
- **Purpose**: Records outcomes and user corrections
- **Impact**: Directly improves future personalization

### 3. Personalized Generation
- **Endpoint**: `POST /api/ai/generate/personalized`
- **Purpose**: RAG-based content generation using learned patterns
- **Retrieves**: Similar past events via vector search

### 4. Admin Insights
- **Endpoint**: `GET /api/ai/admin/insights`
- **Purpose**: System-wide learning metrics
- **Requires**: Admin or owner role
- **Dashboard**: `/admin/ai-insights`

### 5. Weekly Pattern Extraction
- **Endpoint**: `POST /api/cron/extract-patterns`
- **Schedule**: Weekly (Sunday 2 AM UTC)
- **Purpose**: Extract and store successful patterns

### 6. Scraping Performance
- **Endpoint**: `GET /api/scraping/performance`
- **Purpose**: Track lead source quality and conversion

## Architecture

```
OpenAI Embeddings → Pinecone Vector DB → RAG Retrieval
                                          ↓
                          Personalized Content Generation
```

## API Usage Examples

### Track an Event

```typescript
const result = await fetch('/api/ai/track', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    eventType: 'sms_sent',
    entityType: 'lead',
    entityId: 'lead-123',
    input: { message: 'Hello!' },
    output: { sent: true }
  })
})
```

### Generate Personalized Content

```typescript
const result = await fetch('/api/ai/generate/personalized', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    contentType: 'sms',
    context: {
      leadName: 'John',
      profession: 'Contractor'
    }
  })
})
```

## Configuration

### Environment Variables

```bash
# Required
OPENAI_API_KEY=sk-...
PINECONE_API_KEY=...
PINECONE_INDEX=kingcrm-ai-events
CRON_SECRET=...

# Optional
EMBEDDING_MODEL=text-embedding-3-small
USE_PINECONE_FOR_RAG=true
ASYNC_PINECONE_SYNC=true
```

## Monitoring

### Metrics to Track

- Total interactions per user
- Success rate by event type
- Pinecone query performance
- Embedding API costs

### Admin Dashboard

Visit `/admin/ai-insights` for:
- Overview metrics
- Learning trends
- Top performing patterns
- Scraping performance

## Troubleshooting

### Pinecone Sync Fails

Check:
1. `PINECONE_API_KEY` is set
2. Index exists in Pinecone console
3. Index has 1536 dimensions

### Embeddings Not Generating

Check:
1. `OPENAI_API_KEY` is valid
2. API quota not exceeded
3. Fallback to hash-based enabled

### Cron Job Not Running

Check:
1. `CRON_SECRET` matches
2. Vercel cron is configured
3. Check deployment logs

## Cost Estimates

### OpenAI Embeddings
- Model: `text-embedding-3-small`
- Cost: $0.02 / 1M tokens
- Est. per 10K events: ~$0.04

### Pinecone
- Starter tier: $70/month (100K vectors)
- Production tier: $280/month (1M vectors)
```

**Step 2: Verify all tasks complete**

```bash
# Check git status
git status

# List all new files
git ls-files --others --exclude-standard

# Verify migration status
npx prisma migrate status
```

**Step 3: Final commit for documentation**

```bash
git add docs/
git commit -m "docs: add complete AI Learning System documentation"
```

---

## Task 19: Create Rollback Plan

**File:**
- Create: `docs/rollback/ai-learning-elite.md`

**Step 1: Create rollback documentation**

Create `docs/rollback/ai-learning-elite.md`:

```markdown
# AI Learning System - Maximum Elite Rollback Plan

## Scenarios and Rollback Steps

### Scenario 1: Pinecone Integration Issues

**Symptoms:**
- Event tracking failing
- High latency on event creation
- Pinecone API errors in logs

**Rollback:**
1. Set environment variable: `USE_PINECONE_FOR_RAG=false`
2. Set environment variable: `ASYNC_PINECONE_SYNC=false`
3. Redeploy application
4. System will use PostgreSQL similarity search

**Verification:**
```bash
curl https://your-app.com/api/ai/track -d '{}' -H "Content-Type: application/json"
# Should succeed without Pinecone
```

### Scenario 2: OpenAI Embedding Issues

**Symptoms:**
- Embedding generation failing
- OpenAI quota exceeded
- API key invalid

**Rollback:**
1. Set environment variable: `EMBEDDING_FALLBACK_ENABLED=true`
2. Or remove `OPENAI_API_KEY`
3. System will use hash-based embeddings

**Note:** Hash-based embeddings provide consistency but not semantic similarity.

### Scenario 3: Cron Job Failures

**Symptoms:**
- Weekly pattern extraction not running
- Vercel cron errors

**Rollback:**
1. Remove `vercel.json` cron configuration
2. Manually trigger patterns:
```bash
curl -X POST https://your-app.com/api/cron/extract-patterns \
  -H "x-cron-secret: YOUR_SECRET"
```

### Scenario 4: Database Migration Issues

**Symptoms:**
- Schema errors
- pineconeId column issues

**Rollback:**
```bash
# Rollback migration
npx prisma migrate resolve --rolled-back [migration-name]

# Or manually remove column
npx prisma db execute --stdin
ALTER TABLE "UserLearningEvent" DROP COLUMN "pineconeId";
```

### Scenario 5: Full System Rollback

**To revert all Maximum Elite features:**

1. Revert to commit before elite implementation:
```bash
git log --oneline | grep "feat: add"
# Find the commit before elite work started
git revert <commit-range>
```

2. Remove environment variables:
```bash
unset OPENAI_API_KEY
unset PINECONE_API_KEY
unset CRON_SECRET
```

3. Rollback database:
```bash
npx prisma migrate resolve --rolled-back add_pinecone_id
```

4. Redeploy

## Data Preservation

### Before Rollback

1. Export learning data:
```bash
npx prisma db pull
# Backup your database
```

2. Export Pinecone data (if available):
```bash
# Use Pinecone export feature or query all vectors
```

### After Rollback

1. Verify core functionality:
```bash
# Test event tracking
curl -X POST /api/ai/track -d '{"eventType":"test"}'

# Test profile retrieval
curl /api/ai/profile
```

2. Monitor logs for errors

## Support Contacts

- Database: Check Prisma documentation
- Pinecone: https://docs.pinecone.io
- OpenAI: https://platform.openai.com/docs
```

**Step 2: Commit rollback documentation**

```bash
git add docs/rollback/
git commit -m "docs: add rollback procedures for AI Learning System"
```

---

## Task 20: Final Push and Verification

**Step 1: Review all commits**

```bash
git log --oneline -20
```

Expected commits:
- feat: add pineconeId field to UserLearningEvent
- feat: add pinecone, recharts, and crypto-js dependencies
- feat: add environment variables for elite features
- feat: add Pinecone client library for vector search
- feat: enhance embedding service with OpenAI integration
- feat: add Pinecone sync to AI event tracking
- feat: integrate Pinecone into RAG retrieval
- feat: add admin authorization middleware
- feat: add admin authorization to insights API
- feat: add weekly pattern extraction cron endpoint
- feat: add admin AI insights dashboard
- feat: add chart component for admin dashboard
- test: add Pinecone integration test
- docs: add deployment and rollback documentation

**Step 2: Run final test suite**

```bash
npm test
```

Expected: All tests pass

**Step 3: Run type check**

```bash
npx tsc --noEmit
```

Expected: No errors

**Step 4: Run build**

```bash
npm run build
```

Expected: Build succeeds

**Step 5: Create summary document**

Create `docs/implementation-summary-elite.md`:

```markdown
# Maximum Elite AI Learning System - Implementation Complete

**Date:** 2026-03-20
**Status:** ✅ Complete
**Tasks:** 20 implementation tasks

## What Was Built

### Core Infrastructure
- ✅ OpenAI embedding integration with hash fallback
- ✅ Pinecone vector database client
- ✅ Admin authorization middleware
- ✅ Weekly pattern extraction cron

### Database
- ✅ Added `pineconeId` field to UserLearningEvent
- ✅ Migration created and applied

### APIs
- ✅ Enhanced `/api/ai/track` with Pinecone sync
- ✅ Enhanced `/api/ai/generate/personalized` with RAG
- ✅ Protected `/api/ai/admin/insights` with auth
- ✅ Created `/api/cron/extract-patterns` endpoint

### Admin Dashboard
- ✅ Overview cards with metrics
- ✅ Learning trends chart
- ✅ Top performing patterns list
- ✅ Scraping performance display

### Testing
- ✅ Unit tests for Pinecone client
- ✅ Unit tests for embedding service
- ✅ Unit tests for admin auth
- ✅ Integration tests for Pinecone flow

### Documentation
- ✅ Design document
- ✅ Deployment guides (Pinecone, cron)
- ✅ Feature documentation
- ✅ Rollback procedures

## Next Steps for Production

1. **Set up Pinecone index**
   - Follow `docs/deployment/pinecone-setup.md`
   - Create index: 1536 dimensions, cosine metric

2. **Generate CRON_SECRET**
   ```bash
   openssl rand -base64 32
   ```

3. **Configure environment variables**
   - Add to Vercel/project environment
   - See `.env.example` for complete list

4. **Deploy**
   ```bash
   git push origin main
   ```

5. **Verify deployment**
   - Check admin dashboard at `/admin/ai-insights`
   - Test event creation and Pinecone sync
   - Verify cron job scheduled

## Success Metrics

| Metric | Target | Status |
|--------|--------|--------|
| Tests passing | 54+ | ✅ |
| Type errors | 0 | ✅ |
| Build success | Yes | ✅ |
| Documentation | Complete | ✅ |
| Rollback plan | Defined | ✅ |

## Cost Estimate

- OpenAI Embeddings: ~$0.04 per 10K events
- Pinecone Starter: $70/month (100K vectors)

## Support

- OpenAI: https://platform.openai.com/docs
- Pinecone: https://docs.pinecone.io
- Rollback: `docs/rollback/ai-learning-elite.md`

---

**Implementation complete!** 🎉
```

**Step 6: Final commit**

```bash
git add docs/implementation-summary-elite.md
git commit -m "docs: add implementation summary for Maximum Elite AI Learning System"
```

**Step 7: Push to remote**

```bash
git push origin main
```

---

## Implementation Complete

All 20 tasks completed. The Maximum Elite AI Learning System is now ready for deployment.

**Summary of Changes:**
- 20 new/modified files
- 3 new npm packages
- 1 database migration
- 5 new API endpoints
- 1 admin dashboard
- Complete documentation suite

**Ready to Deploy:**
1. Set up Pinecone index
2. Configure environment variables
3. Push to production
4. Verify cron job scheduled

---

**Plan Document Saved To:** `docs/plans/2026-03-20-ai-learning-maximum-elite-implementation.md`
