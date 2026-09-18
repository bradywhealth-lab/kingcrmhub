import { describe, expect, it } from 'vitest'
import {
  STORAGE_BACKEND_FAILURE_MESSAGE,
  STORAGE_UNCONFIGURED_MESSAGE,
  objectStorageErrorResponse,
} from './object-storage-http'
import {
  ObjectStorageNotConfiguredError,
  ObjectStorageUnavailableError,
} from './object-storage'

describe('objectStorageErrorResponse — shared storage error → HTTP mapping', () => {
  it('maps ObjectStorageNotConfiguredError to 503 with the shared message', async () => {
    const response = objectStorageErrorResponse(
      new ObjectStorageNotConfiguredError(['SUPABASE_URL']),
    )
    expect(response).not.toBeNull()
    expect(response!.status).toBe(503)
    expect(((await response!.json()) as { error?: string }).error).toBe(STORAGE_UNCONFIGURED_MESSAGE)
  })

  it('maps ObjectStorageUnavailableError to 502 without leaking backend detail', async () => {
    const response = objectStorageErrorResponse(
      new ObjectStorageUnavailableError('Bucket not found'),
    )
    expect(response).not.toBeNull()
    expect(response!.status).toBe(502)
    const json = (await response!.json()) as { error?: string }
    expect(json.error).toBe(STORAGE_BACKEND_FAILURE_MESSAGE)
    expect(json.error).not.toContain('Bucket not found')
  })

  it('returns null for unrelated errors so callers keep their generic 500', () => {
    expect(objectStorageErrorResponse(new Error('unique constraint violated'))).toBeNull()
    expect(objectStorageErrorResponse('not-an-error')).toBeNull()
    expect(objectStorageErrorResponse(undefined)).toBeNull()
  })
})
