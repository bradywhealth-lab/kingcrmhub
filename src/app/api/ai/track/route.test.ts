import { describe, it, expect, beforeEach, vi } from 'vitest'
import { POST } from './route'
import { db } from '@/lib/db'

// Mock db
vi.mock('@/lib/db', () => ({
  db: {
    userAIProfile: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    userLearningEvent: {
      create: vi.fn(),
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
      eventType: 'sms_sent',
      entityType: 'lead',
      entityId: 'lead-1',
      input: { template: 'follow-up-1' },
      output: { smsText: 'Hey, just checking in...' },
      leadProfession: 'Construction',
      sourceType: 'website',
    }}
  }),
}))

describe('/api/ai/track', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should track an AI event successfully', async () => {
    const mockProfile = { id: 'profile-1', userId: 'user-1' }
    const mockEvent = { id: 'event-1', eventType: 'sms_sent' }

    ;(db.userAIProfile.findUnique as any).mockResolvedValue(mockProfile)
    ;(db.userLearningEvent.create as any).mockResolvedValue(mockEvent)
    ;(db.userAIProfile.update as any).mockResolvedValue(mockProfile)

    const request = new Request('http://localhost:3000/api/ai/track', {
      method: 'POST',
      body: JSON.stringify({
        eventType: 'sms_sent',
        entityType: 'lead',
        entityId: 'lead-1',
        input: { template: 'follow-up-1' },
        output: { smsText: 'Hey, just checking in...' },
        leadProfession: 'Construction',
        sourceType: 'website',
      }),
    })

    const response = await POST(request as any)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.event).toBeDefined()
    expect(data.event.id).toBe('event-1')
    expect(db.userLearningEvent.create).toHaveBeenCalled()
  })

  it('should create profile if it does not exist', async () => {
    const mockProfile = { id: 'profile-1', userId: 'user-1' }
    const mockEvent = { id: 'event-1', eventType: 'sms_sent' }

    ;(db.userAIProfile.findUnique as any).mockResolvedValue(null)
    ;(db.userAIProfile.create as any).mockResolvedValue(mockProfile)
    ;(db.userLearningEvent.create as any).mockResolvedValue(mockEvent)
    ;(db.userAIProfile.update as any).mockResolvedValue(mockProfile)

    const request = new Request('http://localhost:3000/api/ai/track', {
      method: 'POST',
      body: JSON.stringify({
        eventType: 'sms_sent',
        entityType: 'lead',
        entityId: 'lead-1',
        input: {},
        output: {},
      }),
    })

    const response = await POST(request as any)

    expect(response.status).toBe(200)
    expect(db.userAIProfile.create).toHaveBeenCalledWith({
      data: { userId: 'test-user' },
    })
  })
})
