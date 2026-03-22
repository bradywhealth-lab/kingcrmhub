import { describe, it, expect, beforeEach, vi } from 'vitest'
import { POST } from './route'
import { trackAIEvent } from '@/lib/ai-tracking'

vi.mock('@/lib/ai-tracking', () => ({
  trackAIEvent: vi.fn(),
}))

// Mock request context
vi.mock('@/lib/request-context', () => ({
  withRequestOrgContext: vi.fn((_, fn) => fn({ userId: 'test-user', organizationId: 'org-audit-fixture' })),
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
    ;(trackAIEvent as any).mockResolvedValue({
      eventId: 'event-1',
      pineconeId: 'pc-1',
    })

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
    expect(data.event.pineconeId).toBe('pc-1')
    expect(trackAIEvent).toHaveBeenCalledWith(
      'test-user',
      'sms_sent',
      'lead',
      'lead-1',
      { template: 'follow-up-1' },
      { smsText: 'Hey, just checking in...' },
      {
        leadProfession: 'Construction',
        sourceType: 'website',
      }
    )
  })

  it('should create profile if it does not exist', async () => {
    ;(trackAIEvent as any).mockResolvedValue({
      eventId: 'event-2',
    })

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
    expect(trackAIEvent).toHaveBeenCalledWith(
      'test-user',
      'sms_sent',
      'lead',
      'lead-1',
      { template: 'follow-up-1' },
      { smsText: 'Hey, just checking in...' },
      {
        leadProfession: 'Construction',
        sourceType: 'website',
      }
    )
  })
})
