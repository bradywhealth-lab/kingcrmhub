import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { Prisma } from '@prisma/client'

// Regression tests for t_f10ef70d (bug-class audit item): PATCH
// /api/packages/[id] can set an explicit slug that collides with another
// package in the same org (unique index [organizationId, slug]). The generic
// catch returned 500; it must return 409 with a clear message, while genuine
// unexpected errors stay 500.

const mockDb = vi.hoisted(() => ({
  servicePackage: {
    findFirst: vi.fn(),
    update: vi.fn(),
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

import { GET, PATCH } from './route'

function makePatch(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/packages/pkg_1', {
    method: 'PATCH',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  })
}

const params = { params: Promise.resolve({ id: 'pkg_1' }) }

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

const DUPLICATE_SLUG_MESSAGE = 'A service package with that slug already exists.'

beforeEach(() => {
  vi.clearAllMocks()
  ctx.organizationId = 'org_1'
  mockDb.servicePackage.findFirst.mockResolvedValue({
    id: 'pkg_1',
    organizationId: 'org_1',
    name: 'Monthly Retainer',
    slug: 'monthly-retainer',
  })
})

describe('GET /api/packages/[id] — nested documents never leak raw fileUrl (M173)', () => {
  it('serializes nested package documents with gated download paths', async () => {
    mockDb.servicePackage.findFirst.mockResolvedValue({
      id: 'pkg_1',
      organizationId: 'org_1',
      name: 'Monthly Retainer',
      slug: 'monthly-retainer',
      packageDocuments: [
        {
          id: 'doc_1',
          packageId: 'pkg_1',
          organizationId: 'org_1',
          type: 'brochure',
          name: 'scope.pdf',
          fileUrl: 'https://example.supabase.co/storage/v1/object/public/carrier-documents/old.png',
          storagePath: 'packages/org_1/pkg_1/1-scope.pdf',
          fileType: 'application/pdf',
          fileSize: 1024,
          version: null,
          extractedText: 'secret',
          createdAt: new Date('2026-09-19T00:00:00Z'),
          updatedAt: new Date('2026-09-19T00:00:00Z'),
        },
      ],
    })

    const response = await GET(
      new NextRequest('http://localhost/api/packages/pkg_1'),
      params,
    )

    expect(response.status).toBe(200)
    const json = (await response.json()) as { servicePackage?: any }
    const [nested] = json.servicePackage?.packageDocuments ?? []
    expect(nested.fileUrl).toBe('/api/packages/pkg_1/documents/doc_1/download')
    expect(nested.fileUrl.startsWith('http')).toBe(false)
    expect(JSON.stringify(json)).not.toContain('supabase.co')
    expect(JSON.stringify(json)).not.toContain('/storage/v1/object/public')
  })
})

describe('PATCH /api/packages/[id] — duplicate-slug handling (t_f10ef70d)', () => {
  it('returns 409 with a clear message when the new slug collides in the same org', async () => {
    mockDb.servicePackage.update.mockRejectedValueOnce(uniqueViolationError())

    const response = await PATCH(makePatch({ slug: 'brand-audit' }), params)
    expect(response.status).toBe(409)
    const json = (await response.json()) as { error?: string }
    expect(json.error).toBe(DUPLICATE_SLUG_MESSAGE)
  })

  it('keeps genuine unexpected DB failures as 500 (no blanket 409 mapping)', async () => {
    mockDb.servicePackage.update.mockRejectedValueOnce(
      new Error('connection terminated unexpectedly'),
    )

    const response = await PATCH(makePatch({ name: 'Renamed' }), params)
    expect(response.status).toBe(500)
    const json = (await response.json()) as { error?: string }
    expect(json.error).toBe('Failed to update service package')
  })

  it('updates a package on the happy path', async () => {
    const updated = {
      id: 'pkg_1',
      organizationId: 'org_1',
      name: 'Monthly Retainer (2026)',
      slug: 'monthly-retainer',
    }
    mockDb.servicePackage.update.mockResolvedValueOnce(updated)

    const response = await PATCH(makePatch({ name: 'Monthly Retainer (2026)' }), params)
    expect(response.status).toBe(200)
    const json = (await response.json()) as { servicePackage?: typeof updated }
    expect(json.servicePackage).toEqual(updated)
  })
})
