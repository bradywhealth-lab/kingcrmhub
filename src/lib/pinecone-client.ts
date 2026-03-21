/**
 * Pinecone Vector Database Client
 *
 * Manages vector storage and retrieval for the AI Learning System.
 * Provides semantic search capabilities using Pinecone's vector database.
 */

import { Pinecone as PineconeSDK } from '@pinecone-database/pinecone'

// Configuration
const PINECONE_INDEX = process.env.PINECONE_INDEX || 'kingcrm-ai-events'
// PINECONE_ENVIRONMENT is kept for reference but not used in SDK v7
// SDK v7 automatically determines the environment from the index configuration
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
    // Check if already initialized or API key not available (at call time)
    const apiKey = process.env.PINECONE_API_KEY

    if (this.initialized) {
      return
    }

    if (!apiKey) {
      console.warn('PINECONE_API_KEY not set - Pinecone features will be disabled')
      return
    }

    try {
      this.client = new PineconeSDK({
        apiKey: apiKey
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

      await index.upsert({
        records: [
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
        ],
        namespace
      })

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
      const byOrg = new Map<string, Array<{id: string, values: number[], metadata: Record<string, string | number | boolean> }>>()

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
      const entries = Array.from(byOrg.entries())
      for (const [namespace, records] of entries) {
        await index.upsert({ records, namespace })
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

      await index.deleteOne({ id: eventId, namespace })
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

// Note: Initialization is handled lazily when methods are called
// This avoids auto-initialization during testing
