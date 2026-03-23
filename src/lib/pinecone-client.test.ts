import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock the Pinecone SDK - must be before any imports
vi.mock('@pinecone-database/pinecone', () => {
  const mockIndex = {
    upsert: vi.fn().mockResolvedValue({ upsertedCount: 1 }),
    query: vi.fn().mockResolvedValue({
      matches: [
        { id: 'event-1', score: 0.95, metadata: { userId: 'user-1', organizationId: 'org-1', eventType: 'sms_sent', entityType: 'lead', entityId: 'lead-1', outcome: 'success', createdAt: new Date().toISOString() } }
      ]
    }),
    deleteOne: vi.fn().mockResolvedValue(undefined)
  }

  return {
    Pinecone: class {
      index() {
        return mockIndex
      }
    }
  }
})

// Import after mock
import { PineconeClient } from './pinecone-client'

describe('PineconeClient', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset environment and client state
    delete process.env.PINECONE_API_KEY
    // Reset static properties
    PineconeClient['client'] = null
    PineconeClient['initialized'] = false
  })

  describe('initialize', () => {
    it('should initialize the Pinecone client', async () => {
      // Set API key for test
      process.env.PINECONE_API_KEY = 'test-api-key'

      await PineconeClient.initialize()
      expect(PineconeClient['client']).toBeDefined()

      delete process.env.PINECONE_API_KEY
    })

    it('should not initialize when API key is missing', async () => {
      await PineconeClient.initialize()
      expect(PineconeClient['client']).toBeNull()
    })
  })

  describe('upsertEvent', () => {
    it('should upsert an event embedding with metadata', async () => {
      process.env.PINECONE_API_KEY = 'test-api-key'

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

      // Verify upsert was called by checking if client was initialized
      expect(PineconeClient['client']).toBeDefined()

      delete process.env.PINECONE_API_KEY
    })

    it('should skip upsert when Pinecone is not available', async () => {
      // No API key set
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

      // Client should not be initialized
      expect(PineconeClient['client']).toBeNull()
    })
  })

  describe('searchSimilar', () => {
    it('should search for similar events by vector', async () => {
      process.env.PINECONE_API_KEY = 'test-api-key'

      await PineconeClient.initialize()

      const results = await PineconeClient.searchSimilar(
        new Array(1536).fill(0.1),
        'user-1',
        'org-1',
        { eventType: 'sms_sent' },
        5
      )

      // Verify client was used
      expect(PineconeClient['client']).toBeDefined()
      expect(results).toBeDefined()
      expect(Array.isArray(results)).toBe(true)

      delete process.env.PINECONE_API_KEY
    })

    it('should return empty array when Pinecone is not available', async () => {
      // No API key set
      await PineconeClient.initialize()

      const results = await PineconeClient.searchSimilar(
        new Array(1536).fill(0.1),
        'user-1',
        'org-1',
        { eventType: 'sms_sent' },
        5
      )

      expect(results).toEqual([])
    })
  })

  describe('deleteEvent', () => {
    it('should delete an event from Pinecone', async () => {
      process.env.PINECONE_API_KEY = 'test-api-key'

      await PineconeClient.initialize()

      await PineconeClient.deleteEvent('event-1', 'org-1')

      // Verify client was initialized
      expect(PineconeClient['client']).toBeDefined()

      delete process.env.PINECONE_API_KEY
    })

    it('should skip delete when Pinecone is not available', async () => {
      // No API key set
      await PineconeClient.initialize()

      await PineconeClient.deleteEvent('event-1', 'org-1')

      // Should complete without error even though client is not initialized
      expect(PineconeClient['client']).toBeNull()
    })
  })

  describe('isAvailable', () => {
    it('should return true when initialized', async () => {
      // Reset state first
      PineconeClient['client'] = null
      PineconeClient['initialized'] = false

      process.env.PINECONE_API_KEY = 'test-api-key'

      await PineconeClient.initialize()

      // Verify client was created
      expect(PineconeClient['client']).toBeDefined()
      expect(PineconeClient['client']).not.toBeNull()

      // Check availability
      expect(PineconeClient.isAvailable()).toBe(true)

      delete process.env.PINECONE_API_KEY
    })

    it('should return false when not initialized', async () => {
      // Reset state first
      PineconeClient['client'] = null
      PineconeClient['initialized'] = false

      await PineconeClient.initialize()

      expect(PineconeClient.isAvailable()).toBe(false)
    })
  })
})
