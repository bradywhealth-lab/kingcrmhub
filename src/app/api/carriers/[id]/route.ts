import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getOrgContext } from '@/lib/request-context'
import { z } from 'zod'
import { parseJsonBody } from '@/lib/validation'
import { enforceRateLimit } from '@/lib/rate-limit'

const patchCarrierSchema = z.object({
  name: z.string().max(200).optional(),
  slug: z.string().max(200).optional(),
  logoUrl: z.string().max(500).nullable().optional(),
  website: z.string().max(500).nullable().optional(),
  notes: z.string().max(4000).nullable().optional(),
})

type Params = { params: Promise<{ id: string }> }

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const limited = enforceRateLimit(request, { key: 'carriers-update', limit: 80, windowMs: 60_000 })
    if (limited) return limited
    const context = await getOrgContext(request)
    if (!context) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { id } = await params
    const parsed = await parseJsonBody(request, patchCarrierSchema)
    if (!parsed.success) return parsed.response
    const body = parsed.data
    const existing = await db.carrier.findFirst({
      where: { id, organizationId: context.organizationId },
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
