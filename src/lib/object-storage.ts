import { createClient } from '@supabase/supabase-js'

/** Env vars that must all be present for object storage to work. */
const OBJECT_STORAGE_ENV_VARS = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_STORAGE_BUCKET',
] as const

/**
 * Thrown when Supabase storage is not configured (missing env vars).
 * Callers should translate this into a 503 with an actionable message —
 * never an unhandled 500 — mirroring the missing-AI-key degradation pattern.
 */
export class ObjectStorageNotConfiguredError extends Error {
  readonly missingEnvVars: string[]

  constructor(missingEnvVars: string[]) {
    super(`Document storage is not configured (missing env vars: ${missingEnvVars.join(', ')})`)
    this.name = 'ObjectStorageNotConfiguredError'
    this.missingEnvVars = missingEnvVars
  }
}

/**
 * Thrown when storage IS configured but the backend rejects the operation
 * (bucket missing, permission denied, no public URL returned, network
 * failure). Callers should translate this into a 502 with a safe,
 * actionable message — never a generic 500 that reads like an app bug,
 * and never echoing `causeDetail` to the client (server logs only).
 * Regression t_2ef8e432: prod bucket "carrier-documents" did not exist,
 * Supabase answered "Bucket not found", and clients got an opaque 500.
 */
export class ObjectStorageUnavailableError extends Error {
  readonly causeDetail: string

  constructor(causeDetail: string, options?: ErrorOptions) {
    super(`Object storage backend failure: ${causeDetail}`, options)
    this.name = 'ObjectStorageUnavailableError'
    this.causeDetail = causeDetail
  }
}

/** Names of required object-storage env vars that are unset or blank. */
export function findMissingObjectStorageEnv(): string[] {
  return OBJECT_STORAGE_ENV_VARS.filter((name) => !process.env[name]?.trim())
}

/** True when every required object-storage env var is present. */
export function isObjectStorageConfigured(): boolean {
  return findMissingObjectStorageEnv().length === 0
}

function getRequiredEnv(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) {
    throw new Error(`Missing required object storage env var: ${name}`)
  }
  return value
}

