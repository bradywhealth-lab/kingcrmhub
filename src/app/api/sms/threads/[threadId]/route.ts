/**
 * GET /api/sms/threads/[threadId]
 *
 * Get messages in a specific SMS thread.
 */

import { NextRequest, NextResponse } from 'next/server'
import { withRequestOrgContext } from '@/lib/request-context'
import { db } from '@/lib/db'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ threadId: string }> }
) {
  return withRequestOrgContext(request, async ({ organizationId }) => {
    try {
      const { threadId } = await params

      // Verify thread belongs to org
      const thread = await db.messageThread.findUnique({
        where: { id: threadId },
        select: { organizationId: true }
      })

      if (!thread || thread.organizationId !== organizationId) {
        return NextResponse.json({ error: 'Thread not found' }, { status: 404 })
      }

      // Get messages
      const messages = await db.message.findMany({
        where: { threadId },
        orderBy: { createdAt: 'asc' }
      })

      // Mark as read
      await db.messageThread.update({
        where: { id: threadId },
        data: { unreadCount: 0 }
      })

      return NextResponse.json({ messages })
    } catch (error) {
      console.error('Failed to fetch thread messages:', error)
      return NextResponse.json(
        { error: 'Failed to fetch messages' },
        { status: 500 }
      )
    }
  })
}
