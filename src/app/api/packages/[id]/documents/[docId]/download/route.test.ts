import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mockDb = vi.hoisted(() => ({
  packageDocument: {
    findFirst: vi.fn(),
  },
}))

vi.mock('@/lib/db', () => ({ db: mockDb }))

const mockWithRequestOrgContext = vi.hoisted(() => vi.fn())

vi.mock('@/lib/request-context', () => ({
  withRequestOrgContext: mockWithRequestOrgContext,
}))

const mockDownloadFromObjectStorage = vi.hoisted(() => vi.fn())

vi.mock('@/lib/object-storage', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/object-storage')>()
  return {
    ...actual,
    downloadFromObjectStorage: mockDownloadFromObjectStorage,
  }
})

import { GET } from './route'

const PARAMS = { params: Promise.resolve({ id: 'pkg_1', docId: 'doc_1' }) }

function runHandler(handler: (context: { organizationId: string; userId: string | null }) => Promise<unknown>) {
  return handler({ organizationId: 'org_1', userId: 'user_1' })
}

function unauthorizedResponse() {
  return Response.json({ error: 'Unauthorized' }, { status: 401 })
}

beforeEach(() => {
  vi.clearAllMocks()
  mockWithRequestOrgContext.mockImplementation(
    async (
      _request: NextRequest,
      handler: (context: { organizationId: string; userId: string | null }) => Promise<unknown>,
    ) => runHandler(handler),
  )
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('GET /api/packages/[id]/documents/[docId]/download — auth-gated bytes (M173)', () => {
  it('returns 401 when the request has no valid session — no bytes are ever streamed', async () => {
    mockWithRequestOrgContext.mockResolvedValueOnce(unauthorizedResponse())
    mockDb.packageDocument.findFirst.mockResolvedValue({
      id: 'doc_1',
      packageId: 'pkg_1',
      organizationId: 'org_1',
      fileUrl: 'https://example.supabase.co/storage/v1/object/public/carrier-documents/p.png',
      storagePath: 'packages/org_1/pkg_1/1-file.pdf',
      fileType: 'application/pdf',
      name: 'plan.pdf',
    })

    const response = await GET(
      new NextRequest('http://localhost/api/packages/pkg_1/documents/doc_1/download'),
      PARAMS,
    )

    expect(response.status).toBe(401)
    expect(mockDb.packageDocument.findFirst).not.toHaveBeenCalled()
    expect(mockDownloadFromObjectStorage).not.toHaveBeenCalled()
  })

  it('returns 200 with the exact bytes and content type for an authenticated same-tenant download', async () => {
    mockDb.packageDocument.findFirst.mockResolvedValue({
      id: 'doc_1',
      packageId: 'pkg_1',
      organizationId: 'org_1',
      fileUrl: 'https://example.supabase.co/storage/v1/object/public/carrier-documents/p.png',
      storagePath: 'packages/org_1/pkg_1/1-file.pdf',
      fileType: 'application/pdf',
      name: 'plan.pdf',
    })
    mockDownloadFromObjectStorage.mockResolvedValueOnce(Buffer.from('pdf-bytes'))

    const response = await GET(
      new NextRequest('http://localhost/api/packages/pkg_1/documents/doc_1/download'),
      PARAMS,
    )

    expect(response.status).toBe(200)
    expect(Buffer.from(await response.arrayBuffer()).toString()).toBe('pdf-bytes')
    expect(response.headers.get('content-type')).toBe('application/pdf')
    expect(response.headers.get('content-disposition')).toContain('attachment')
    expect(response.headers.get('content-disposition')).toContain('plan.pdf')
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    // The tenant-scoped query pins the caller's organizationId.
    expect(mockDb.packageDocument.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'doc_1',
          packageId: 'pkg_1',
          organizationId: 'org_1',
        }),
      }),
    )
  })

  it('returns 404 for a cross-tenant document — tenant isolation is enforced by the scoped query (M173)', async () => {
    // The row belongs to another organization: the scoped query finds
    // nothing, so the route must 404 exactly like the detail route — never
    // leak existence or bytes across tenants.
    mockDb.packageDocument.findFirst.mockResolvedValueOnce(null)

    const response = await GET(
      new NextRequest('http://localhost/api/packages/pkg_1/documents/doc_1/download'),
      PARAMS,
    )

    expect(response.status).toBe(404)
    expect(mockDownloadFromObjectStorage).not.toHaveBeenCalled()
  })

  it('returns 404 when the document exists but has no server-side bytes', async () => {
    mockDb.packageDocument.findFirst.mockResolvedValue({
      id: 'doc_1',
      packageId: 'pkg_1',
      organizationId: 'org_1',
      fileUrl: 'legacy-value',
      storagePath: null,
      fileType: 'application/pdf',
      name: 'plan.pdf',
    })

    const response = await GET(
      new NextRequest('http://localhost/api/packages/pkg_1/documents/doc_1/download'),
      PARAMS,
    )

    expect(response.status).toBe(404)
    expect((await response.json()) as { error: string }).toEqual({
      error: 'Document bytes are unavailable',
    })
    expect(mockDownloadFromObjectStorage).not.toHaveBeenCalled()
  })

  it('streams inline dev-fallback bytes through the same auth-gated endpoint', async () => {
    mockDb.packageDocument.findFirst.mockResolvedValue({
      id: 'doc_1',
      packageId: 'pkg_1',
      organizationId: 'org_1',
      fileUrl: 'inline:data:image/png;base64,aGVsbG8=',
      storagePath: 'inline:data:image/png;base64,aGVsbG8=',
      fileType: 'application/octet-stream',
      name: 'dev.png',
    })

    const response = await GET(
      new NextRequest('http://localhost/api/packages/pkg_1/documents/doc_1/download'),
      PARAMS,
    )

    expect(response.status).toBe(200)
    expect(Buffer.from(await response.arrayBuffer()).toString()).toBe('hello')
    expect(response.headers.get('content-type')).toBe('image/png')
    expect(mockDownloadFromObjectStorage).not.toHaveBeenCalled()
  })

  it('falls back to the stored fileType when an inline path lacks one', async () => {
    mockDb.packageDocument.findFirst.mockResolvedValue({
      id: 'doc_1',
      packageId: 'pkg_1',
      organizationId: 'org_1',
      fileUrl: 'inline:data:;base64,aGVsbG8=',
      storagePath: 'inline:data:;base64,aGVsbG8=',
      fileType: 'application/pdf',
      name: 'plan.pdf',
    })

    const response = await GET(
      new NextRequest('http://localhost/api/packages/pkg_1/documents/doc_1/download'),
      PARAMS,
    )

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('application/pdf')
  })

  it('streams legacy inline-marker dev-fallback bytes (bytes live in fileUrl, M173)', async () => {
    // Pre-M173 dev fallback rows: storagePath = `inline:<object-path>`
    // marker, fileUrl = the actual data URL.
    mockDb.packageDocument.findFirst.mockResolvedValue({
      id: 'doc_1',
      packageId: 'pkg_1',
      organizationId: 'org_1',
      fileUrl: 'data:image/png;base64,aGVsbG8=',
      storagePath: 'inline:packages/org_1/pkg_1/1-file.pdf',
      fileType: 'application/pdf',
      name: 'dev.png',
    })

    const response = await GET(
      new NextRequest('http://localhost/api/packages/pkg_1/documents/doc_1/download'),
      PARAMS,
    )

    expect(response.status).toBe(200)
    expect(Buffer.from(await response.arrayBuffer()).toString()).toBe('hello')
    expect(response.headers.get('content-type')).toBe('image/png')
    expect(mockDownloadFromObjectStorage).not.toHaveBeenCalled()
  })

  it('percent-encodes supplementary Unicode in filenames without splitting surrogate pairs', async () => {
    // Emoji are outside the BMP: encodeRFC5987 must iterate code points so
    // the surrogate pair is encoded as one entity — splitting it would throw
    // URIError and 500 the download.
    mockDb.packageDocument.findFirst.mockResolvedValue({
      id: 'doc_1',
      packageId: 'pkg_1',
      organizationId: 'org_1',
      fileUrl: 'legacy',
      storagePath: 'packages/org_1/pkg_1/1-emoji.pdf',
      fileType: 'application/pdf',
      name: '计划 📄.pdf',
    })
    mockDownloadFromObjectStorage.mockResolvedValueOnce(Buffer.from('pdf-bytes'))

    const response = await GET(
      new NextRequest('http://localhost/api/packages/pkg_1/documents/doc_1/download'),
      PARAMS,
    )

    expect(response.status).toBe(200)
    const disposition = response.headers.get('content-disposition') || ''
    expect(disposition).toContain("filename*=UTF-8''")
    expect(disposition).toContain(encodeURIComponent('计划 📄.pdf'))
    // The raw emoji must never appear unencoded in the header.
    expect(disposition).not.toContain('📄')
  })

  it('percent-encodes RFC 5987 reserved characters in the filename* value', async () => {
    // RFC 5987 attr-char excludes `'` `(` `)` `*` (and the `%` already used
    // for encoding): those must appear percent-encoded in filename*, or
    // strict clients fall back to the lossy ASCII filename.
    const name = "scope '2026' (final)*.pdf"
    mockDb.packageDocument.findFirst.mockResolvedValue({
      id: 'doc_1',
      packageId: 'pkg_1',
      organizationId: 'org_1',
      fileUrl: 'legacy',
      storagePath: 'packages/org_1/pkg_1/1-reserved.pdf',
      fileType: 'application/pdf',
      name,
    })
    mockDownloadFromObjectStorage.mockResolvedValueOnce(Buffer.from('pdf-bytes'))

    const response = await GET(
      new NextRequest('http://localhost/api/packages/pkg_1/documents/doc_1/download'),
      PARAMS,
    )

    expect(response.status).toBe(200)
    const disposition = response.headers.get('content-disposition') || ''
    // The filename* value must be fully RFC 5987-encoded: every reserved
    // character percent-encoded in that segment, per the standard.
    // scope '2026' (final)*.pdf -> scope%20%272026%27%20%28final%29%2A.pdf
    expect(disposition).toContain("filename*=UTF-8''scope%20%272026%27%20%28final%29%2A.pdf")
    // The marker's own `UTF-8''` delimiter is standard; the NAME portion
    // after it must contain no raw reserved character.
    const nameSegment = disposition.split("UTF-8''")[1] || ''
    expect(nameSegment).not.toContain("'")
    expect(nameSegment).not.toContain('(')
    expect(nameSegment).not.toContain(')')
    expect(nameSegment).not.toContain('*')
    // The ASCII quoted-string fallback keeps a readable approximation for
    // old clients and may legally retain reserved characters.
    expect(disposition).toContain('attachment')
  })

  it('falls back to application/octet-stream when the stored media type is invalid', async () => {
    mockDb.packageDocument.findFirst.mockResolvedValue({
      id: 'doc_1',
      packageId: 'pkg_1',
      organizationId: 'org_1',
      fileUrl: 'data:foo;base64,aGVsbG8=',
      storagePath: 'inline:data:foo;base64,aGVsbG8=',
      fileType: 'invalid media type',
      name: 'legacy.bin',
    })

    const response = await GET(
      new NextRequest('http://localhost/api/packages/pkg_1/documents/doc_1/download'),
      PARAMS,
    )

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('application/octet-stream')
  })

  it('maps a storage not-configured failure to 503 with the safe shared message', async () => {
    mockDb.packageDocument.findFirst.mockResolvedValue({
      id: 'doc_1',
      packageId: 'pkg_1',
      organizationId: 'org_1',
      fileUrl: 'legacy',
      storagePath: 'packages/org_1/pkg_1/1-file.pdf',
      fileType: 'application/pdf',
      name: 'plan.pdf',
    })
    const { ObjectStorageNotConfiguredError } = await import('@/lib/object-storage')
    mockDownloadFromObjectStorage.mockRejectedValueOnce(
      new ObjectStorageNotConfiguredError(['SUPABASE_URL']),
    )

    const response = await GET(
      new NextRequest('http://localhost/api/packages/pkg_1/documents/doc_1/download'),
      PARAMS,
    )

    expect(response.status).toBe(503)
    const json = (await response.json()) as { error?: string }
    expect(json.error).toBeTruthy()
    expect(json.error).not.toContain('SUPABASE_URL')
  })

  it('maps a storage backend failure to 502 with the safe shared message', async () => {
    mockDb.packageDocument.findFirst.mockResolvedValue({
      id: 'doc_1',
      packageId: 'pkg_1',
      organizationId: 'org_1',
      fileUrl: 'legacy',
      storagePath: 'packages/org_1/pkg_1/1-file.pdf',
      fileType: 'application/pdf',
      name: 'plan.pdf',
    })
    const { ObjectStorageUnavailableError } = await import('@/lib/object-storage')
    mockDownloadFromObjectStorage.mockRejectedValueOnce(
      new ObjectStorageUnavailableError('Bucket not found'),
    )

    const response = await GET(
      new NextRequest('http://localhost/api/packages/pkg_1/documents/doc_1/download'),
      PARAMS,
    )

    expect(response.status).toBe(502)
    const json = (await response.json()) as { error?: string }
    expect(json.error).toBeTruthy()
    expect(json.error).not.toContain('Bucket not found')
  })

  it('never leaks a raw public bucket URL in headers or body', async () => {
    mockDb.packageDocument.findFirst.mockResolvedValue({
      id: 'doc_1',
      packageId: 'pkg_1',
      organizationId: 'org_1',
      fileUrl: 'https://example.supabase.co/storage/v1/object/public/carrier-documents/p.png',
      storagePath: 'packages/org_1/pkg_1/1-file.pdf',
      fileType: 'application/pdf',
      name: 'plan.pdf',
    })
    mockDownloadFromObjectStorage.mockResolvedValueOnce(Buffer.from('pdf-bytes'))

    const response = await GET(
      new NextRequest('http://localhost/api/packages/pkg_1/documents/doc_1/download'),
      PARAMS,
    )

    const serialized = [
      ...response.headers.entries(),
      Buffer.from(await response.arrayBuffer()).toString(),
    ].join(' ')
    expect(serialized).not.toContain('supabase.co')
    expect(serialized).not.toContain('/storage/v1/object/public')
  })
})
