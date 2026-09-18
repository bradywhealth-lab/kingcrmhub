import { NextResponse } from 'next/server'
import {
  ObjectStorageNotConfiguredError,
  ObjectStorageUnavailableError,
} from './object-storage'

/**
 * Shared client-facing messages for object-storage failures. Both package
 * document routes must use these (cubic PR #184: per-route constants
 * drifted apart — 'uploads' vs 'management' — and duplicated mapping logic
 * invites further drift).
 */
export const STORAGE_UNCONFIGURED_MESSAGE =
  'Document storage is not configured. Document management is unavailable until an administrator configures storage.'
export const STORAGE_BACKEND_FAILURE_MESSAGE =
  'Document storage is temporarily unavailable. Please try again later or contact support.'

/**
 * Maps typed object-storage errors to their HTTP response:
 * - ObjectStorageNotConfiguredError  -> 503 (env not set; admin action needed)
 * - ObjectStorageUnavailableError    -> 502 (backend rejected the call: bucket
 *   missing, permission denied, network. Safe message only — causeDetail
 *   belongs in server logs, never in client responses.)
 * Returns null for anything else so callers fall through to their own
 * generic 500 and real app bugs stay loud.
 */
export function objectStorageErrorResponse(error: unknown): NextResponse | null {
  if (error instanceof ObjectStorageNotConfiguredError) {
    return NextResponse.json({ error: STORAGE_UNCONFIGURED_MESSAGE }, { status: 503 })
  }
  if (error instanceof ObjectStorageUnavailableError) {
    return NextResponse.json({ error: STORAGE_BACKEND_FAILURE_MESSAGE }, { status: 502 })
  }
  return null
}
