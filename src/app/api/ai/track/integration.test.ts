import { describe, it, expect } from 'vitest'

describe('AI Learning Integration - Type Verification', () => {
  it('should export trackAIEvent with correct types', async () => {
    const { trackAIEvent } = await import('@/lib/ai-tracking')
    expect(typeof trackAIEvent).toBe('function')
  })

  it('should export recordEventOutcome with correct types', async () => {
    const { recordEventOutcome } = await import('@/lib/ai-tracking')
    expect(typeof recordEventOutcome).toBe('function')
  })

  it('should have embedding utilities available', async () => {
    const embeddings = await import('@/lib/embeddings')
    expect(typeof embeddings.generateEmbedding).toBe('function')
    expect(typeof embeddings.cosineSimilarity).toBe('function')
  })

  it('should have RAG retrieval utilities available', async () => {
    const rag = await import('@/lib/rag-retrieval')
    expect(typeof rag.retrieveSimilarEvents).toBe('function')
    expect(typeof rag.getSuccessfulPatterns).toBe('function')
  })

  it('should have scraping tracker utilities available', async () => {
    const tracker = await import('@/lib/scraping-tracker')
    expect(typeof tracker.trackScrapingPerformance).toBe('function')
    expect(typeof tracker.recordLeadConversion).toBe('function')
    expect(typeof tracker.getScrapingPerformanceReport).toBe('function')
  })
})
