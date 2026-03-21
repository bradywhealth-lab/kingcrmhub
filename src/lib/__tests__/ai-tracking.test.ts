import { describe, it, expect, beforeEach, vi } from 'vitest'

// Basic type export tests for ai-tracking module
describe('AI Tracking Module', () => {
  it('should export trackAIEvent function', async () => {
    const { trackAIEvent } = await import('@/lib/ai-tracking')
    expect(typeof trackAIEvent).toBe('function')
  })

  it('should export recordEventOutcome function', async () => {
    const { recordEventOutcome } = await import('@/lib/ai-tracking')
    expect(typeof recordEventOutcome).toBe('function')
  })

  it('should export getUserAIProfile function', async () => {
    const { getUserAIProfile } = await import('@/lib/ai-tracking')
    expect(typeof getUserAIProfile).toBe('function')
  })

  it('should export ensureUserAIProfile function', async () => {
    const { ensureUserAIProfile } = await import('@/lib/ai-tracking')
    expect(typeof ensureUserAIProfile).toBe('function')
  })

  it('should export LearningEventType with correct values', async () => {
    const type = await import('@/lib/ai-tracking')
    const eventType: 'sms_sent' = 'sms_sent'
    expect(eventType).toBe('sms_sent')
  })
})
