import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mockUpload = vi.hoisted(() => vi.fn())
const mockRemove = vi.hoisted(() => vi.fn())
const mockDownload = vi.hoisted(() => vi.fn())

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    storage: {
      from: () => ({
        upload: mockUpload,
        remove: mockRemove,
        download: mockDownload,
      }),
    },
  })),
}))

import {
  ObjectStorageNotConfiguredError,
  ObjectStorageUnavailableError,
  deleteFromObjectStorage,
  downloadFromObjectStorage,
  isInlineStoragePath,
  parseDataUrl,
  parseInlineStoragePath,
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

  it('returns only the storage path on success — no public URL is ever generated (M173)', async () => {
    // M173: upload must never hand a public-URL string to callers. The
    // download path is a server-side, auth-gated proxy; storagePath alone
    // is sufficient for delete and download.
    const uploadArg = { ...UPLOAD_INPUT, buffer: Buffer.from('png-bytes') }
    mockUpload.mockResolvedValueOnce({ data: { path: 'ignored' }, error: null })

    const result = await uploadToObjectStorage(uploadArg)

    expect(result.storagePath).toMatch(/^packages\/org_1\/pkg_1\/\d+-sample\.png$/)
    expect(Object.hasOwn(result, 'fileUrl')).toBe(false)
    expect(mockUpload).toHaveBeenCalledTimes(1)
  })

  it('keeps throwing ObjectStorageNotConfiguredError when env vars are missing', async () => {
    delete process.env.SUPABASE_STORAGE_BUCKET

    await expect(uploadToObjectStorage(UPLOAD_INPUT)).rejects.toBeInstanceOf(
      ObjectStorageNotConfiguredError,
    )
    expect(mockUpload).not.toHaveBeenCalled()
  })

  it('preserves the original rejection as `cause` on the UPLOAD normalization path too', async () => {
    // cubic PR #184 round 3 P3: uploadToObjectStorage has the same
    // normalization as deleteFromObjectStorage — pin cause identity there
    // as well so neither site can regress to message-only copying.
    const original = new TypeError('fetch failed')
    mockUpload.mockRejectedValueOnce(original)

    const error = await uploadToObjectStorage(UPLOAD_INPUT).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ObjectStorageUnavailableError)
    expect((error as Error & { cause?: unknown }).cause).toBe(original)
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

describe('downloadFromObjectStorage — auth-gated byte retrieval (M173)', () => {
  it('returns the Blob bytes as a Buffer for a valid download', async () => {
    const blob = new Blob(['pdf-bytes'], { type: 'application/pdf' })
    mockDownload.mockResolvedValueOnce({ data: blob, error: null })

    const buffer = await downloadFromObjectStorage('packages/org_1/pkg_1/1-file.pdf')

    expect(buffer.toString()).toBe('pdf-bytes')
    expect(mockDownload).toHaveBeenCalledWith('packages/org_1/pkg_1/1-file.pdf')
  })

  it('throws ObjectStorageUnavailableError when the backend rejects the download', async () => {
    mockDownload.mockResolvedValueOnce({ data: null, error: { message: 'Bucket not found' } })

    const error = await downloadFromObjectStorage('packages/org_1/pkg_1/1-file.pdf').catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ObjectStorageUnavailableError)
    // Mirror the upload suite: the raw backend message must thread through
    // as causeDetail so ops can diagnose the backend without the client
    // ever seeing it.
    expect((error as ObjectStorageUnavailableError).causeDetail).toBe('Bucket not found')
  })

  it('throws ObjectStorageUnavailableError when download returns no data', async () => {
    mockDownload.mockResolvedValueOnce({ data: null, error: null })

    const error = await downloadFromObjectStorage('packages/org_1/pkg_1/1-file.pdf').catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ObjectStorageUnavailableError)
    expect((error as ObjectStorageUnavailableError).causeDetail).toBe(
      'download succeeded but returned no data',
    )
  })

  it('normalizes network rejections to ObjectStorageUnavailableError with cause preserved', async () => {
    const original = new TypeError('fetch failed')
    mockDownload.mockRejectedValueOnce(original)

    const error = await downloadFromObjectStorage('packages/org_1/pkg_1/1-file.pdf').catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ObjectStorageUnavailableError)
    expect((error as Error & { cause?: unknown }).cause).toBe(original)
  })

  it('keeps throwing ObjectStorageNotConfiguredError when env vars are missing', async () => {
    delete process.env.SUPABASE_URL

    await expect(downloadFromObjectStorage('packages/org_1/pkg_1/1-file.pdf')).rejects.toBeInstanceOf(
      ObjectStorageNotConfiguredError,
    )
    expect(mockDownload).not.toHaveBeenCalled()
  })

  it('refuses inline fallback paths — they are streamed by the route, not object storage', async () => {
    mockDownload.mockResolvedValueOnce({ data: new Blob(['x']), error: null })

    await expect(
      downloadFromObjectStorage('inline:data:image/png;base64,aGVsbG8='),
    ).rejects.toThrow(/inline fallback path/i)
    expect(mockDownload).not.toHaveBeenCalled()
  })
})

