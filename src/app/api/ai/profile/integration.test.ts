import { describe, it, expect } from 'vitest'

describe('AI Profile Integration - Type Verification', () => {
  it('should have getUserAIProfile available', async () => {
    const { getUserAIProfile } = await import('@/lib/ai-tracking')
    expect(typeof getUserAIProfile).toBe('function')
  })

  it('should have ensureUserAIProfile available', async () => {
    const { ensureUserAIProfile } = await import('@/lib/ai-tracking')
    expect(typeof ensureUserAIProfile).toBe('function')
  })
})
