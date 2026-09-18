import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mockUpload = vi.hoisted(() => vi.fn())
const mockRemove = vi.hoisted(() => vi.fn())
const mockGetPublicUrl = vi.hoisted(() => vi.fn())

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    storage: {
      from: () => ({
        upload: mockUpload,
        remove: mockRemove,
        getPublicUrl: mockGetPublicUrl,
      }),
    },
  })),
}))

import {
  ObjectStorageNotConfiguredError,
  ObjectStorageUnavailableError,
  deleteFromObjectStorage,
  uploadToObjectStorage,
} from './object-storage'

const UPLOAD_INPUT = {
  organizationId: 'org_1',
  packageId: 'pkg_1',
  originalFileName: 'sample.png',
  contentType: 'image/png',
  buffer: Buffer.from('png-bytes'),
}

beforeEach(() => {
  vi.clearAllMocks()
  process.env.SUPABASE_URL = 'https://example.supabase.co'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key'
  process.env.SUPABASE_STORAGE_BUCKET = 'carrier-documents'
  // The classification under test is the PRODUCTION path: backend failures
  // must surface as typed errors, never the dev inline fallback.
  vi.stubEnv('NODE_ENV', 'production')
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  delete process.env.SUPABASE_URL
  delete process.env.SUPABASE_SERVICE_ROLE_KEY
  delete process.env.SUPABASE_STORAGE_BUCKET
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('uploadToObjectStorage — backend failure classification (production)', () => {
  it('throws ObjectStorageUnavailableError (not a bare Error) when the bucket does not exist', async () => {
    // Regression t_2ef8e432: prod returned generic 500 "Failed to upload
    // package document" because Supabase answered "Bucket not found" and the
    // route could not distinguish a storage-backend failure from an app bug.
    mockUpload.mockResolvedValueOnce({ data: null, error: { message: 'Bucket not found' } })

    // Single invocation: capture the rejection once and assert both
    // properties on it (cubic PR #184: a second call would consume an
    // exhausted once-mock and exercise a different path).
    const error = await uploadToObjectStorage(UPLOAD_INPUT).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ObjectStorageUnavailableError)
    expect(error).not.toBeInstanceOf(ObjectStorageNotConfiguredError)
  })

  it('throws ObjectStorageUnavailableError when upload succeeds but no public URL is returned', async () => {
    mockUpload.mockResolvedValueOnce({ data: { path: 'p' }, error: null })
    mockGetPublicUrl.mockReturnValueOnce({ data: null })

    await expect(uploadToObjectStorage(UPLOAD_INPUT)).rejects.toBeInstanceOf(
      ObjectStorageUnavailableError,
    )
  })

  it('keeps throwing ObjectStorageNotConfiguredError when env vars are missing', async () => {
    delete process.env.SUPABASE_STORAGE_BUCKET

    await expect(uploadToObjectStorage(UPLOAD_INPUT)).rejects.toBeInstanceOf(
      ObjectStorageNotConfiguredError,
    )
    expect(mockUpload).not.toHaveBeenCalled()
  })

  it('never leaks the raw backend message to callers of the typed error surface used in client responses', async () => {
    // The typed error carries the backend detail for SERVER logs only; routes
    // must respond with their own safe message. Pin that the detail lives on
    // a dedicated field, not baked into anything a route would echo blindly.
    mockUpload.mockResolvedValueOnce({ data: null, error: { message: 'Bucket not found' } })

    try {
      await uploadToObjectStorage(UPLOAD_INPUT)
      expect.unreachable('should have thrown')
    } catch (error) {
      expect(error).toBeInstanceOf(ObjectStorageUnavailableError)
      expect((error as ObjectStorageUnavailableError).causeDetail).toBe('Bucket not found')
    }
  })
})

describe('deleteFromObjectStorage — backend failure classification', () => {
  it('throws ObjectStorageUnavailableError when the backend rejects the delete', async () => {
    mockRemove.mockResolvedValueOnce({ data: null, error: { message: 'Bucket not found' } })

    await expect(deleteFromObjectStorage('packages/org_1/pkg_1/1-file.png')).rejects.toBeInstanceOf(
      ObjectStorageUnavailableError,
    )
  })

  it('throws ObjectStorageUnavailableError when remove() REJECTS (network failure)', async () => {
    // cubic PR #184 P2: a rejecting remove() previously let a generic
    // exception escape → DELETE route answered 500 for a storage outage.
    mockRemove.mockRejectedValueOnce(new TypeError('fetch failed'))

    await expect(deleteFromObjectStorage('packages/org_1/pkg_1/1-file.png')).rejects.toBeInstanceOf(
      ObjectStorageUnavailableError,
    )
  })

  it('keeps throwing ObjectStorageNotConfiguredError when env vars are missing', async () => {
    delete process.env.SUPABASE_URL

    await expect(deleteFromObjectStorage('packages/org_1/pkg_1/1-file.png')).rejects.toBeInstanceOf(
      ObjectStorageNotConfiguredError,
    )
    expect(mockRemove).not.toHaveBeenCalled()
  })
})
