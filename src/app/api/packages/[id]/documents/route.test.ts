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

vi.mock('@/lib/db', () => ({
  db: mockDb,
  withOrgRlsTransaction: vi.fn(
    async (_organizationId: string, callback: () => Promise<unknown>) => callback(),
  ),
}))

vi.mock('@/lib/request-context', () => ({
  withRequestOrgContext: vi.fn(
    async (
      _request: NextRequest,
      handler: (context: { organizationId: string; userId: string | null }) => Promise<unknown>,
    ) => handler({ organizationId: 'org_1', userId: 'user_1' }),
  ),
  getOrgContext: vi.fn(async () => ({ organizationId: 'org_1', userId: 'user_1' })),
}))

let nextUploadBuffer: Buffer | null = null
let nextUploadName = ''
let nextDeletedPath: string | null = null

vi.mock('@/lib/object-storage', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/object-storage')>()
  return {
    ...actual,
    uploadToObjectStorage: vi.fn(async (input: { originalFileName: string; buffer: Buffer }) => {
      nextUploadBuffer = input.buffer
      nextUploadName = input.originalFileName
      return { storagePath: 'packages/org_1/pkg_1/test-contract.pdf' }
    }),
    deleteFromObjectStorage: vi.fn(async (storagePath: string) => {
      nextDeletedPath = storagePath
    }),
  }
})

import { POST } from './route'

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
const STORAGE_MESSAGE_FRAGMENT = 'Document storage is not configured'

function setupStorageEnv() {
  process.env.SUPABASE_URL = 'https://test.supabase.co'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key'
  process.env.SUPABASE_STORAGE_BUCKET = 'carrier-documents'
}

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

/**
 * Builds a real, minimal text-bearing PDF with a proper xref so parsers
 * (pdf-parse/pdfjs) definitively extract text from it — M159 regression.
 * Single page, Helvetica font, two drawString-style lines.
 */
