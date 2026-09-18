import { describe, it, expect, beforeEach, vi } from 'vitest'
import { POST } from './route'

// Mock db — validation tests must never reach the database. If a 4xx test
// passes BECAUSE db.create threw, these spies would record the call.
vi.mock('@/lib/db', () => ({
  db: {
    cSVUpload: {
      create: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    lead: {
      findMany: vi.fn(),
      createMany: vi.fn(),
    },
  },
}))

// Mock request context — models an authenticated user so the handler runs
// past auth and the body-validation path under test is reached.
vi.mock('@/lib/request-context', () => ({
  withRequestOrgContext: vi.fn(async (_request, handler) =>
    handler({ userId: 'test-user', organizationId: 'org-upload-fixture' }),
  ),
}))

// Mock rate limit — not the subject of these tests.
vi.mock('@/lib/rate-limit', () => ({
  enforceRateLimit: vi.fn(() => null),
}))

const { db } = await import('@/lib/db')

describe('/api/upload POST body validation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 400 (not 500) when the body is empty', async () => {
    // Regression: Sentinel audit defect 3 — an empty body made
    // request.formData() throw inside the handler and the catch-all
    // returned 500 "Failed to import CSV upload".
    const request = new Request('http://localhost:3000/api/upload', {
      method: 'POST',
    }) as never

    const response = await POST(request as never)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBeTruthy()
    expect(db.cSVUpload.create).not.toHaveBeenCalled()
  })

  it('returns 400 when the multipart body has no file field', async () => {
    const formData = new FormData()
    formData.set('source', 'csv_upload')

    const request = new Request('http://localhost:3000/api/upload', {
      method: 'POST',
      body: formData,
    }) as never

    const response = await POST(request as never)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toContain('file is required')
    expect(db.cSVUpload.create).not.toHaveBeenCalled()
  })

  it('returns 400 when the body is not multipart form data', async () => {
    const request = new Request('http://localhost:3000/api/upload', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ file: 'not-really-a-file' }),
    }) as never

    const response = await POST(request as never)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBeTruthy()
    expect(db.cSVUpload.create).not.toHaveBeenCalled()
  })
})
