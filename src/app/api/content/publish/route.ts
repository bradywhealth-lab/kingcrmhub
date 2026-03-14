import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { isInternalRunnerAuthorized } from '@/lib/internal-runner'
import { withRequestOrgContext } from '@/lib/request-context'
import { z } from 'zod'
import { parseJsonBody } from '@/lib/validation'
import { enforceRateLimit } from '@/lib/rate-limit'

const publishRunnerSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
})

/**
 * POST /api/content/publish
 * Processes due scheduled content and marks publish results.
 *
 * This is an internal runner endpoint intended for cron/job execution.
 */
export async function POST(request: NextRequest) {
  try {
    const limited = enforceRateLimit(request, { key: 'content-publish-runner', limit: 30, windowMs: 60_000 })
    if (limited) return limited
    if (!isInternalRunnerAuthorized(request)) {
      return NextResponse.json({ error: 'Unauthorized runner request' }, { status: 401 })
    }
    return withRequestOrgContext(request, async (context) => {

    const parsed = await parseJsonBody(request, publishRunnerSchema)
    if (!parsed.success) return parsed.response
    const limit = parsed.data.limit ?? 25
    const now = new Date()

    const dueItems = await db.contentQueue.findMany({
      where: {
        organizationId: context.organizationId,
        status: 'scheduled',
        OR: [{ scheduledFor: null }, { scheduledFor: { lte: now } }],
      },
      orderBy: [{ scheduledFor: 'asc' }, { createdAt: 'asc' }],
      take: limit,
    })

    if (dueItems.length === 0) {
      return NextResponse.json({
        totalDue: 0,
        processed: 0,
        published: 0,
        failed: 0,
        skipped: 0,
      })
    }

    const activeAccounts = await db.socialAccount.findMany({
      where: {
        organizationId: context.organizationId,
        isActive: true,
      },
      select: { platform: true, accountId: true },
    })
    const accountByPlatform = new Map(activeAccounts.map((a) => [a.platform, a]))

    let published = 0
    let failed = 0
    let skipped = 0

    for (const item of dueItems) {
      const account = accountByPlatform.get(item.platform)

      if (!account) {
        skipped++
        await db.activity.create({
          data: {
            organizationId: context.organizationId,
            type: 'content_publish_skipped',
            title: `Skipped publishing ${item.platform} content`,
            description: 'No active social account connected for this platform',
            metadata: {
              contentId: item.id,
              platform: item.platform,
              reason: 'missing_social_account',
            },
          },
        })
        continue
      }

      try {
        // Integration handoff:
        // Replace this simulated publish URL with real provider API calls.
        const simulatedUrl = `https://${item.platform}.com/post/${item.id}`

        await db.contentQueue.update({
          where: { id: item.id },
          data: {
            status: 'published',
            publishedAt: new Date(),
            publishedUrl: simulatedUrl,
          },
        })

        await db.activity.create({
          data: {
            organizationId: context.organizationId,
            type: 'content_published',
            title: `Published ${item.platform} content`,
            description: item.title || item.content.slice(0, 120),
            metadata: {
              contentId: item.id,
              platform: item.platform,
              accountId: account.accountId,
              publishedUrl: simulatedUrl,
            },
          },
        })

        published++
      } catch (error) {
        failed++
        await db.contentQueue.update({
          where: { id: item.id },
          data: {
            status: 'failed',
          },
        })
        await db.activity.create({
          data: {
            organizationId: context.organizationId,
            type: 'content_publish_failed',
            title: `Failed to publish ${item.platform} content`,
            description: error instanceof Error ? error.message : 'Unknown publish error',
            metadata: {
              contentId: item.id,
              platform: item.platform,
            },
          },
        })
      }
    }

    return NextResponse.json({
      totalDue: dueItems.length,
      processed: dueItems.length,
      published,
      failed,
      skipped,
    })
    })
  } catch (error) {
    console.error('Content publish runner error:', error)
    return NextResponse.json({ error: 'Failed to run content publisher' }, { status: 500 })
  }
}
