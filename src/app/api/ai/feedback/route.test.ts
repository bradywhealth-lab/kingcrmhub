import { describe, it, expect, beforeEach, vi } from 'vitest'
import { POST } from './route'
import { db } from '@/lib/db'

// Mock db
vi.mock('@/lib/db', () => ({
  db: {
    aIFeedback: {
      create: vi.fn(),
    },
    userLearningEvent: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
  },
}))

// Mock request context
vi.mock('@/lib/request-context', () => ({
  withRequestOrgContext: vi.fn((_, fn) => fn({ userId: 'test-user', organizationId: 'test-org' })),
}))

// Mock rate limit
vi.mock('@/lib/rate-limit', () => ({
  enforceRateLimit: vi.fn(() => null),
}))

// Mock validation
vi.mock('@/lib/validation', () => ({
  parseJsonBody: vi.fn(async (_, schema) => {
    return { success: true, data: {
      entityType: 'sms_sent',
      entityId: 'lead-1',
      eventId: 'event-1',
      rating: 5,
      feedback: 'Great response!',
    }}
  }),
}))

// Mock recordEventOutcome
vi.mock('@/lib/ai-tracking', () => ({
  recordEventOutcome: vi.fn(),
}))

describe('/api/ai/feedback enhanced', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should save feedback and link to learning event when eventId provided', async () => {
    const mockFeedback = { id: 'feedback-1', rating: 5 }

    ;(db.aIFeedback.create as any).mockResolvedValue(mockFeedback)
    const { recordEventOutcome } = await import('@/lib/ai-tracking')
    vi.mocked(recordEventOutcome).mockResolvedValue({})

    const request = new Request('http://localhost:3000/api/ai/feedback', {
      method: 'POST',
      body: JSON.stringify({
        entityType: 'sms_sent',
        entityId: 'lead-1',
        eventId: 'event-1',
        rating: 5,
        feedback: 'Great response!',
      }),
    })

    const response = await POST(request as any)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.feedback).toBeDefined()
    expect(recordEventOutcome).toHaveBeenCalledWith({
      eventId: 'event-1',
      outcome: 'success',
      userRating: 5,
      userCorrection: undefined,
    })
  })

  it('should handle negative rating as failure outcome', async () => {
    const mockFeedback = { id: 'feedback-1', rating: 1 }

    ;(db.aIFeedback.create as any).mockResolvedValue(mockFeedback)
    const { recordEventOutcome } = await import('@/lib/ai-tracking')
    vi.mocked(recordEventOutcome).mockResolvedValue({})

    const request = new Request('http://localhost:3000/api/ai/feedback', {
      method: 'POST',
      body: JSON.stringify({
        entityType: 'sms_sent',
        entityId: 'lead-1',
        eventId: 'event-1',
        rating: 1,
        feedback: 'Not good',
      }),
    })

    const response = await POST(request as any)

    expect(response.status).toBe(200)
    expect(recordEventOutcome).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: 'failure' })
    )
  })

  it('should handle neutral rating as pending outcome', async () => {
    const mockFeedback = { id: 'feedback-1', rating: 3 }

    ;(db.aIFeedback.create as any).mockResolvedValue(mockFeedback)
    const { recordEventOutcome } = await import('@/lib/ai-tracking')
    vi.mocked(recordEventOutcome).mockResolvedValue({})

    const request = new Request('http://localhost:3000/api/ai/feedback', {
      method: 'POST',
      body: JSON.stringify({
        entityType: 'sms_sent',
        entityId: 'lead-1',
        eventId: 'event-1',
        rating: 3,
        feedback: 'Okay',
      }),
    })

    const response = await POST(request as any)

    expect(response.status).toBe(200)
    expect(recordEventOutcome).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: 'pending' })
    )
  })
})
