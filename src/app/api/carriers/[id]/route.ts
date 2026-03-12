import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

const ORGANIZATION_ID = 'demo-org-1'

type Params = { params: Promise<{ id: string }> }

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const body = await request.json()
    const existing = await db.carrier.findFirst({
      where: { id, organizationId: ORGANIZATION_ID },
    })
    if (!existing) return NextResponse.json({ error: 'Carrier not found' }, { status: 404 })

    const data: {
      name?: string
      slug?: string
      logoUrl?: string | null
      website?: string | null
      notes?: string | null
    } = {}

    if (typeof body.name === 'string') data.name = body.name.trim()
    if (typeof body.slug === 'string') data.slug = body.slug.trim().toLowerCase()
    if (body.logoUrl !== undefined) data.logoUrl = body.logoUrl ? String(body.logoUrl).trim() : null
    if (body.website !== undefined) data.website = body.website ? String(body.website).trim() : null
    if (body.notes !== undefined) data.notes = body.notes ? String(body.notes).trim() : null

    const carrier = await db.carrier.update({
      where: { id },
      data,
    })

    return NextResponse.json({ carrier })
  } catch (error) {
    console.error('Carrier PATCH error:', error)
    return NextResponse.json({ error: 'Failed to update carrier' }, { status: 500 })
  }
}
