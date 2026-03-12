import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getOrgContext } from '@/lib/request-context'
import { deleteFromObjectStorage } from '@/lib/object-storage'

type Params = { params: Promise<{ id: string; docId: string }> }

export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const context = await getOrgContext(request)
    if (!context) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { id, docId } = await params
    const doc = await db.carrierDocument.findFirst({
      where: { id: docId, carrierId: id, organizationId: context.organizationId },
    })
    if (!doc) return NextResponse.json({ error: 'Document not found' }, { status: 404 })

    if (doc.storagePath) {
      await deleteFromObjectStorage(doc.storagePath)
    }
    await db.carrierDocument.delete({ where: { id: docId } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Carrier document DELETE error:', error)
    return NextResponse.json({ error: 'Failed to delete carrier document' }, { status: 500 })
  }
}
