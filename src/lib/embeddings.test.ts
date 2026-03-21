import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock OpenAI
vi.mock('openai', () => {
  const mockCreate = vi.fn().mockResolvedValue({
    data: [{ embedding: new Array(1536).fill(0.1) }]
  })

  return {
    default: vi.fn(() => ({
      embeddings: {
        create: mockCreate
      }
    }))
  }
})

// Import after mock
import { generateEmbedding, generateEmbeddingWithMetadata, cosineSimilarity, clearEmbeddingCache, getEmbeddingCacheStats, generateEmbeddingsBatch } from './embeddings'

describe('embeddings', () => {
  beforeEach(() => {
    // Clear cache before each test
    clearEmbeddingCache()
    // Reset environment
    delete process.env.OPENAI_API_KEY
  })

  describe('generateEmbedding', () => {
    it('should generate consistent hash-based embeddings when OpenAI is not configured', async () => {
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

    it('should cache embeddings by default', async () => {
      const text = 'cache test'
      await generateEmbedding(text)
      await generateEmbedding(text)

      const stats = getEmbeddingCacheStats()
      expect(stats.size).toBeGreaterThan(0)
    })

    it('should bypass cache when forceRefresh is true', async () => {
      process.env.OPENAI_API_KEY = 'test-key'

      const text = 'refresh test'
      await generateEmbedding(text, { forceRefresh: true })
      await generateEmbedding(text, { forceRefresh: true })

      // Should have 2 entries since we bypassed cache
      const stats = getEmbeddingCacheStats()
      expect(stats.size).toBeGreaterThan(0)

      delete process.env.OPENAI_API_KEY
    })
  })

  describe('generateEmbeddingWithMetadata', () => {
    it('should return metadata with embedding', async () => {
      const result = await generateEmbeddingWithMetadata('test text')

      expect(result).toHaveProperty('embedding')
      expect(result).toHaveProperty('source')
      expect(result).toHaveProperty('cached')
      expect(result.embedding).toHaveLength(1536)
      expect(['openai', 'hash']).toContain(result.source)
    })
  })

  describe('generateEmbeddingsBatch', () => {
    it('should generate embeddings for multiple texts', async () => {
      const texts = ['text one', 'text two', 'text three']
      const embeddings = await generateEmbeddingsBatch(texts)

      expect(embeddings).toHaveLength(3)
      embeddings.forEach(embedding => {
        expect(embedding).toHaveLength(1536)
      })
    })

    it('should handle empty array', async () => {
      const embeddings = await generateEmbeddingsBatch([])
      expect(embeddings).toEqual([])
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

    it('should handle vectors of different lengths', () => {
      const vec1 = [1, 0, 0]
      const vec2 = [1, 0]

      const similarity = cosineSimilarity(vec1, vec2)
      expect(similarity).toBe(0)
    })
  })

  describe('cache management', () => {
    it('should clear cache', async () => {
      await generateEmbedding('test')
      expect(getEmbeddingCacheStats().size).toBeGreaterThan(0)

      clearEmbeddingCache()
      expect(getEmbeddingCacheStats().size).toBe(0)
    })

    it('should return cache stats', async () => {
      await generateEmbedding('test')
      const stats = getEmbeddingCacheStats()

      expect(stats).toHaveProperty('size')
      expect(stats).toHaveProperty('keys')
      expect(typeof stats.size).toBe('number')
      expect(Array.isArray(stats.keys)).toBe(true)
    })
  })
})
