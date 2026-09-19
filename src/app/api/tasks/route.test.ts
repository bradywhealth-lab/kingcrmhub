import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

/**
 * Regression tests for E15 (full-spectrum FAIL): POST /api/tasks with a
 * whitespace-only title ("   ") returned 201 and CREATED a blank task.
 * Root cause: zod `.min(1)` admits whitespace-only strings; nothing trimmed
 * the title at the API boundary.
 *
 * Defects pinned here:
 *  - E15: spaces-only title → must be 400, nothing persisted.
 *  - Trim: valid " title " → must persist "title" (trimmed).
 *  - Missing title → 400 (existing behavior, regression guard).
 *  - PATCH [id]: same zod admission on update — spaces-only title → 400,
 *    padded title → persisted trimmed.
 *
 * The fake db below records what would have been persisted (create/update),
 * so a regression that trims nothing or persists blanks genuinely fails.
 */

const mockDb = vi.hoisted(() => ({
  task: {
    create: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
    findMany: vi.fn(),
    delete: vi.fn(),
  },
  user: { findFirst: vi.fn() },
  lead: { findFirst: vi.fn() },
  pipelineItem: { findFirst: vi.fn() },
  automation: { findFirst: vi.fn() },
}))

vi.mock('@/lib/db', () => ({ db: mockDb }))

vi.mock('@/lib/request-context', () => ({
  withRequestOrgContext: vi.fn(
    async (
      _request: NextRequest,
      handler: (context: { organizationId: string; userId: string | null }) => Promise<unknown>,
    ) => handler({ organizationId: 'org_1', userId: null }),
  ),
}))

vi.mock('@/lib/rate-limit', () => ({
  enforceRateLimit: vi.fn(() => null),
}))

import { POST } from './route'
import { PATCH } from './[id]/route'

const BASE = 'http://localhost/api/tasks'

async function postBody(body: unknown): Promise<Response> {
  return POST(
    new NextRequest(BASE, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
}

async function patchBody(id: string, body: unknown): Promise<Response> {
  return PATCH(
    new NextRequest(`http://localhost/api/tasks/${id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id }) },
  )
}

describe('POST /api/tasks — whitespace-only title rejected (E15)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDb.task.create.mockImplementation(async (args: { data: Record<string, unknown> }) => ({
      ...args.data,
      id: 'task_1',
      organizationId: 'org_1',
      createdAt: new Date('2026-09-01T00:00:00Z'),
    }))
  })

  it('spaces-only title returns 400 and does NOT persist a task', async () => {
    const response = await postBody({ title: '   ' })
    const json = await response.json()

    expect(response.status).toBe(400)
    expect(json.error).toBe('Invalid request body')
    expect(mockDb.task.create).not.toHaveBeenCalled()
  })

  it('whitespace-only title with tabs/newlines returns 400 and does NOT persist', async () => {
    const response = await postBody({ title: '\t\n \n\t' })
    const json = await response.json()

    expect(response.status).toBe(400)
    expect(json.error).toBe('Invalid request body')
    expect(mockDb.task.create).not.toHaveBeenCalled()
  })

  it('valid title surrounded by spaces is persisted trimmed', async () => {
    const response = await postBody({ title: '  Call the plumber  ' })
    const json = await response.json()

    expect(response.status).toBe(201)
    expect(json.task.title).toBe('Call the plumber')
    const createArgs = mockDb.task.create.mock.calls[0][0] as { data: { title: string } }
    expect(createArgs.data.title).toBe('Call the plumber')
  })

  it('missing title returns 400 (existing validation behavior, regression guard)', async () => {
    const response = await postBody({ status: 'todo' })
    const json = await response.json()

    expect(response.status).toBe(400)
    expect(json.error).toBe('Invalid request body')
    expect(mockDb.task.create).not.toHaveBeenCalled()
  })
})

describe('PATCH /api/tasks/[id] — whitespace-only title rejected (same admission)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDb.task.findFirst.mockResolvedValue({
      id: 'task_1',
      organizationId: 'org_1',
      title: 'Old title',
      status: 'todo',
      completedAt: null,
    })
    mockDb.task.update.mockImplementation(
      async (args: { data: Record<string, unknown> }) => ({
        id: 'task_1',
        organizationId: 'org_1',
        ...args.data,
      }),
    )
  })

  it('spaces-only title returns 400 and does NOT update the task', async () => {
    const response = await patchBody('task_1', { title: '   ' })
    const json = await response.json()

    expect(response.status).toBe(400)
    expect(json.error).toBe('Invalid request body')
    expect(mockDb.task.update).not.toHaveBeenCalled()
  })

  it('padded replacement title is persisted trimmed', async () => {
    const response = await patchBody('task_1', { title: '  Renamed task  ' })
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.task.title).toBe('Renamed task')
    const updateArgs = mockDb.task.update.mock.calls[0][0] as { data: { title: string } }
    expect(updateArgs.data.title).toBe('Renamed task')
  })
})
