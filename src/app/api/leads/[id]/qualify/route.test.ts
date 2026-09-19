import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

/**
 * Regression tests for t_648a0f58 (pitfall-41 class): POST
 * /api/leads/[id]/qualify must `await withRequestOrgContext` so that a
 * rejection from the org-context wrapper (auth/RLS transaction) is converted
 * to a JSON 500 with body instead of escaping the route as an unhandled
 * rejection / opaque empty-body 500. The route now relies on one outer
 * try/catch around the awaited `withRequestOrgContext` call, converting both
 * wrapper and handler rejections into a JSON 500 with body.
 */

const mockDb = vi.hoisted(() => ({
  lead: {
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

import { withRequestOrgContext } from '@/lib/request-context'
import { POST } from './route'

const QUALIFIED = { id: 'lead-1', aiScore: 70, aiConfidence: 0.9, aiNextAction: 'x', aiInsights: {} }

function qualifyLead(id = 'lead-1') {
  return POST(new NextRequest(`http://localhost/api/leads/${id}/qualify`, { method: 'POST' }), {
    params: Promise.resolve({ id }),
  }) as Promise<Response>
}

describe('POST /api/leads/[id]/qualify — awaited org-context wrapper (t_648a0f58)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDb.lead.findUnique.mockResolvedValue({
      id: 'lead-1',
      email: 'ada@analytical.io',
      phone: '+15550101',
      company: 'Analytical Engines',
      title: 'CEO',
      firstName: 'Ada',
      lastName: 'Lovelace',
      source: 'referral',
      profession: null,
      status: 'new',
      engagementScore: 5,
      totalInteractions: 4,
    } as never)
    mockDb.lead.update.mockResolvedValue({
      id: 'lead-1',
      aiScore: 70,
      aiConfidence: 0.9,
      aiNextAction: 'x',
      aiInsights: {},
    } as never)
    mockDb.activity.create.mockResolvedValue({ id: 'act-1' } as never)
  })

  it('qualifies a lead owned by the organization', async () => {
    const response = await qualifyLead()
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.lead.id).toBe('lead-1')
    expect(mockDb.lead.update).toHaveBeenCalledTimes(1)
    expect(mockDb.activity.create).toHaveBeenCalledTimes(1)
  })

  it('404s when the lead is not found in the organization', async () => {
    mockDb.lead.findUnique.mockResolvedValue(null)

    const response = await qualifyLead()

    expect(response.status).toBe(404)
    expect(await response.json()).toMatchObject({ error: 'Lead not found' })
    expect(mockDb.lead.update).not.toHaveBeenCalled()
  })

  it('(regression) org-context wrapper rejection returns JSON 500 with body', async () => {
    vi.mocked(withRequestOrgContext).mockRejectedValueOnce(new Error('boom'))

    const response = await qualifyLead()
    const text = await response.text()
    const json = JSON.parse(text)

    expect(response.status).toBe(500)
    expect(json.error).toBe('Failed to qualify lead')
    expect(text.length).toBeGreaterThan(0)
  })

  it('(regression) handler DB rejection returns JSON 500 with body', async () => {
    mockDb.lead.update.mockRejectedValueOnce(new Error('boom'))

    const response = await qualifyLead()
    const text = await response.text()
    const json = JSON.parse(text)

    expect(response.status).toBe(500)
    expect(json.error).toBe('Failed to qualify lead')
    expect(text.length).toBeGreaterThan(0)
  })
})
