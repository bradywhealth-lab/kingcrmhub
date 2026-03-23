/**
 * GET /api/sms/threads
 *
 * Get all SMS threads for the organization.
 */

import { NextRequest, NextResponse } from 'next/server'
import { withRequestOrgContext } from '@/lib/request-context'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  return withRequestOrgContext(request, async ({ organizationId }) => {
    try {
      const { searchParams } = new URL(request.url)
      const limit = parseInt(searchParams.get('limit') || '50')
      const offset = parseInt(searchParams.get('offset') || '0')
      const unreadOnly = searchParams.get('unreadOnly') === 'true'

      const where: any = {
        organizationId,
        primaryChannel: 'sms'
      }

      if (unreadOnly) {
        where.unreadCount = { gt: 0 }
      }

      const [threads, total] = await Promise.all([
        db.messageThread.findMany({
          where,
          include: {
            lead: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                phone: true,
                company: true
              }
            }
          },
          orderBy: { lastMessageAt: 'desc' },
          take: limit,
          skip: offset
        }),
        db.messageThread.count({ where })
      ])

      return NextResponse.json({
        threads,
        total,
        limit,
        offset
      })
    } catch (error) {
      console.error('Failed to fetch threads:', error)
      return NextResponse.json(
        { error: 'Failed to fetch threads' },
        { status: 500 }
      )
    }
  })
}
