import { describe, it, expect, beforeEach, vi } from 'vitest'
import { POST } from './route'
import { NextRequest } from 'next/server'

// Mock dependencies
vi.mock('@/lib/db', () => ({
  db: {
    userLearningEvent: {
      findMany: vi.fn(),
    },
    userAIProfile: {
      update: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
  },
}))

import { db } from '@/lib/db'

describe('POST /api/cron/extract-patterns', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Set CRON_SECRET for tests
    process.env.CRON_SECRET = 'test-secret-key'
  })

  it('should return 401 without CRON_SECRET', async () => {
    // Remove CRON_SECRET
    delete process.env.CRON_SECRET

    const request = new NextRequest('http://localhost:3000/api/cron/extract-patterns', {
      method: 'POST'
    }) as any

    const response = await POST(request)
    expect(response.status).toBe(401)
  })

  it('should return 401 with wrong CRON_SECRET', async () => {
    const request = new NextRequest('http://localhost:3000/api/cron/extract-patterns', {
      method: 'POST',
      headers: {
        'x-cron-secret': 'wrong-secret'
      }
    }) as any

    const response = await POST(request)
    expect(response.status).toBe(401)
  })

  it('should return 401 without x-cron-secret header', async () => {
    const request = new NextRequest('http://localhost:3000/api/cron/extract-patterns', {
      method: 'POST'
    }) as any

    const response = await POST(request)
    expect(response.status).toBe(401)
  })

  it('should extract patterns when CRON_SECRET is valid', async () => {
    // Mock successful events
    vi.mocked(db.userLearningEvent.findMany).mockResolvedValue([
      {
        id: 'event-1',
        eventType: 'email_sent',
        entityId: 'lead-1',
        outcome: 'success',
        createdAt: new Date(),
        userProfile: {
          user: {
            id: 'user-1',
            organizationId: 'org-1'
          }
        }
      }
    ] as any)

    vi.mocked(db.userAIProfile.update).mockResolvedValue({} as any)

    const request = new NextRequest('http://localhost:3000/api/cron/extract-patterns', {
      method: 'POST',
      headers: {
        'x-cron-secret': 'test-secret-key'
      }
    }) as any

    const response = await POST(request)
    expect(response.status).toBe(200)

    const data = await response.json()
    expect(data).toHaveProperty('success', true)
    expect(data).toHaveProperty('processed')
  })

  it('should handle empty events gracefully', async () => {
    vi.mocked(db.userLearningEvent.findMany).mockResolvedValue([])

    const request = new NextRequest('http://localhost:3000/api/cron/extract-patterns', {
      method: 'POST',
      headers: {
        'x-cron-secret': 'test-secret-key'
      }
    }) as any

    const response = await POST(request)
    expect(response.status).toBe(200)

    const data = await response.json()
    expect(data).toHaveProperty('success', true)
  })

  it('should group events by user and update profiles', async () => {
    const mockEvents = [
      {
        id: 'event-1',
        eventType: 'email_sent',
        entityId: 'lead-1',
        outcome: 'success',
        output: { content: 'Test email content' },
        leadProfession: 'Contractor',
        sourceType: 'zillow',
        createdAt: new Date(),
        userProfile: {
          user: {
            id: 'user-1',
            organizationId: 'org-1'
          }
        }
      },
      {
        id: 'event-2',
        eventType: 'sms_sent',
        entityId: 'lead-2',
        outcome: 'success',
        output: { message: 'Test SMS' },
        leadProfession: 'Contractor',
        sourceType: 'zillow',
        createdAt: new Date(),
        userProfile: {
          user: {
            id: 'user-1',
            organizationId: 'org-1'
          }
        }
      }
    ]

    vi.mocked(db.userLearningEvent.findMany).mockResolvedValue(mockEvents as any)
    vi.mocked(db.userAIProfile.update).mockResolvedValue({} as any)

    const request = new NextRequest('http://localhost:3000/api/cron/extract-patterns', {
      method: 'POST',
      headers: {
        'x-cron-secret': 'test-secret-key'
      }
    }) as any

    const response = await POST(request)
    expect(response.status).toBe(200)

    // Should have called update once for user-1
    expect(db.userAIProfile.update).toHaveBeenCalled()
  })
})
