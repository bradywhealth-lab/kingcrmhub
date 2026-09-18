import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mockDb = vi.hoisted(() => ({
  servicePackage: {
    findFirst: vi.fn(),
  },
  packageDocument: {
    create: vi.fn(),
  },
  packageDocumentChunk: {
    createMany: vi.fn(),
  },
}))

vi.mock('@/lib/db', () => ({ db: mockDb }))

vi.mock('@/lib/request-context', () => ({
  withRequestOrgContext: vi.fn(
    async (
      _request: NextRequest,
      handler: (context: { organizationId: string; userId: string | null }) => Promise<unknown>,
    ) => handler({ organizationId: 'org_1', userId: 'user_1' }),
  ),
}))

import { POST } from './route'

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
const STORAGE_MESSAGE_FRAGMENT = 'Document storage is not configured'

function makeRequest(fileName: string, mimeType: string, contents: Uint8Array<ArrayBuffer>): NextRequest {
  const form = new FormData()
  form.append('file', new File([contents], fileName, { type: mimeType }))
  form.append('name', 'Test document')
  return new NextRequest('http://localhost/api/packages/pkg_1/documents', {
    method: 'POST',
    body: form,
  })
}

function validSmallPdfBytes(): Uint8Array<ArrayBuffer> {
  // Minimal, structurally valid single-page PDF.
  const pdf = [
    '%PDF-1.4',
    '1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj',
    '2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj',
    '3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj',
    'trailer<</Root 1 0 R>>',
    '%%EOF',
  ].join('\n')
  return new TextEncoder().encode(pdf)
}

function malformedDocxBytes(): Uint8Array<ArrayBuffer> {
  // Not a real zip/DOCX container — parser must not crash the request.
  return new TextEncoder().encode('this-is-not-a-docx-file')
}

beforeEach(() => {
  vi.clearAllMocks()
  // Storage deliberately unconfigured (audit G6 scenario).
  delete process.env.SUPABASE_URL
  delete process.env.SUPABASE_SERVICE_ROLE_KEY
  delete process.env.SUPABASE_STORAGE_BUCKET
})

describe('POST /api/packages/[id]/documents — storage unconfigured degradation', () => {
  it('returns 503 with a clear message (not 500) for a valid small PDF when SUPABASE_URL is unset', async () => {
    mockDb.servicePackage.findFirst.mockResolvedValueOnce({ id: 'pkg_1', organizationId: 'org_1' })

    const response = await POST(
      makeRequest('sample.pdf', 'application/pdf', validSmallPdfBytes()),
      { params: Promise.resolve({ id: 'pkg_1' }) },
    )

    expect(response.status).toBe(503)
    const json = (await response.json()) as { error?: string }
    expect(json.error).toContain(STORAGE_MESSAGE_FRAGMENT)
    expect(mockDb.packageDocument.create).not.toHaveBeenCalled()
  })

  it('returns 503 with a clear message (not 500) for a malformed DOCX when SUPABASE_URL is unset', async () => {
    mockDb.servicePackage.findFirst.mockResolvedValueOnce({ id: 'pkg_1', organizationId: 'org_1' })

    const response = await POST(makeRequest('broken.docx', DOCX_MIME, malformedDocxBytes()), {
      params: Promise.resolve({ id: 'pkg_1' }),
    })

    expect(response.status).toBe(503)
    const json = (await response.json()) as { error?: string }
    expect(json.error).toContain(STORAGE_MESSAGE_FRAGMENT)
    expect(mockDb.packageDocument.create).not.toHaveBeenCalled()
  })

  it('returns 503 when only SUPABASE_URL is unset but other storage vars are present', async () => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = '***'
    process.env.SUPABASE_STORAGE_BUCKET = 'documents'
    mockDb.servicePackage.findFirst.mockResolvedValueOnce({ id: 'pkg_1', organizationId: 'org_1' })

    const response = await POST(
      makeRequest('sample.pdf', 'application/pdf', validSmallPdfBytes()),
      { params: Promise.resolve({ id: 'pkg_1' }) },
    )

    expect(response.status).toBe(503)
    const json = (await response.json()) as { error?: string }
    expect(json.error).toContain(STORAGE_MESSAGE_FRAGMENT)

    delete process.env.SUPABASE_SERVICE_ROLE_KEY
    delete process.env.SUPABASE_STORAGE_BUCKET
  })

  it('keeps 400 validation ahead of the storage check (unsupported file type)', async () => {
    const response = await POST(
      makeRequest('virus.exe', 'application/octet-stream', new Uint8Array(new ArrayBuffer(3))),
      { params: Promise.resolve({ id: 'pkg_1' }) },
    )

    expect(response.status).toBe(400)
  })

  it('keeps 404 ahead of the storage check (package not found)', async () => {
    mockDb.servicePackage.findFirst.mockResolvedValueOnce(null)

    const response = await POST(
      makeRequest('sample.pdf', 'application/pdf', validSmallPdfBytes()),
      { params: Promise.resolve({ id: 'pkg_missing' }) },
    )

    expect(response.status).toBe(404)
  })
})
