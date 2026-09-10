import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { withRequestOrgContext } from '@/lib/request-context'
import { z } from 'zod'
import { parseJsonBody } from '@/lib/validation'
import { getTasksForStage, hasFeatureAccess, TASK_FEATURES } from '@/lib/tasks'

const autoSpawnSchema = z.object({
  pipelineItemId: z.string(),
  stageName: z.string(),
})

/**
 * POST /api/pipeline/auto-spawn
 *
 * Triggered when a pipeline item changes stage.
 * Auto-creates tasks based on the target stage (e.g., "won" → 3 onboarding tasks).
 * Pro+ tier required — returns 402 if org is on free/starter.
 */
export const POST = (request: NextRequest) =>
  withRequestOrgContext(request, async ({ organizationId }) => {
    const parsed = await parseJsonBody(request, autoSpawnSchema)
    if (!parsed.success) return parsed.response
    const { pipelineItemId, stageName } = parsed.data

    // Tier gate: Pro+ required for auto-spawn
    const org = await db.organization.findUnique({
      where: { id: organizationId },
      select: { plan: true },
    })

    if (!org) return NextResponse.json({ error: 'Organization not found' }, { status: 404 })

    if (!hasFeatureAccess(org.plan as 'free' | 'starter' | 'pro' | 'enterprise', TASK_FEATURES.AUTO_SPAWN)) {
      return NextResponse.json(
        { error: 'Auto-spawn requires Pro plan or higher', requiredTier: 'pro' },
        { status: 402 },
      )
    }

    // Verify pipeline item belongs to this org
    const item = await db.pipelineItem.findFirst({
      where: { id: pipelineItemId },
      include: { pipeline: { select: { organizationId: true } } },
    })

    if (!item || item.pipeline.organizationId !== organizationId) {
      return NextResponse.json({ error: 'Pipeline item not found' }, { status: 404 })
    }

    // Get tasks for this stage
    const taskDefs = getTasksForStage(stageName)
    if (taskDefs.length === 0) {
      return NextResponse.json({ tasks: [], message: 'No auto-spawn rules for this stage' })
    }

    // Create tasks in a transaction
    const tasks = await db.$transaction(
      taskDefs.map((def, index) =>
        db.task.create({
          data: {
            organizationId,
            title: def.title,
            description: def.description,
            status: 'todo',
            priority: 'normal',
            source: 'auto_spawn',
            pipelineItemId,
            leadId: item.leadId ?? undefined,
            position: index,
          },
        }),
      ),
    )

    return NextResponse.json({ tasks, count: tasks.length }, { status: 201 })
  })