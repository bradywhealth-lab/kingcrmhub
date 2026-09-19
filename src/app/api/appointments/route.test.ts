import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

/**
 * Regression tests for the E15 twin on appointments: POST /api/appointments
 * and PATCH /api/appointments/[id] with a whitespace-only title ("   ")
 * returned 201/200 because zod `.min(1)` admits whitespace-only strings;
 * nothing trimmed the title at the API boundary.
 *
 * Defects pinned here:
 *  - spaces-only title → must be 400, nothing persisted (POST and PATCH).
 *  - tabs/newlines-only title → must be 400, nothing persisted.
 *  - Trim: padded " title " → must persist "title" (trimmed).
 *  - Missing title → 400 (existing behavior, regression guard).
 *
 * The fake db below records what would have been persisted (create/update),
 * so a regression that trims nothing or persists blanks genuinely fails.
 */

const mockDb = vi.hoisted(() => ({
  appointment: {
    create: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
    findMany: vi.fn(),
    delete: vi.fn(),
  },
  lead: { findFirst: vi.fn() },
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

import { POST } from './route'
import { PATCH } from './[id]/route'

const BASE = 'http://localhost/api/appointments'

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
    new NextRequest(`http://localhost/api/appointments/${id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id }) },
  )
}

describe('POST /api/appointments — whitespace-only title rejected (E15 twin)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDb.appointment.create.mockImplementation(async (args: { data: Record<string, unknown> }) => ({
      ...args.data,
      id: 'appointment_1',
      organizationId: 'org_1',
      createdAt: new Date('2026-09-01T00:00:00Z'),
    }))
  })

  it('spaces-only title returns 400 and does NOT persist an appointment', async () => {
    const response = await postBody({
      title: '   ',
      startTime: '2026-10-01T10:00:00Z',
      endTime: '2026-10-01T11:00:00Z',
    })
    const json = await response.json()

    expect(response.status).toBe(400)
    expect(json.error).toBe('Invalid request body')
    expect(mockDb.appointment.create).not.toHaveBeenCalled()
  })

  it('whitespace-only title with tabs/newlines returns 400 and does NOT persist', async () => {
    const response = await postBody({
      title: '\t\n \n\t',
      startTime: '2026-10-01T10:00:00Z',
      endTime: '2026-10-01T11:00:00Z',
    })
    const json = await response.json()

    expect(response.status).toBe(400)
    expect(json.error).toBe('Invalid request body')
    expect(mockDb.appointment.create).not.toHaveBeenCalled()
  })

  it('valid title surrounded by spaces is persisted trimmed', async () => {
    const response = await postBody({
      title: '  Quarterly review  ',
      startTime: '2026-10-01T10:00:00Z',
      endTime: '2026-10-01T11:00:00Z',
    })
    const json = await response.json()

    expect(response.status).toBe(201)
    expect(json.appointment.title).toBe('Quarterly review')
    const createArgs = mockDb.appointment.create.mock.calls[0][0] as { data: { title: string } }
    expect(createArgs.data.title).toBe('Quarterly review')
  })

  it('missing title returns 400 (existing validation behavior, regression guard)', async () => {
    const response = await postBody({
      startTime: '2026-10-01T10:00:00Z',
      endTime: '2026-10-01T11:00:00Z',
    })
    const json = await response.json()

    expect(response.status).toBe(400)
    expect(json.error).toBe('Invalid request body')
    expect(mockDb.appointment.create).not.toHaveBeenCalled()
  })
})

describe('PATCH /api/appointments/[id] — whitespace-only title rejected (same admission)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDb.appointment.findFirst.mockResolvedValue({
      id: 'appointment_1',
      organizationId: 'org_1',
      title: 'Old title',
      startTime: new Date('2026-10-01T10:00:00Z'),
      endTime: new Date('2026-10-01T11:00:00Z'),
    })
    mockDb.appointment.update.mockImplementation(
      async (args: { data: Record<string, unknown> }) => ({
        id: 'appointment_1',
        organizationId: 'org_1',
        ...args.data,
      }),
    )
  })

  it('spaces-only title returns 400 and does NOT update the appointment', async () => {
    const response = await patchBody('appointment_1', { title: '   ' })
    const json = await response.json()

    expect(response.status).toBe(400)
    expect(json.error).toBe('Invalid request body')
    expect(mockDb.appointment.update).not.toHaveBeenCalled()
  })

  it('tabs/newlines-only title returns 400 and does NOT update the appointment', async () => {
    const response = await patchBody('appointment_1', { title: '\t\n \n\t' })
    const json = await response.json()

    expect(response.status).toBe(400)
    expect(json.error).toBe('Invalid request body')
    expect(mockDb.appointment.update).not.toHaveBeenCalled()
  })

  it('padded replacement title is persisted trimmed', async () => {
    const response = await patchBody('appointment_1', { title: '  Renamed appointment  ' })
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.appointment.title).toBe('Renamed appointment')
    const updateArgs = mockDb.appointment.update.mock.calls[0][0] as { data: { title: string } }
    expect(updateArgs.data.title).toBe('Renamed appointment')
  })
})
