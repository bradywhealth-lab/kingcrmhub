import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mockDb = vi.hoisted(() => ({
  pipeline: { findFirst: vi.fn() },
  pipelineItem: { create: vi.fn() },
  lead: { findFirst: vi.fn() },
}))

vi.mock('@/lib/db', () => ({ db: mockDb }))

vi.mock('@/lib/request-context', () => ({
  withRequestOrgContext: vi.fn(
    async (_request: NextRequest, handler: (context: { organizationId: string; userId: string }) => Promise<unknown>) =>
      handler({ organizationId: 'org_1', userId: 'user_1' }),
  ),
}))

vi.mock('@/lib/rate-limit', () => ({
  enforceRateLimit: vi.fn(() => null),
}))

import { POST } from './route'

const STAGES = [
  { id: 'stage_new', name: 'New', probability: 10 },
  { id: 'stage_won', name: 'Won', probability: 100 },
]

function post(body: unknown) {
  return new NextRequest('http://localhost/api/pipeline', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

/**
 * S29 — the Pipeline's only creation CTA could never add a deal because no UI
 * posted to this endpoint. It now does. These tests pin the contract the new
 * dialog depends on, above all: the item lands in the stage the caller chose.
 */
describe('POST /api/pipeline — deal creation (S29)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDb.pipeline.findFirst.mockResolvedValue({ id: 'pipe_1', stages: STAGES })
    mockDb.pipelineItem.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      id: 'item_1',
      ...data,
    }))
  })

  it('creates the deal in the stage the caller chose, not the first stage', async () => {
    const response = await POST(post({ title: 'Acme rollout', stageId: 'stage_won' }))
    expect(response.status).toBe(200)

    const created = mockDb.pipelineItem.create.mock.calls[0][0].data
    expect(created.stageId).toBe('stage_won')
    expect(created.title).toBe('Acme rollout')
    expect(created.pipelineId).toBe('pipe_1')
  })

  it('inherits the chosen stage probability when none is supplied', async () => {
    await POST(post({ title: 'Acme rollout', stageId: 'stage_won' }))
    expect(mockDb.pipelineItem.create.mock.calls[0][0].data.probability).toBe(100)
  })

  it('rejects a deal with no title', async () => {
    const response = await POST(post({ stageId: 'stage_new' }))
    expect(response.status).toBe(400)
    expect(mockDb.pipelineItem.create).not.toHaveBeenCalled()
  })

  it('rejects an unknown stage instead of silently filing it elsewhere', async () => {
    const response = await POST(post({ title: 'Orphan', stageId: 'stage_nope' }))
    expect([400, 404]).toContain(response.status)
    expect(mockDb.pipelineItem.create).not.toHaveBeenCalled()
  })

  it('returns the created item so the board can render it', async () => {
    const response = await POST(post({ title: 'Acme rollout', stageId: 'stage_new', value: 5000 }))
    const payload = await response.json()
    expect(payload).toMatchObject({ id: 'item_1', title: 'Acme rollout', stageId: 'stage_new', value: 5000 })
  })
})