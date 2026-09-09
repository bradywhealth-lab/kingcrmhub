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
    async (_request: NextRequest, handler: (context: { organizationId: string }) => Promise<unknown>) =>
      handler({ organizationId: 'org_1' }),
  ),
}))

import { GET } from './route'

describe('/api/prompts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('omits Pro and Studio bodies for a Free organization', async () => {
    mockDb.organization.findUnique.mockResolvedValueOnce({ plan: 'free' })

    const response = await GET(new NextRequest('http://localhost/api/prompts'))
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.prompts).toHaveLength(22)
    expect(json.prompts.filter((prompt: { body?: string }) => prompt.body)).toHaveLength(6)
    expect(
      json.prompts
        .filter((prompt: { plan: string }) => prompt.plan !== 'free')
        .every((prompt: { body?: string }) => !Object.hasOwn(prompt, 'body')),
    ).toBe(true)
  })

  it('returns paid bodies only when the organization plan unlocks them', async () => {
    mockDb.organization.findUnique.mockResolvedValueOnce({ plan: 'pro' })

    const response = await GET(new NextRequest('http://localhost/api/prompts'))
    const json = await response.json()

    expect(json.prompts.filter((prompt: { body?: string }) => prompt.body)).toHaveLength(16)
    expect(
      json.prompts
        .filter((prompt: { plan: string }) => prompt.plan === 'studio')
        .every((prompt: { body?: string }) => !Object.hasOwn(prompt, 'body')),
    ).toBe(true)
  })
})
