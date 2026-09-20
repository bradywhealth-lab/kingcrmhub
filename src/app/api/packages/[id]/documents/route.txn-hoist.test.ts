import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

// t_771f12e9 acceptance: uploadToObjectStorage + extractPackageText (network
// upload + cold pdf-parse, which on a fresh container exceeds Prisma's
// 5000ms interactive-txn timeout) MUST run OUTSIDE the org-scoped RLS
// transactions. Only DB reads/writes belong inside withOrgRlsTransaction.
//
// Route shape after the hoist (status ordering preserved from the current
// contract — see route.test.ts / route.adjudication.test.ts):
//   auth/CSRF → parse/validate (400) → read txn { findFirst → 404 }
//   → storage env check (503) → upload → extract → write txn
//   { create + createMany } → 200
//
// These tests observe the order of real route calls. On the OLD code the
// route ran EVERYTHING inside withRequestOrgContext's hidden transaction
// and never invoked withOrgRlsTransaction itself, so every order assertion
// fails RED.

const eventLog = vi.hoisted(() => [] as string[])
const pdfInstances = vi.hoisted(() => ({ created: 0 }))

const mockDb = vi.hoisted(() => ({
  servicePackage: {
    findFirst: vi.fn(async () => {
      eventLog.push('findFirst')
      return { id: 'pkg_1', organizationId: 'org_1' }
    }),
  },
  packageDocument: {
    create: vi.fn(async () => {
      eventLog.push('create')
      return { id: 'doc_1', packageId: 'pkg_1', fileUrl: '' }
    }),
  },
  packageDocumentChunk: {
    createMany: vi.fn(async () => {
      eventLog.push('createMany')
      return { count: 1 }
    }),
  },
}))

const mockUploadToObjectStorage = vi.hoisted(() =>
  vi.fn(async () => {
    eventLog.push('upload')
    return { storagePath: 'packages/org_1/pkg_1/1-test.pdf' }
  }),
)

const mockGetOrgContext = vi.hoisted(() =>
  vi.fn(async () => ({ organizationId: 'org_1', userId: 'user_1' })),
)

const mockWithOrgRlsTransaction = vi.hoisted(() =>
  vi.fn(async (_organizationId: string, callback: () => Promise<unknown>) => {
    // Close marker per cubic R1 (thread 2): asserting on open-only events
    // would let a stretched read txn (findFirst, upload, parse inside the
    // first callback) pass as "hoisted", because its log is byte-identical
    // to the correct order without a close boundary.
    eventLog.push('txnOpen')
    const result = await callback()
    eventLog.push('txnClose')
    return result
  }),
)

vi.mock('@/lib/db', () => ({
  db: mockDb,
  withOrgRlsTransaction: mockWithOrgRlsTransaction,
}))

vi.mock('@/lib/object-storage', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/object-storage')>()
  return {
    ...actual,
    uploadToObjectStorage: mockUploadToObjectStorage,
  }
})

vi.mock('@/lib/request-context', () => ({
  // Auth/CSRF wiring is covered by request-context.test.ts and the other
  // route suites. This suite observes the route's OWN scoping decisions:
  // does it call withOrgRlsTransaction itself, and in what order relative
  // to upload/parse? The wrapper is a pass-through so both old (no direct
  // txn call) and new (explicit txn calls) routes run against the observer.
  withRequestOrgContext: vi.fn(
    async (
      _request: NextRequest,
      handler: (context: { organizationId: string; userId: string | null }) => Promise<unknown>,
    ) => handler({ organizationId: 'org_1', userId: 'user_1' }),
  ),
  getOrgContext: mockGetOrgContext,
}))

// Cold pdf-parse simulation: PDFParse constructor + getText record the
// parse step in eventLog. The real module's JIT/worker spawn is what blew
// past 5000ms on first upload after deploy — the test pins that this work
// happens BEFORE the write transaction opens.
vi.mock('pdf-parse', () => ({
  PDFParse: class {
    data: Uint8Array
    constructor(data: { data: Uint8Array }) {
      this.data = data.data
      pdfInstances.created += 1
    }
    async getText() {
      eventLog.push('parse')
      return { text: 'Hello world test document text' }
    }
    async destroy() {}
  },
}))

import { POST } from './route'

function makePdfRequest(): NextRequest {
  const form = new FormData()
  form.append(
    'file',
    new File([new TextEncoder().encode('%PDF-1.4\n%%EOF')], 'test.pdf', {
      type: 'application/pdf',
    }),
  )
  form.append('name', 'Txn hoist test')
  form.append('type', 'other')
  return new NextRequest('http://localhost/api/packages/pkg_1/documents', {
    method: 'POST',
    body: form,
  })
}

