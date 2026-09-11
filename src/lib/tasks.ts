import type { Organization } from '@prisma/client'

/**
 * Tier definitions for Tasks & Appointments Hub features.
 * Gates are enforced server-side — never trust client-side hiding.
 */

export type PlanTier = 'free' | 'starter' | 'pro' | 'enterprise'

export const TASK_FEATURES = {
  /** Basic task list + Kanban — all tiers */
  TASKS_BASIC: 'tasks_basic',
  /** Auto-spawn tasks from pipeline stage changes — Pro+ */
  AUTO_SPAWN: 'auto_spawn',
  /** Google Calendar 2-way sync — Studio+ */
  GCAL_SYNC: 'gcal_sync',
  /** Booking links — all tiers */
  BOOKING_LINKS: 'booking_links',
} as const

const TIER_ACCESS: Record<string, PlanTier[]> = {
  [TASK_FEATURES.TASKS_BASIC]: ['free', 'starter', 'pro', 'enterprise'],
  [TASK_FEATURES.AUTO_SPAWN]: ['starter', 'pro', 'enterprise'],
  [TASK_FEATURES.GCAL_SYNC]: ['pro', 'enterprise'],
  [TASK_FEATURES.BOOKING_LINKS]: ['free', 'starter', 'pro', 'enterprise'],
}

/**
 * Check if an organization's plan grants access to a feature.
 * Returns true if allowed, false if the tier is too low.
 */
export function hasFeatureAccess(plan: PlanTier, feature: string): boolean {
  const allowedTiers = TIER_ACCESS[feature]
  if (!allowedTiers) return false
  return allowedTiers.includes(plan)
}

/**
 * Auto-spawn tasks when a pipeline item moves to a "won" stage.
 * Returns the count of tasks created.
 *
 * Pro+ only — callers must gate before invoking.
 */
export const AUTO_SPAWN_RULES: Record<string, Array<{ title: string; description: string }>> = {
  won: [
    { title: 'Send onboarding welcome email', description: 'Send the new client welcome packet and onboarding instructions.' },
    { title: 'Schedule kickoff call', description: 'Book a 30-minute kickoff call within the first 3 business days.' },
    { title: 'Set up project workspace', description: 'Create shared folder, project board, and invite the client.' },
  ],
  proposal: [
    { title: 'Follow up on proposal', description: 'Send a follow-up email 3 days after proposal sent if no response.' },
  ],
}

export function getTasksForStage(stageName: string): Array<{ title: string; description: string }> {
  const normalized = stageName.toLowerCase().trim()
  return AUTO_SPAWN_RULES[normalized] ?? []
}