function textBearingPdfBytes(): Uint8Array<ArrayBuffer> {
  const lines = [
    'Sentinel parse test contract.',
    'This is a real paragraph of extractable text.',
  ]
  const content = `BT /F1 12 Tf 72 720 Td (${lines.join(' ) Tj 0 -18 Td (')}) Tj ET`
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
  ]
  let pdf = '%PDF-1.4\n'
  const offsets: number[] = [0]
  objects.forEach((obj, i) => {
    offsets.push(Buffer.byteLength(pdf, 'latin1'))
    pdf += `${i + 1} 0 obj\n${obj}\nendobj\n`
  })
  const xrefPos = Buffer.byteLength(pdf, 'latin1')
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  for (let i = 1; i <= objects.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF`
  return new TextEncoder().encode(pdf)
}

function malformedDocxBytes(): Uint8Array<ArrayBuffer> {
  // Not a real zip/DOCX container — parser must not crash the request.
  return new TextEncoder().encode('this-is-not-a-docx-file')
}

beforeEach(() => {
  vi.clearAllMocks()
  nextUploadBuffer = null
  nextUploadName = ''
  nextDeletedPath = null
  // Storage deliberately unconfigured for the degradation tests (audit G6 scenario).
  delete process.env.SUPABASE_URL
  delete process.env.SUPABASE_SERVICE_ROLE_KEY
  delete process.env.SUPABASE_STORAGE_BUCKET
})

describe('POST /api/packages/[id]/documents — auth seam outside the wrapper (t_771f12e9 hoist)', () => {
  it('returns 401 before any DB read or upload when getOrgContext resolves null', async () => {
    setupStorageEnv()
    // The route now implements the 401 seam itself (the hoist replicated
    // withRequestOrgContext's seams explicitly). Pin: null context → 401
    // before the read txn or any storage upload happens.
    const { getOrgContext } = await import('@/lib/request-context')
    const mockGetOrgContext = getOrgContext as ReturnType<typeof vi.fn>
    mockGetOrgContext.mockResolvedValueOnce(null)

    const response = await POST(
      makeRequest('sample.pdf', 'application/pdf', validSmallPdfBytes()),
      { params: Promise.resolve({ id: 'pkg_1' }) },
    )

    expect(response.status).toBe(401)
    expect(mockDb.servicePackage.findFirst).not.toHaveBeenCalled()
    expect(mockDb.packageDocument.create).not.toHaveBeenCalled()
  })
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

describe('POST /api/packages/[id]/documents — text extraction (M159 regression)', () => {
  it('extracts a real text-bearing PDF and stores chunks (chunkCount > 0)', async () => {
    setupStorageEnv()
    mockDb.servicePackage.findFirst.mockResolvedValueOnce({ id: 'pkg_1', organizationId: 'org_1' })
    mockDb.packageDocument.create.mockResolvedValueOnce({
      id: 'doc_1',
      organizationId: 'org_1',
      packageId: 'pkg_1',
      type: 'other',
      name: 'contract.pdf',
      description: null,
      fileUrl: '',
      storagePath: 'packages/org_1/pkg_1/test-contract.pdf',
      fileType: 'application/pdf',
      fileSize: 700,
      version: null,
      extractedText: null,
      indexedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    mockDb.packageDocumentChunk.createMany.mockResolvedValueOnce({ count: 1 })

    const pdfBytes = textBearingPdfBytes()
    const response = await POST(
      makeRequest('contract.pdf', 'application/pdf', pdfBytes),
      { params: Promise.resolve({ id: 'pkg_1' }) },
    )

    expect(response.status).toBe(200)
    const json = (await response.json()) as {
      document: { chunkCount?: number }
    }

    expect(json.document.chunkCount ?? 0).toBeGreaterThan(0)

    // The document row must carry extracted text and an indexedAt timestamp.
    const createArgs = mockDb.packageDocument.create.mock.calls[0]?.[0] as {
      data?: { name?: string; extractedText?: string | null; indexedAt?: Date | null }
    }
    // The route persists the form's name field ('Test document'), not the
    // mocked row's name — assert the create argument, not the mock return.
    expect(createArgs?.data?.name).toBe('Test document')
    const savedText = createArgs?.data?.extractedText ?? ''
    expect(savedText.length).toBeGreaterThan(0)
    expect(savedText).toContain('Sentinel parse test contract.')
    expect(savedText).toContain('This is a real paragraph of extractable text.')
    expect(createArgs?.data?.indexedAt).not.toBeNull()

    // Chunks must be persisted with content derived from the real text.
    expect(mockDb.packageDocumentChunk.createMany).toHaveBeenCalledTimes(1)
    const chunkArgs = mockDb.packageDocumentChunk.createMany.mock.calls[0]?.[0] as {
      data?: { content: string; chunkIndex: number }[]
    }
    expect(chunkArgs?.data?.length ?? 0).toBeGreaterThan(0)
    expect(chunkArgs?.data?.[0]?.content ?? '').toContain('Sentinel parse test contract.')
  })

  it('persists extractedText on the created document for a real text-bearing PDF', async () => {
    setupStorageEnv()
    mockDb.servicePackage.findFirst.mockResolvedValueOnce({ id: 'pkg_1', organizationId: 'org_1' })
    mockDb.packageDocument.create.mockResolvedValueOnce({
      id: 'doc_2',
      organizationId: 'org_1',
      packageId: 'pkg_1',
      type: 'other',
      name: 'contract2.pdf',
      description: null,
      fileUrl: '',
      storagePath: 'packages/org_1/pkg_1/test-contract-2.pdf',
      fileType: 'application/pdf',
      fileSize: 700,
      version: null,
      extractedText: null,
      indexedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    await POST(
      makeRequest('contract2.pdf', 'application/pdf', textBearingPdfBytes()),
      { params: Promise.resolve({ id: 'pkg_1' }) },
    )

    const createArgs = mockDb.packageDocument.create.mock.calls[0]?.[0] as {
      data?: { extractedText?: string | null }
    }
    expect(createArgs?.data?.extractedText).toContain('This is a real paragraph of extractable text.')
  })

  it('uploads the same bytes to object storage that were provided', async () => {
    setupStorageEnv()
    mockDb.servicePackage.findFirst.mockResolvedValueOnce({ id: 'pkg_1', organizationId: 'org_1' })
    mockDb.packageDocument.create.mockResolvedValueOnce({
      id: 'doc_3',
      organizationId: 'org_1',
      packageId: 'pkg_1',
      type: 'other',
      name: 'contract3.pdf',
      description: null,
      fileUrl: '',
      storagePath: 'packages/org_1/pkg_1/test-contract-3.pdf',
      fileType: 'application/pdf',
      fileSize: 700,
      version: null,
      extractedText: null,
      indexedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    mockDb.packageDocumentChunk.createMany.mockResolvedValueOnce({ count: 1 })

    const pdfBytes = textBearingPdfBytes()
    await POST(
      makeRequest('contract3.pdf', 'application/pdf', pdfBytes),
      { params: Promise.resolve({ id: 'pkg_1' }) },
    )

    expect(nextUploadName).toBe('contract3.pdf')
    expect(nextUploadBuffer).not.toBeNull()
    // Byte-for-byte comparison, not just length — same-length corruption
    // would slip past a length-only assertion.
    expect(nextUploadBuffer).toEqual(Buffer.from(pdfBytes))
  })

  it('returns 422 and rolls back the upload when PDF extraction fails (no fake-good 200)', async () => {
    setupStorageEnv()
    mockDb.servicePackage.findFirst.mockResolvedValueOnce({ id: 'pkg_1', organizationId: 'org_1' })

    // Definitely-not-a-PDF bytes: pdfjs throws while parsing, which the
    // route maps to PdfExtractionError → 422 + storage rollback.
    const junk = new TextEncoder().encode('this is definitely not a pdf at all')
    const response = await POST(
      makeRequest('broken.pdf', 'application/pdf', junk),
      { params: Promise.resolve({ id: 'pkg_1' }) },
    )

    expect(response.status).toBe(422)
    const json = (await response.json()) as { error?: string }
    expect(json.error).toContain('Failed to extract text')
    // No document row is persisted for a failed extraction.
    expect(mockDb.packageDocument.create).not.toHaveBeenCalled()
    // The uploaded blob is rolled back so no orphaned object stays behind.
    expect(nextDeletedPath).toBe('packages/org_1/pkg_1/test-contract.pdf')
  })
})

describe('POST /api/packages/[id]/documents — orphan-blob compensation on write txn failure (t_fd623cbf)', () => {
  it('deletes the uploaded storage blob when the write transaction rejects, response stays 500', async () => {
    setupStorageEnv()
    mockDb.servicePackage.findFirst.mockResolvedValueOnce({ id: 'pkg_1', organizationId: 'org_1' })
    mockDb.packageDocument.create.mockResolvedValueOnce({
      id: 'doc_4',
      organizationId: 'org_1',
      packageId: 'pkg_1',
      type: 'other',
      name: 'contract4.pdf',
      description: null,
      fileUrl: '',
      storagePath: 'packages/org_1/pkg_1/test-contract.pdf',
      fileType: 'application/pdf',
      fileSize: 700,
      version: null,
      extractedText: null,
      indexedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    // createMany rejects AFTER create resolved — the atomic write txn aborts
    // (create is rolled back by Prisma), leaving the uploaded blob orphaned
    // unless the route compensates by deleting it from object storage.
    mockDb.packageDocumentChunk.createMany.mockRejectedValueOnce(new Error('transaction aborted'))

    const response = await POST(
      makeRequest('contract4.pdf', 'application/pdf', textBearingPdfBytes()),
      { params: Promise.resolve({ id: 'pkg_1' }) },
    )

    // Status contract unchanged: write failure stays 500 with the same body.
    expect(response.status).toBe(500)
    const json = (await response.json()) as { error?: string }
    expect(json.error).toBe('Failed to upload package document')
    // No document row survives a failed write txn (Prisma rolls back the
    // create when createMany rejects in the same txn)...
    expect(mockDb.packageDocument.create).toHaveBeenCalledTimes(1)
    // ...and the uploaded blob is compensated (deleted), not orphaned.
    expect(nextDeletedPath).toBe('packages/org_1/pkg_1/test-contract.pdf')
  })

  it('stays 500 with the same body when the compensation delete itself rejects', async () => {
    setupStorageEnv()
    mockDb.servicePackage.findFirst.mockResolvedValueOnce({ id: 'pkg_1', organizationId: 'org_1' })
    mockDb.packageDocument.create.mockResolvedValueOnce({
      id: 'doc_5',
      organizationId: 'org_1',
      packageId: 'pkg_1',
      type: 'other',
      name: 'contract5.pdf',
      description: null,
      fileUrl: '',
      storagePath: 'packages/org_1/pkg_1/test-contract.pdf',
      fileType: 'application/pdf',
      fileSize: 700,
      version: null,
      extractedText: null,
      indexedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    mockDb.packageDocumentChunk.createMany.mockRejectedValueOnce(new Error('transaction aborted'))
    // The compensation delete fails too (best-effort): the original WRITE
    // error must still be rethrown — not the delete error, which would
    // otherwise map to a storage 502/503 via objectStorageErrorResponse.
    const { deleteFromObjectStorage } = await import('@/lib/object-storage')
    ;(deleteFromObjectStorage as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('storage delete failed'),
    )
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const response = await POST(
      makeRequest('contract5.pdf', 'application/pdf', textBearingPdfBytes()),
      { params: Promise.resolve({ id: 'pkg_1' }) },
    )
    // Capture before restore: mockRestore() wipes mock.calls history.
    const errorLog = errorSpy.mock.calls.map((args) => args.map((a) => String(a)))
    errorSpy.mockRestore()

    expect(response.status).toBe(500)
    const json = (await response.json()) as { error?: string }
    expect(json.error).toBe('Failed to upload package document')
    // The write rejection (not the swallowed delete failure) is what
    // reaches the outer handler: it is logged as the POST error.
    expect(errorLog.some((args) => args.some((a) => a.includes('transaction aborted')))).toBe(true)
    // The delete failure is logged as a rollback failure, never raised.
    expect(
      errorLog.some((args) => args.some((a) => a.includes('rollback of uploaded object failed'))),
    ).toBe(true)
  })
})