describe('inline dev-fallback storage helpers (M173)', () => {
  it('classifies and decodes inline storage paths', () => {
    const path = 'inline:data:image/png;base64,aGVsbG8='
    expect(isInlineStoragePath(path)).toBe(true)
    const parsed = parseInlineStoragePath(path)
    expect(parsed).not.toBeNull()
    expect(parsed?.contentType).toBe('image/png')
    expect(parsed?.buffer.toString()).toBe('hello')
  })

  it('returns null for real object-storage paths and malformed inline paths', () => {
    expect(parseInlineStoragePath('packages/org_1/pkg_1/1-file.pdf')).toBeNull()
    expect(parseInlineStoragePath('inline:not-a-data-url')).toBeNull()
    expect(isInlineStoragePath('packages/org_1/pkg_1/1-file.pdf')).toBe(false)
  })

  it('decodes a plain data URL via parseDataUrl (legacy inline marker rows keep bytes in fileUrl)', () => {
    const url = 'data:image/png;base64,aGVsbG8='
    const parsed = parseDataUrl(url)
    expect(parsed).not.toBeNull()
    expect(parsed?.contentType).toBe('image/png')
    expect(parsed?.buffer.toString()).toBe('hello')
    expect(parseDataUrl('not-a-data-url')).toBeNull()
  })

  it('classifies the legacy inline marker form separately from current inline paths', () => {
    // Legacy dev-fallback rows stored `inline:<object-path>` in storagePath
    // and the data URL in fileUrl. The marker is still inline (so the
    // download route handles it) but has no parseable data URL itself.
    expect(isInlineStoragePath('inline:packages/org_1/pkg_1/1-file.pdf')).toBe(true)
    expect(parseInlineStoragePath('inline:packages/org_1/pkg_1/1-file.pdf')).toBeNull()
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

  it('preserves the original rejection as `cause` for operator diagnostics', async () => {
    // cubic PR #184 round 2 P3: normalization must not discard the original
    // error — its stack (e.g. inside supabase-js fetch) stays logged.
    const original = new TypeError('fetch failed')
    mockRemove.mockRejectedValueOnce(original)

    const error = await deleteFromObjectStorage('packages/org_1/pkg_1/1-file.png').catch(
      (e: unknown) => e,
    )
    expect(error).toBeInstanceOf(ObjectStorageUnavailableError)
    expect((error as Error & { cause?: unknown }).cause).toBe(original)
  })

  it('keeps throwing ObjectStorageNotConfiguredError when env vars are missing', async () => {
    delete process.env.SUPABASE_URL

    await expect(deleteFromObjectStorage('packages/org_1/pkg_1/1-file.png')).rejects.toBeInstanceOf(
      ObjectStorageNotConfiguredError,
    )
    expect(mockRemove).not.toHaveBeenCalled()
  })
})
