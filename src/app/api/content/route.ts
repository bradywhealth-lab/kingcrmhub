import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { withRequestOrgContext } from '@/lib/request-context'
import { z } from 'zod'
import { parseJsonBody } from '@/lib/validation'
import { enforceRateLimit } from '@/lib/rate-limit'

const createContentSchema = z.object({
  platform: z.string().min(1),
  type: z.string().min(1).optional(),
  title: z.string().max(200).optional(),
  content: z.string().min(1).max(8000),
  status: z.enum(['draft', 'scheduled']).optional(),
  scheduledAt: z.string().optional(),
  mediaUrls: z.array(z.string()).optional(),
})

const patchContentSchema = z.object({
  title: z.string().max(200).optional(),
  content: z.string().max(8000).optional(),
  status: z.string().optional(),
  platform: z.string().optional(),
  scheduledAt: z.string().nullable().optional(),
  publishedAt: z.string().nullable().optional(),
  publishedUrl: z.string().nullable().optional(),
  mediaUrls: z.array(z.string()).nullable().optional(),
})

/**
 * GET /api/content — List content queue items (elite social/marketing).
 * POST /api/content — Create a draft or scheduled post.
 */
export async function GET(request: NextRequest) {
  try {
    return withRequestOrgContext(request, async (context) => {
    const { searchParams } = new URL(request.url)
    const platform = searchParams.get('platform')
    const status = searchParams.get('status')
    const limit = parseInt(searchParams.get('limit') || '50')

    const where: { organizationId: string; platform?: string; status?: string } = {
      organizationId: context.organizationId,
    }
    if (platform) where.platform = platform
    if (status) where.status = status

    const items = await db.contentQueue.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    })

    return NextResponse.json({ items })
    })
  } catch (error) {
    console.error('Content GET error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch content queue' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const limited = enforceRateLimit(request, { key: 'content-create', limit: 80, windowMs: 60_000 })
    if (limited) return limited
    return withRequestOrgContext(request, async (context) => {
    const parsed = await parseJsonBody(request, createContentSchema)
    if (!parsed.success) return parsed.response
    const body = parsed.data
    const {
      platform,
      type = 'post',
      title,
      content,
      status = 'draft',
      scheduledAt,
      mediaUrls,
    } = body as {
      platform: string
      type?: string
      title?: string
      content: string
      status?: string
      scheduledAt?: string
      mediaUrls?: string[]
    }

    const item = await db.contentQueue.create({
      data: {
        organizationId: context.organizationId,
        platform,
        type: type || 'post',
        title: title?.trim() || null,
        content: content.trim(),
        status: status === 'scheduled' ? 'scheduled' : 'draft',
        scheduledFor: scheduledAt ? new Date(scheduledAt) : null,
        mediaUrls: Array.isArray(mediaUrls) ? mediaUrls : undefined,
      },
    })

    return NextResponse.json({ item })
    })
  } catch (error) {
    console.error('Content POST error:', error)
    return NextResponse.json(
      { error: 'Failed to create content' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const limited = enforceRateLimit(request, { key: 'content-update', limit: 100, windowMs: 60_000 })
    if (limited) return limited
    return withRequestOrgContext(request, async (context) => {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

    const parsed = await parseJsonBody(request, patchContentSchema)
    if (!parsed.success) return parsed.response
    const body = parsed.data
    const updateData: {
      title?: string | null
      content?: string
      status?: string
      platform?: string
      scheduledFor?: Date | null
      publishedAt?: Date | null
      publishedUrl?: string | null
      mediaUrls?: string[] | null
    } = {}

    if (typeof body.title === 'string') updateData.title = body.title.trim() || null
    if (typeof body.content === 'string') updateData.content = body.content.trim()
    if (typeof body.status === 'string') updateData.status = body.status
    if (typeof body.platform === 'string') updateData.platform = body.platform
    if (body.scheduledAt !== undefined) {
      updateData.scheduledFor = body.scheduledAt ? new Date(body.scheduledAt) : null
    }
    if (body.publishedAt !== undefined) {
      updateData.publishedAt = body.publishedAt ? new Date(body.publishedAt) : null
    }
    if (body.publishedUrl !== undefined) updateData.publishedUrl = body.publishedUrl || null
    if (body.mediaUrls !== undefined) updateData.mediaUrls = Array.isArray(body.mediaUrls) ? body.mediaUrls : null

    const updated = await db.contentQueue.updateMany({
      where: { id, organizationId: context.organizationId },
      data: updateData,
    })
    if (updated.count === 0) return NextResponse.json({ error: 'Content item not found' }, { status: 404 })
    const item = await db.contentQueue.findUnique({ where: { id } })

    return NextResponse.json({ item })
    })
  } catch (error) {
    console.error('Content PATCH error:', error)
    return NextResponse.json({ error: 'Failed to update content item' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const limited = enforceRateLimit(request, { key: 'content-delete', limit: 80, windowMs: 60_000 })
    if (limited) return limited
    return withRequestOrgContext(request, async (context) => {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

    const deleted = await db.contentQueue.deleteMany({
      where: { id, organizationId: context.organizationId },
    })
    if (deleted.count === 0) return NextResponse.json({ error: 'Content item not found' }, { status: 404 })
    return NextResponse.json({ success: true })
    })
  } catch (error) {
    console.error('Content DELETE error:', error)
    return NextResponse.json({ error: 'Failed to delete content item' }, { status: 500 })
  }
}
