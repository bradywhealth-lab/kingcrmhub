import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mockDb = vi.hoisted(() => ({
  organization: {
    findUnique: vi.fn(),
  },
}))

vi.mock('@/lib/db', () => ({ db: mockDb }))

vi.mock('@/lib/request-context', () => ({
  withRequestOrgContext: vi.fn(
    async (_request: NextRequest, handler: (context: { organizationId: string; userId: string }) => Promise<unknown>) =>
      handler({ organizationId: 'org_1', userId: 'user_1' }),
  ),
}))

vi.mock('@/lib/ai-providers', () => ({
  getDefaultModel: vi.fn(() => 'default-model'),
}))

import { GET } from './route'

describe('/api/settings/ai', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('labels Groq as Standard even when the organization has its own key', async () => {
    mockDb.organization.findUnique.mockResolvedValueOnce({
      settings: { aiProvider: 'groq', aiApiKey: 'gsk_1234567890' },
    })

    const response = await GET(new NextRequest('http://localhost/api/settings/ai'))
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.providerLabel).toBe('Standard — included')
  })

  it('keeps Advanced labeling for other providers with a key', async () => {
    mockDb.organization.findUnique.mockResolvedValueOnce({
      settings: { aiProvider: 'openai', aiApiKey: 'sk_1234567890' },
    })

    const response = await GET(new NextRequest('http://localhost/api/settings/ai'))
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.providerLabel).toBe('Advanced — bring your own key')
  })
})
