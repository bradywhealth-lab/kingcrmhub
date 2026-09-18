import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { withRequestOrgContext } from '@/lib/request-context'
import { deleteFromObjectStorage, ObjectStorageNotConfiguredError } from '@/lib/object-storage'
import { enforceRateLimit } from '@/lib/rate-limit'

const STORAGE_UNAVAILABLE_MESSAGE =
  'Document storage is not configured. Document management is unavailable until an administrator configures storage.'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  try {
    const { id: packageId, docId } = await params
    return withRequestOrgContext(request, async (context) => {
      const document = await db.packageDocument.findFirst({
        where: {
          id: docId,
          packageId,
          organizationId: context.organizationId,
        },
        include: {
          chunks: {
            orderBy: { chunkIndex: 'asc' },
          },
        },
      })

      if (!document) {
        return NextResponse.json({ error: 'Document not found' }, { status: 404 })
      }

      return NextResponse.json({ document })
    })
  } catch (error) {
    console.error('PackageDocument GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch document' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  try {
    const { id: packageId, docId } = await params
    const limited = enforceRateLimit(request, { key: 'package-documents-delete', limit: 30, windowMs: 60_000 })
    if (limited) return limited

    // `return await` so a rejected handler promise (e.g. storage errors)
    // reaches the catch below instead of leaking as a bare empty-body 500.
    return await withRequestOrgContext(request, async (context) => {
      const document = await db.packageDocument.findFirst({
        where: {
          id: docId,
          packageId,
          organizationId: context.organizationId,
        },
      })

      if (!document) {
        return NextResponse.json({ error: 'Document not found' }, { status: 404 })
      }

      if (document.storagePath) {
        await deleteFromObjectStorage(document.storagePath)
      }
      await db.packageDocument.delete({ where: { id: docId } })

      return NextResponse.json({ success: true })
    })
  } catch (error) {
    if (error instanceof ObjectStorageNotConfiguredError) {
      console.error('PackageDocument DELETE error:', error)
      return NextResponse.json({ error: STORAGE_UNAVAILABLE_MESSAGE }, { status: 503 })
    }
    console.error('PackageDocument DELETE error:', error)
    return NextResponse.json({ error: 'Failed to delete document' }, { status: 500 })
  }
}
