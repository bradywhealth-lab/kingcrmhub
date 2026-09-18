import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
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

const mockUploadToObjectStorage = vi.hoisted(() => vi.fn())

vi.mock('@/lib/object-storage', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/object-storage')>()
  return {
    ...actual,
    uploadToObjectStorage: mockUploadToObjectStorage,
  }
})

vi.mock('@/lib/request-context', () => ({
  withRequestOrgContext: vi.fn(
    async (
      _request: NextRequest,
      handler: (context: { organizationId: string; userId: string | null }) => Promise<unknown>,
    ) => handler({ organizationId: 'org_1', userId: 'user_1' }),
  ),
}))

import { POST } from './route'
import { ObjectStorageUnavailableError } from '@/lib/object-storage'

// 1x1 transparent PNG — valid, decodable, allowed type. Same class of body
// Sentinel's curl native -F control sent to production (run dac9484f).
const PNG_BYTES = Uint8Array.from(
  Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64',
  ),
)

function makeValidPngRequest(): NextRequest {
  // Well-formed multipart body built with the platform FormData encoder —
  // equivalent to curl's native -F encoder (browser-equivalent shape).
  const form = new FormData()
  form.append('file', new File([PNG_BYTES], 'probe.png', { type: 'image/png' }))
  form.append('name', 'Adjudication PNG')
  form.append('type', 'other')
  return new NextRequest('http://localhost/api/packages/pkg_1/documents', {
    method: 'POST',
    body: form,
  })
}

function makeMalformedBodyRequest(): NextRequest {
  // Non-multipart content type with a body: request.formData() MUST throw.
  // This is the class of probe that produced the four prod log lines
  // "TypeError: Failed to parse body as FormData." (hand-rolled bodies).
  return new NextRequest('http://localhost/api/packages/pkg_1/documents', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ file: 'not-really-a-file' }),
  })
}

const PARAMS = { params: Promise.resolve({ id: 'pkg_1' }) }

beforeEach(() => {
  vi.clearAllMocks()
  // Storage configured so the route's 503 pre-flight does not short-circuit
  // — these tests exercise the post-preflight status mapping. (NODE_ENV is
  // deliberately not stubbed: the production normalization branch lives in
  // uploadToObjectStorage, which is mocked here and covered by
  // object-storage.test.ts instead.)
  process.env.SUPABASE_URL = 'https://example.supabase.co'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key'
  process.env.SUPABASE_STORAGE_BUCKET = 'carrier-documents'
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  delete process.env.SUPABASE_URL
  delete process.env.SUPABASE_SERVICE_ROLE_KEY
  delete process.env.SUPABASE_STORAGE_BUCKET
  vi.restoreAllMocks()
})

describe('POST /api/packages/[id]/documents — adjudication: body parsing vs storage backend (t_2ef8e432)', () => {
  it('returns 400 (not 500) when the multipart body is malformed', async () => {
    // ADJUDICATION branch 1: hand-rolled/malformed bodies made formData()
    // throw and the catch-all returned generic 500 "Failed to upload package
    // document". A client body error must be a 400 with an actionable
    // message — same class PR #180 closed for /api/upload.
    mockDb.servicePackage.findFirst.mockResolvedValue({ id: 'pkg_1', organizationId: 'org_1' })

    const response = await POST(makeMalformedBodyRequest(), PARAMS)

    expect(response.status).toBe(400)
    const json = (await response.json()) as { error?: string }
    expect(json.error).toContain('multipart/form-data')
    expect(mockUploadToObjectStorage).not.toHaveBeenCalled()
    expect(mockDb.packageDocument.create).not.toHaveBeenCalled()
  })

  it('returns 400 (not 500) when the request has an empty body', async () => {
    const response = await POST(
      new NextRequest('http://localhost/api/packages/pkg_1/documents', { method: 'POST' }),
      PARAMS,
    )

    expect(response.status).toBe(400)
    const json = (await response.json()) as { error?: string }
    expect(json.error).toContain('multipart/form-data')
  })

  it('parses a well-formed multipart body (curl -F equivalent) and reaches the storage path', async () => {
    // ADJUDICATION branch 2: a VALID multipart body does NOT throw at
    // formData() — it proceeds past validation into uploadToObjectStorage.
    // In production this is where "Bucket not found" was thrown (21:06:39Z
    // log line, Sentinel run dac9484f). Pin: valid body → storage attempted.
    mockDb.servicePackage.findFirst.mockResolvedValue({ id: 'pkg_1', organizationId: 'org_1' })
    mockUploadToObjectStorage.mockResolvedValueOnce({
      fileUrl: 'https://example.supabase.co/storage/v1/object/public/carrier-documents/p.png',
      storagePath: 'packages/org_1/pkg_1/1-probe.png',
    })
    mockDb.packageDocument.create.mockResolvedValueOnce({
      id: 'doc_1',
      name: 'Adjudication PNG',
      fileUrl: 'https://example.supabase.co/x',
    })

    const response = await POST(makeValidPngRequest(), PARAMS)

    expect(response.status).toBe(200)
    expect(mockUploadToObjectStorage).toHaveBeenCalledTimes(1)
    const uploadArg = mockUploadToObjectStorage.mock.calls[0][0] as {
      organizationId: string
      packageId: string
      originalFileName: string
      contentType: string
    }
    expect(uploadArg.originalFileName).toBe('probe.png')
    expect(uploadArg.contentType).toBe('image/png')
    expect(uploadArg.packageId).toBe('pkg_1')
  })

  it('returns 502 with a safe message when the storage backend fails (bucket missing / permission denied)', async () => {
    // The live production defect: SUPABASE_STORAGE_BUCKET named a bucket that
    // does not exist → Supabase answered "Bucket not found" → generic 500.
    // A backend failure is an upstream-dependency problem: 502 with an
    // actionable message, never a 500 that reads like an app bug, and never
    // echoing raw backend detail to the client.
    mockDb.servicePackage.findFirst.mockResolvedValue({ id: 'pkg_1', organizationId: 'org_1' })
    mockUploadToObjectStorage.mockRejectedValueOnce(
      new ObjectStorageUnavailableError('Bucket not found'),
    )

    const response = await POST(makeValidPngRequest(), PARAMS)

    expect(response.status).toBe(502)
    const json = (await response.json()) as { error?: string }
    expect(json.error).toBeTruthy()
    expect(json.error).not.toContain('Bucket not found')
    expect(mockDb.packageDocument.create).not.toHaveBeenCalled()
  })

  it('still returns 500 for a genuine app bug (non-storage, non-parse throw)', async () => {
    // The 502 mapping must be narrow: only typed storage-backend failures
    // get 502. Anything else keeps the generic 500 so real bugs stay loud.
    mockDb.servicePackage.findFirst.mockResolvedValue({ id: 'pkg_1', organizationId: 'org_1' })
    mockUploadToObjectStorage.mockResolvedValueOnce({
      fileUrl: 'https://example.supabase.co/x',
      storagePath: 'packages/org_1/pkg_1/1-probe.png',
    })
    mockDb.packageDocument.create.mockRejectedValueOnce(new Error('unique constraint violated'))

    const response = await POST(makeValidPngRequest(), PARAMS)

    expect(response.status).toBe(500)
    const json = (await response.json()) as { error?: string }
    expect(json.error).toBe('Failed to upload package document')
  })
})
