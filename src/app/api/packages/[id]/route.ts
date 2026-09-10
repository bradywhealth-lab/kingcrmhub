import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { withRequestOrgContext } from '@/lib/request-context'
import { z } from 'zod'
import { parseJsonBody } from '@/lib/validation'
import { enforceRateLimit } from '@/lib/rate-limit'

const updatePackageSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  slug: z.string().max(200).optional(),
  logoUrl: z.string().max(500).nullable().optional(),
  website: z.string().max(500).nullable().optional(),
  notes: z.string().max(4000).nullable().optional(),
})

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    return withRequestOrgContext(request, async (context) => {
      const servicePackage = await db.servicePackage.findFirst({
        where: { id, organizationId: context.organizationId },
        include: {
          packageDocuments: {
            orderBy: { createdAt: 'desc' },
          },
        },
      })

      if (!servicePackage) {
        return NextResponse.json({ error: 'Service package not found' }, { status: 404 })
      }

      return NextResponse.json({ servicePackage })
    })
  } catch (error) {
    console.error('ServicePackage GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch service package' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const limited = enforceRateLimit(request, { key: 'packages-update', limit: 60, windowMs: 60_000 })
    if (limited) return limited

    return withRequestOrgContext(request, async (context) => {
      const parsed = await parseJsonBody(request, updatePackageSchema)
      if (!parsed.success) return parsed.response
      const body = parsed.data

      const existing = await db.servicePackage.findFirst({
        where: { id, organizationId: context.organizationId },
      })

      if (!existing) {
        return NextResponse.json({ error: 'Service package not found' }, { status: 404 })
      }

      const updateData: Record<string, unknown> = {}
      if (body.name !== undefined) updateData.name = body.name.trim()
      if (body.slug !== undefined) {
        updateData.slug = body.slug.trim().toLowerCase()
      }
      if (body.logoUrl !== undefined) updateData.logoUrl = body.logoUrl?.trim() || null
      if (body.website !== undefined) updateData.website = body.website?.trim() || null
      if (body.notes !== undefined) updateData.notes = body.notes?.trim() || null

      const servicePackage = await db.servicePackage.update({
        where: { id },
        data: updateData,
      })

      return NextResponse.json({ servicePackage })
    })
  } catch (error) {
    console.error('ServicePackage PATCH error:', error)
    return NextResponse.json({ error: 'Failed to update service package' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const limited = enforceRateLimit(request, { key: 'packages-delete', limit: 30, windowMs: 60_000 })
    if (limited) return limited

    return withRequestOrgContext(request, async (context) => {
      const existing = await db.servicePackage.findFirst({
        where: { id, organizationId: context.organizationId },
      })

      if (!existing) {
        return NextResponse.json({ error: 'Service package not found' }, { status: 404 })
      }

      await db.servicePackage.delete({ where: { id } })

      return NextResponse.json({ success: true })
    })
  } catch (error) {
    console.error('ServicePackage DELETE error:', error)
    return NextResponse.json({ error: 'Failed to delete service package' }, { status: 500 })
  }
}
