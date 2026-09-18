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

  constructor(causeDetail: string) {
    super(`Object storage backend failure: ${causeDetail}`)
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

function buildInlineFallbackFileUrl(contentType: string, buffer: Buffer): string {
  return `data:${contentType || 'application/octet-stream'};base64,${buffer.toString('base64')}`
}

export async function uploadToObjectStorage(input: {
  organizationId: string
  carrierId?: string
  packageId?: string
  originalFileName: string
  contentType: string
  buffer: Buffer
}): Promise<{ fileUrl: string; storagePath: string }> {
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

    const { data } = client.storage.from(bucket).getPublicUrl(storagePath)
    if (!data?.publicUrl) {
      throw new ObjectStorageUnavailableError('upload succeeded but no public URL was returned')
    }

    return {
      fileUrl: data.publicUrl,
      storagePath,
    }
  } catch (error) {
    if (process.env.NODE_ENV === 'production') {
      // Everything inside this try is a storage-backend call: any failure
      // here is an upstream dependency problem, so normalize to the typed
      // error callers map to 502 (a generic Error would surface as a 500
      // that reads like an app bug — regression t_2ef8e432).
      throw error instanceof ObjectStorageUnavailableError
        ? error
        : new ObjectStorageUnavailableError(error instanceof Error ? error.message : String(error))
    }
    if (input.buffer.length > 1_000_000) {
      throw new Error('Object storage is unavailable and the file is too large for local fallback storage')
    }
    console.error('Object storage unavailable, using inline dev fallback:', error)
    return {
      fileUrl: buildInlineFallbackFileUrl(input.contentType, input.buffer),
      storagePath: `inline:${storagePath}`,
    }
  }
}

export async function deleteFromObjectStorage(storagePath: string): Promise<void> {
  if (storagePath.startsWith('inline:')) return
  const missingEnv = findMissingObjectStorageEnv()
  if (missingEnv.length > 0) {
    throw new ObjectStorageNotConfiguredError(missingEnv)
  }
  const bucket = getRequiredEnv('SUPABASE_STORAGE_BUCKET')
  const client = getStorageClient()
  const removeResult = await client.storage.from(bucket).remove([storagePath])
  if (removeResult.error) {
    throw new ObjectStorageUnavailableError(removeResult.error.message)
  }
}
