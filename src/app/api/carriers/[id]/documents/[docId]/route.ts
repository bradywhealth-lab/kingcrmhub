import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

const ORGANIZATION_ID = 'demo-org-1'
type Params = { params: Promise<{ id: string; docId: string }> }

export async function DELETE(_request: NextRequest, { params }: Params) {
  try {
    const { id, docId } = await params
    const doc = await db.carrierDocument.findFirst({
      where: { id: docId, carrierId: id, organizationId: ORGANIZATION_ID },
    })
    if (!doc) return NextResponse.json({ error: 'Document not found' }, { status: 404 })

    await db.carrierDocument.delete({ where: { id: docId } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Carrier document DELETE error:', error)
    return NextResponse.json({ error: 'Failed to delete carrier document' }, { status: 500 })
  }
}
