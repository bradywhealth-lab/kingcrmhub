import { createClient } from '@supabase/supabase-js'

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
      throw new Error(`Object storage upload failed: ${uploadResult.error.message}`)
    }

    const { data } = client.storage.from(bucket).getPublicUrl(storagePath)
    if (!data?.publicUrl) {
      throw new Error('Object storage upload succeeded but no public URL was returned')
    }

    return {
      fileUrl: data.publicUrl,
      storagePath,
    }
  } catch (error) {
    if (process.env.NODE_ENV === 'production') throw error
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
  const bucket = getRequiredEnv('SUPABASE_STORAGE_BUCKET')
  const client = getStorageClient()
  const removeResult = await client.storage.from(bucket).remove([storagePath])
  if (removeResult.error) {
    throw new Error(`Object storage delete failed: ${removeResult.error.message}`)
  }
}
