import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { withRequestOrgContext } from '@/lib/request-context'
import { z } from 'zod'
import { parseJsonBody } from '@/lib/validation'
import { getTasksForStage, hasFeatureAccess, TASK_FEATURES } from '@/lib/tasks'

const autoSpawnSchema = z.object({
  pipelineItemId: z.string(),
  stageName: z.string().optional(),
})

/**
 * POST /api/pipeline/auto-spawn
 *
 * Triggered when a pipeline item changes stage.
 * Reads the item's ACTUAL current stage from the DB (never trusts the request body)
 * and creates tasks based on that stage (e.g., "won" → 3 onboarding tasks).
 * Starter+ tier required — returns 402 if org is on free.
 */
export const POST = (request: NextRequest) =>
  withRequestOrgContext(request, async ({ organizationId }) => {
    const parsed = await parseJsonBody(request, autoSpawnSchema)
    if (!parsed.success) return parsed.response
    const { pipelineItemId } = parsed.data

    // Tier gate: Pro+ required for auto-spawn
    const org = await db.organization.findUnique({
      where: { id: organizationId },
      select: { plan: true },
    })

    if (!org) return NextResponse.json({ error: 'Organization not found' }, { status: 404 })

    if (!hasFeatureAccess(org.plan as 'free' | 'starter' | 'pro' | 'enterprise', TASK_FEATURES.AUTO_SPAWN)) {
      return NextResponse.json(
        { error: 'Auto-spawn requires Starter plan or higher', requiredTier: 'starter' },
        { status: 402 },
      )
    }

    // Verify pipeline item belongs to this org AND load its actual stage
    const item = await db.pipelineItem.findFirst({
      where: { id: pipelineItemId },
      include: {
        pipeline: { select: { organizationId: true } },
        stage: { select: { name: true } },
      },
    })

    if (!item || item.pipeline.organizationId !== organizationId) {
      return NextResponse.json({ error: 'Pipeline item not found' }, { status: 404 })
    }

    // Derive stage from the persisted value — never trust request body
    const stageName = item.stage?.name ?? ''

    // Get tasks for this stage
    const taskDefs = getTasksForStage(stageName)
    if (taskDefs.length === 0) {
      return NextResponse.json({ tasks: [], message: 'No auto-spawn rules for this stage' })
    }

    // Idempotency: skip if auto-spawn tasks already exist for this pipeline item
    const existingCount = await db.task.count({
      where: { pipelineItemId, source: 'auto_spawn', organizationId },
    })
    if (existingCount > 0) {
      return NextResponse.json({ tasks: [], message: 'Auto-spawn tasks already exist for this pipeline item' })
    }

    // Create tasks via Promise.all (already inside withRequestOrgContext's transaction)
    const tasks = await Promise.all(
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