const PARAMS = { params: Promise.resolve({ id: 'pkg_1' }) }

/**
 * Boundary predicate shared by the order tests and the regression guard
 * (cubic R1 thread 2): slow work (upload, parse) must fall strictly
 * between the read transaction's CLOSE and the write transaction's OPEN.
 * Open-only markers cannot express this — a read txn stretched to include
 * upload+parse produces a log byte-identical to the correct order.
 */
function uploadAndParseOutsideTxns(log: string[]): boolean {
  const readClose = log.indexOf('txnClose')
  const writeOpen = log.lastIndexOf('txnOpen')
  return (
    readClose >= 0 &&
    writeOpen > readClose &&
    log.indexOf('upload') > readClose &&
    log.indexOf('upload') < writeOpen &&
    log.indexOf('parse') > readClose &&
    log.indexOf('parse') < writeOpen
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  eventLog.length = 0
  pdfInstances.created = 0
  // Re-arm the hoisted default implementations. clearAllMocks() clears
  // calls/results but KEEPS implementations (it never resets them); the
  // re-arm below exists to guard against a future mockReset() swap, which
  // would wipe every hoisted implementation in one call.
  mockDb.servicePackage.findFirst.mockImplementation(async () => {
    eventLog.push('findFirst')
    return { id: 'pkg_1', organizationId: 'org_1' }
  })
  mockDb.packageDocument.create.mockImplementation(async () => {
    eventLog.push('create')
    return { id: 'doc_1', packageId: 'pkg_1', fileUrl: '' }
  })
  mockDb.packageDocumentChunk.createMany.mockImplementation(async () => {
    eventLog.push('createMany')
    return { count: 1 }
  })
  mockUploadToObjectStorage.mockImplementation(async () => {
    eventLog.push('upload')
    return { storagePath: 'packages/org_1/pkg_1/1-test.pdf' }
  })
  mockGetOrgContext.mockImplementation(async () => ({
    organizationId: 'org_1',
    userId: 'user_1',
  }))
  mockWithOrgRlsTransaction.mockImplementation(
    async (_organizationId: string, callback: () => Promise<unknown>) => {
      eventLog.push('txnOpen')
      const result = await callback()
      eventLog.push('txnClose')
      return result
    },
  )
  process.env.SUPABASE_URL = 'https://example.supabase.co'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key'
  process.env.SUPABASE_STORAGE_BUCKET = 'carrier-documents'
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('POST /api/packages/[id]/documents — RLS txn hoist (t_771f12e9)', () => {
  it('runs the storage upload BEFORE the write transaction opens', async () => {
    const response = await POST(makePdfRequest(), PARAMS)

    expect(response.status).toBe(200)
    // upload must fall between the read txn's close and the write txn's
    // open — never inside either txn.
    expect(uploadAndParseOutsideTxns(eventLog)).toBe(true)
  })

  it('runs the pdf text extraction BEFORE the write transaction opens', async () => {
    const response = await POST(makePdfRequest(), PARAMS)

    expect(response.status).toBe(200)
    expect(pdfInstances.created).toBe(1)
    // parse (cold pdfjs JIT/worker spawn — the work the hoist exists to
    // keep outside the 5000ms interactive txn) must also fall between the
    // read close and write open.
    expect(uploadAndParseOutsideTxns(eventLog)).toBe(true)
  })

  it('REGRESSION GUARD: a read txn stretched to include upload+parse is rejected by the boundary assertions', () => {
    // The exact log the defect would produce with open-only markers is
    // byte-identical to the correct hoisted order:
    //   txnOpen findFirst upload parse txnOpen create createMany
    // With close markers, the stretched sequence violates the boundary and
    // the shared predicate must reject it — otherwise the suite would go
    // green while slow work runs inside a transaction.
    const stretched: string[] = [
      'txnOpen',
      'findFirst',
      'upload',
      'parse',
      'txnOpen',
      'create',
      'createMany',
    ]
    const hoisted: string[] = [
      'txnOpen',
      'findFirst',
      'txnClose',
      'upload',
      'parse',
      'txnOpen',
      'create',
      'createMany',
      'txnClose',
    ]
    expect(uploadAndParseOutsideTxns(stretched)).toBe(false)
    expect(uploadAndParseOutsideTxns(hoisted)).toBe(true)
  })

  it('returns 401 before any transaction or upload when getOrgContext resolves null (auth seam preserved outside the wrapper)', async () => {
    mockGetOrgContext.mockResolvedValueOnce(null)

    const response = await POST(makePdfRequest(), PARAMS)

    expect(response.status).toBe(401)
    expect(mockWithOrgRlsTransaction).not.toHaveBeenCalled()
    expect(mockUploadToObjectStorage).not.toHaveBeenCalled()
    expect(eventLog).not.toContain('txnOpen')
  })

  it('keeps the package 404 read inside the first org txn and writes inside the second (all DB calls scoped)', async () => {
    const response = await POST(makePdfRequest(), PARAMS)

    expect(response.status).toBe(200)
    const readOpen = eventLog.indexOf('txnOpen')
    const readClose = eventLog.indexOf('txnClose')
    const writeOpen = eventLog.lastIndexOf('txnOpen')
    // findFirst (the 404 read) is inside the first scoped txn — between its
    // open and close markers.
    expect(eventLog.indexOf('findFirst')).toBeGreaterThan(readOpen)
    expect(eventLog.indexOf('findFirst')).toBeLessThan(readClose)
    // create + createMany happen inside the second scoped txn — after its
    // open, before its close.
    const createAt = eventLog.indexOf('create')
    expect(createAt).toBeGreaterThan(writeOpen)
    expect(createAt).toBeLessThan(eventLog.lastIndexOf('txnClose'))
    expect(eventLog.indexOf('createMany')).toBeGreaterThan(createAt)
    expect(mockWithOrgRlsTransaction).toHaveBeenCalledTimes(2)
    expect(mockWithOrgRlsTransaction.mock.calls[0][0]).toBe('org_1')
    expect(mockWithOrgRlsTransaction.mock.calls[1][0]).toBe('org_1')
  })

  it('returns 500 on createMany rejection with both writes inside the same write txn (atomic rollback — no orphan row)', async () => {
    mockDb.packageDocumentChunk.createMany.mockImplementationOnce(async () => {
      eventLog.push('createMany')
      throw new Error('createMany failed in txn')
    })

    const response = await POST(makePdfRequest(), PARAMS)

    expect(response.status).toBe(500)
    // Both writes were attempted inside ONE transaction — a rejection there
    // rolls the whole txn back, so no orphan document row is left behind.
    const writeOpen = eventLog.lastIndexOf('txnOpen')
    expect(writeOpen).toBeGreaterThan(eventLog.indexOf('txnOpen'))
    expect(eventLog.indexOf('create')).toBeGreaterThan(writeOpen)
    expect(eventLog.indexOf('createMany')).toBeGreaterThan(writeOpen)
    expect(mockWithOrgRlsTransaction).toHaveBeenCalledTimes(2)
    // The rejection propagates before the write txn's close marker is
    // reached — only the read txn ever closes.
    expect(eventLog.filter((e) => e === 'txnClose').length).toBe(1)
  })

  it('maps a storage-backend failure to 502 and never opens the write transaction', async () => {
    // Typed storage error — same contract as the adjudication suite: the
    // real uploadToObjectStorage normalizes backend failures to this type.
    const { ObjectStorageUnavailableError } = await import('@/lib/object-storage')
    mockUploadToObjectStorage.mockRejectedValueOnce(
      new ObjectStorageUnavailableError('Bucket not found'),
    )

    const response = await POST(makePdfRequest(), PARAMS)

    expect(response.status).toBe(502)
    expect(eventLog.indexOf('create')).toBe(-1)
    // Only the read txn (findFirst / 404) may have opened — the write txn
    // must never start when the upload failed: one open and one close pair.
    expect(eventLog.filter((e) => e === 'txnOpen').length).toBe(1)
    expect(eventLog.filter((e) => e === 'txnClose').length).toBe(1)
  })

  it('blocks cross-site POST with 403 before any upload or transaction (CSRF preserved outside the wrapper)', async () => {
    const form = new FormData()
    form.append(
      'file',
      new File([new TextEncoder().encode('%PDF-1.4\n%%EOF')], 'test.pdf', {
        type: 'application/pdf',
      }),
    )
    const request = new NextRequest('http://localhost/api/packages/pkg_1/documents', {
      method: 'POST',
      body: form,
      headers: { origin: 'https://evil.example' },
    })

    const response = await POST(request, PARAMS)

    expect(response.status).toBe(403)
    expect(mockUploadToObjectStorage).not.toHaveBeenCalled()
    expect(eventLog).not.toContain('txnOpen')
  })
})
