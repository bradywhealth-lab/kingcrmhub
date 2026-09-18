import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { Prisma } from '@prisma/client'

// Regression tests for t_f10ef70d: POST /api/packages with a duplicate name in
// the same org raised Prisma P2002 (unique index [organizationId, slug]) and
// the generic catch returned an opaque 500. It must return 409 with a clear
// message; genuine unexpected errors must stay 500 (PR #184 principle).

const mockDb = vi.hoisted(() => ({
  servicePackage: {
    create: vi.fn(),
  },
}))

const ctx = vi.hoisted(() => ({ organizationId: 'org_1' }))

vi.mock('@/lib/db', () => ({ db: mockDb }))

vi.mock('@/lib/request-context', () => ({
  withRequestOrgContext: vi.fn(
    async (
      _request: NextRequest,
      handler: (context: { organizationId: string; userId: string | null }) => Promise<unknown>,
    ) => handler({ organizationId: ctx.organizationId, userId: 'user_1' }),
  ),
}))

vi.mock('@/lib/rate-limit', () => ({
  enforceRateLimit: vi.fn(() => null),
}))

import { POST } from './route'

function makePost(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/packages', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  })
}

function uniqueViolationError(): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError(
    'Unique constraint failed on the fields: (`organizationId`, `slug`)',
    {
      code: 'P2002',
      clientVersion: '7.7.0',
      meta: { target: ['organizationId', 'slug'] },
    },
  )
}

const DUPLICATE_MESSAGE = 'A service package with that name already exists.'

beforeEach(() => {
  vi.clearAllMocks()
  ctx.organizationId = 'org_1'
})

describe('POST /api/packages — duplicate-name handling (t_f10ef70d)', () => {
  it('returns 409 with a clear message when the same name is created twice in one org', async () => {
    mockDb.servicePackage.create
      .mockResolvedValueOnce({
        id: 'pkg_1',
        organizationId: 'org_1',
        name: 'Monthly Retainer',
        slug: 'monthly-retainer',
      })
      .mockRejectedValueOnce(uniqueViolationError())

    const first = await POST(makePost({ name: 'Monthly Retainer' }))
    expect(first.status).toBe(200)

    const second = await POST(makePost({ name: 'Monthly Retainer' }))
    expect(second.status).toBe(409)
    const json = (await second.json()) as { error?: string }
    expect(json.error).toBe(DUPLICATE_MESSAGE)
  })

  it('returns 409 when an explicit slug collides in the same org', async () => {
    mockDb.servicePackage.create.mockRejectedValueOnce(uniqueViolationError())

    const response = await POST(
      makePost({ name: 'Website Redesign', slug: 'monthly-retainer' }),
    )
    expect(response.status).toBe(409)
    const json = (await response.json()) as { error?: string }
    expect(json.error).toBe(DUPLICATE_MESSAGE)
  })

  it('allows the same name in a DIFFERENT org (unique index is [organizationId, slug])', async () => {
    // org_1 already owns "Monthly Retainer"; org_2 creating it is legal and
    // the route must not pre-reject it.
    ctx.organizationId = 'org_2'
    mockDb.servicePackage.create.mockResolvedValueOnce({
      id: 'pkg_2',
      organizationId: 'org_2',
      name: 'Monthly Retainer',
      slug: 'monthly-retainer',
    })

    const response = await POST(makePost({ name: 'Monthly Retainer' }))
    expect(response.status).toBe(200)
    expect(mockDb.servicePackage.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId: 'org_2',
          slug: 'monthly-retainer',
        }),
      }),
    )
  })

  it('keeps genuine unexpected DB failures as 500 (no blanket 409 mapping)', async () => {
    mockDb.servicePackage.create.mockRejectedValueOnce(
      new Error('connection terminated unexpectedly'),
    )

    const response = await POST(makePost({ name: 'Monthly Retainer' }))
    expect(response.status).toBe(500)
    const json = (await response.json()) as { error?: string }
    expect(json.error).toBe('Failed to create service package')
  })

  it('creates a package on the happy path', async () => {
    const created = {
      id: 'pkg_3',
      organizationId: 'org_1',
      name: 'Brand Audit',
      slug: 'brand-audit',
      logoUrl: null,
      website: null,
      notes: null,
    }
    mockDb.servicePackage.create.mockResolvedValueOnce(created)

    const response = await POST(makePost({ name: 'Brand Audit' }))
    expect(response.status).toBe(200)
    const json = (await response.json()) as { servicePackage?: typeof created }
    expect(json.servicePackage).toEqual(created)
  })
})