function getStorageClient() {
  const supabaseUrl = getRequiredEnv('SUPABASE_URL')
  const serviceRoleKey = getRequiredEnv('SUPABASE_SERVICE_ROLE_KEY')

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

const INLINE_STORAGE_PREFIX = 'inline:'

/** True when a storage path refers to inline dev-fallback storage. */
export function isInlineStoragePath(storagePath: string): boolean {
  return storagePath.startsWith(INLINE_STORAGE_PREFIX)
}

/**
 * Decodes a base64 data URL back to its original bytes and content type.
 * Returns null when the value is not a data URL.
 */
export function parseDataUrl(
  dataUrl: string,
): { contentType: string; buffer: Buffer } | null {
  const match = /^data:([^;,]+)?;base64,(.+)$/.exec(dataUrl)
  if (!match) return null
  return {
    contentType: match[1] ?? '',
    buffer: Buffer.from(match[2], 'base64'),
  }
}

/**
 * Decodes an inline dev-fallback storage path (prefix + data URL) back to
 * its original bytes and content type. Returns null for non-inline paths
 * (including the legacy `inline:<object-path>` marker form, whose bytes
 * live in the row's fileUrl — the download route handles that case).
 * The download route uses this to stream dev-fallback uploads through the
 * same auth-gated endpoint as real object-storage files.
 */
export function parseInlineStoragePath(
  storagePath: string,
): { contentType: string; buffer: Buffer } | null {
  if (!isInlineStoragePath(storagePath)) return null
  return parseDataUrl(storagePath.slice(INLINE_STORAGE_PREFIX.length))
}

function buildInlineFallbackStoragePath(contentType: string, buffer: Buffer): string {
  return `inline:data:${contentType || 'application/octet-stream'};base64,${buffer.toString('base64')}`
}

export async function uploadToObjectStorage(input: {
  organizationId: string
  carrierId?: string
  packageId?: string
  originalFileName: string
  contentType: string
  buffer: Buffer
}): Promise<{ storagePath: string }> {
  const missingEnv = findMissingObjectStorageEnv()
  if (missingEnv.length > 0) {
    throw new ObjectStorageNotConfiguredError(missingEnv)
  }
  const id = input.packageId || input.carrierId || 'unknown'
  const bucket = getRequiredEnv('SUPABASE_STORAGE_BUCKET')
  const safeFileName = input.originalFileName.replace(/[^a-zA-Z0-9._-]/g, '_')
  const storagePath = `packages/${input.organizationId}/${id}/${Date.now()}-${safeFileName}`
  try {
    const client = getStorageClient()

    const uploadResult = await client.storage.from(bucket).upload(storagePath, input.buffer, {
      contentType: input.contentType || 'application/octet-stream',
      upsert: false,
    })

    if (uploadResult.error) {
      throw new ObjectStorageUnavailableError(uploadResult.error.message)
    }

    return {
      storagePath,
    }
  } catch (error) {
    if (process.env.NODE_ENV === 'production') {
      // Everything inside this try is a storage-backend call: any failure
      // here is an upstream dependency problem, so normalize to the typed
      // error callers map to 502 (a generic Error would surface as a 500
      // that reads like an app bug — regression t_2ef8e432). The original
      // error is threaded through as `cause` so its stack stays in logs.
      throw error instanceof ObjectStorageUnavailableError
        ? error
        : new ObjectStorageUnavailableError(
            error instanceof Error ? error.message : String(error),
            { cause: error },
          )
    }
    if (input.buffer.length > 1_000_000) {
      throw new Error('Object storage is unavailable and the file is too large for local fallback storage')
    }
    console.error('Object storage unavailable, using inline dev fallback:', error)
    return {
      storagePath: buildInlineFallbackStoragePath(input.contentType, input.buffer),
    }
  }
}

/**
 * Reads the object's bytes from object storage for an auth-gated download
 * route. M173: downloads are proxied server-side so files in a private
 * bucket are never exposed through raw public URLs — clients receive
 * bytes only through the tenant-checked endpoint.
 */
export async function downloadFromObjectStorage(storagePath: string): Promise<Buffer> {
  if (isInlineStoragePath(storagePath)) {
    throw new Error(`Cannot download an inline fallback path through object storage: ${storagePath}`)
  }
  const missingEnv = findMissingObjectStorageEnv()
  if (missingEnv.length > 0) {
    throw new ObjectStorageNotConfiguredError(missingEnv)
  }
  const bucket = getRequiredEnv('SUPABASE_STORAGE_BUCKET')
  try {
    const client = getStorageClient()
    const downloadResult = await client.storage.from(bucket).download(storagePath)
    if (downloadResult.error) {
      throw new ObjectStorageUnavailableError(downloadResult.error.message)
    }
    if (!downloadResult.data) {
      throw new ObjectStorageUnavailableError('download succeeded but returned no data')
    }
    return Buffer.from(await downloadResult.data.arrayBuffer())
  } catch (error) {
    // Normalize rejects AND typed-throw exits to the typed error so routes
    // map every storage outage to 502 (same contract as delete).
    throw error instanceof ObjectStorageUnavailableError
      ? error
      : new ObjectStorageUnavailableError(
          error instanceof Error ? error.message : String(error),
          { cause: error },
        )
  }
}

export async function deleteFromObjectStorage(storagePath: string): Promise<void> {
  if (isInlineStoragePath(storagePath)) return
  const missingEnv = findMissingObjectStorageEnv()
  if (missingEnv.length > 0) {
    throw new ObjectStorageNotConfiguredError(missingEnv)
  }
  const bucket = getRequiredEnv('SUPABASE_STORAGE_BUCKET')
  try {
    const client = getStorageClient()
    const removeResult = await client.storage.from(bucket).remove([storagePath])
    if (removeResult.error) {
      throw new ObjectStorageUnavailableError(removeResult.error.message)
    }
  } catch (error) {
    // Normalize rejects (network failure, client construction) AND error
    // objects to the typed error so routes map every storage outage to 502
    // (cubic PR #184 P2: an escaping generic Error surfaced as a 500).
    // The original error rides along as `cause` for operator diagnostics.
    throw error instanceof ObjectStorageUnavailableError
      ? error
      : new ObjectStorageUnavailableError(
          error instanceof Error ? error.message : String(error),
          { cause: error },
        )
  }
}
