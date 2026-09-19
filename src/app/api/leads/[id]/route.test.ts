import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

/**
 * Regression tests for t_648a0f58 (pitfall-41 class): PATCH /api/leads/[id]
 * must `await withRequestOrgContext` inside its try/catch so that a rejection
 * from the org-context wrapper (auth/RLS transaction) or from the handler DB
 * work returns a JSON 500 with body instead of escaping the route and
 * surfacing as an opaque empty-body 500 / unhandled rejection.
 */

const mockDb = vi.hoisted(() => ({
  lead: {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  activity: {
    create: vi.fn(),
  },
}))

vi.mock('@/lib/db', () => ({
  db: mockDb,
}))

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

import { withRequestOrgContext } from '@/lib/request-context'
import { PATCH } from './route'

const EXISTING_LEAD = { id: 'lead-1', organizationId: 'org_1', status: 'new' }

function patchLead(body: unknown, id = 'lead-1') {
  return PATCH(
    new NextRequest(`http://localhost/api/leads/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
      headers: { 'content-type': 'application/json' },
    }),
    { params: Promise.resolve({ id }) },
  ) as Promise<Response>
}

describe('PATCH /api/leads/[id] — awaited org-context wrapper (t_648a0f58)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDb.lead.findFirst.mockResolvedValue(EXISTING_LEAD)
    mockDb.lead.update.mockResolvedValue({ id: 'lead-1', firstName: 'Ada' })
  })

  it('updates a lead owned by the organization', async () => {
    const response = await patchLead({ firstName: 'Ada' })
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.lead.firstName).toBe('Ada')
    expect(mockDb.lead.update).toHaveBeenCalledTimes(1)
  })

  it('404s when the lead is not in the organization', async () => {
    mockDb.lead.findFirst.mockResolvedValue(null)

    const response = await patchLead({ firstName: 'Ada' })

    expect(response.status).toBe(404)
    expect(await response.json()).toMatchObject({ error: 'Lead not found' })
    expect(mockDb.lead.update).not.toHaveBeenCalled()
  })

  it('(regression) org-context wrapper rejection returns JSON 500, never an opaque empty body', async () => {
    vi.mocked(withRequestOrgContext).mockRejectedValueOnce(new Error('boom'))

    const response = await patchLead({ firstName: 'Ada' })
    const text = await response.text()
    const json = JSON.parse(text)

    expect(response.status).toBe(500)
    expect(json.error).toBe('Failed to update lead')
    expect(text.length).toBeGreaterThan(0)
  })

  it('(regression) handler DB rejection returns JSON 500 with body', async () => {
    mockDb.lead.update.mockRejectedValueOnce(new Error('boom'))

    const response = await patchLead({ firstName: 'Ada' })
    const text = await response.text()
    const json = JSON.parse(text)

    expect(response.status).toBe(500)
    expect(json.error).toBe('Failed to update lead')
    expect(text.length).toBeGreaterThan(0)
  })
})
